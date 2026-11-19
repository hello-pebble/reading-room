package kr.readingroom.app.calendar;

import kr.readingroom.app.calendar.dto.*;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.ClockConfig;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 달력: 독서한 날·연속 독서일·월 완독 수. 날짜는 모두 한국 시간(Asia/Seoul)으로 자른다. */
@Service
public class CalendarService {
    private final CalendarRepository calendarRepository;
    private final Clock clock;
    private final GoalService goals;

    public CalendarService(CalendarRepository calendarRepository, Clock clock, GoalService goals) {
        this.calendarRepository = calendarRepository;
        this.clock = clock;
        this.goals = goals;
    }

    @Transactional
    public CalendarResponse get(long userId, String monthParam) {
        YearMonth now = goals.thisMonth();
        YearMonth parsed = now;
        if (monthParam != null) {
            try {
                if (!monthParam.matches("\\d{4}-\\d{2}")) throw new DateTimeParseException("형식", monthParam, 0);
                parsed = YearMonth.parse(monthParam);
            } catch (DateTimeParseException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_MONTH", "month는 YYYY-MM 형식이에요");
            }
            if (parsed.isAfter(now)) throw new ApiException(HttpStatus.BAD_REQUEST, "FUTURE_MONTH", "이번 달보다 뒤는 볼 수 없어요");
        }
        final YearMonth ym = parsed;
        boolean current = ym.equals(now);
        if (current) goals.ensureFirstRow(userId);

        Set<LocalDate> all = readingDays(userId);
        List<String> days = new ArrayList<>();
        all.stream().filter(d -> YearMonth.from(d).equals(ym)).sorted().forEach(d -> days.add(d.toString()));

        Integer finished = calendarRepository.countFinished(userId, ym.toString()).get(0, Integer.class);
        GoalService.Goal g = goals.lookup(userId, ym);

        return new CalendarResponse(ym.toString(), days, current ? streak(all) : null, finished, g.goal(),
                GoalChange.list(g.changes()), g.inherited(), clock.instant());
    }

    /**
     * 한국 날짜 하루의 읽은 시간(분). 끝난 스탠드·직접 기록과 저장된 모닥불 입장을 그 날로 잘라 **구간을 합쳐** 더하므로
     * 겹치는 구간은 한 번만 센다(결정 #65). 진행 중인 스탠드·열린 입장은 넣지 않는다(화면이 실시간으로 더한다).
     */
    @Transactional(readOnly = true)
    public ReadingTimeResponse readingTime(long userId, String dateParam) {
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, ClockConfig.SEOUL);
        LocalDate date = today;
        if (dateParam != null) {
            try {
                if (!dateParam.matches("\\d{4}-\\d{2}-\\d{2}")) throw new DateTimeParseException("형식", dateParam, 0);
                date = LocalDate.parse(dateParam);
            } catch (DateTimeParseException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_DATE", "date는 YYYY-MM-DD 형식이에요");
            }
            if (date.isAfter(today)) throw new ApiException(HttpStatus.BAD_REQUEST, "FUTURE", "오늘보다 뒤는 볼 수 없어요");
        }
        Instant from = date.atStartOfDay(ClockConfig.SEOUL).toInstant(), to = date.plusDays(1).atStartOfDay(ClockConfig.SEOUL).toInstant();
        long seconds = 0;
        Instant coveredUntil = from;
        for (Record r : calendarRepository.readingIntervals(userId, from.toString(), to.toString())) {   // 시작 순: 지나온 끝 뒤의 부분만 더한다
            Instant s = r.get("s", OffsetDateTime.class).toInstant(), e = r.get("e", OffsetDateTime.class).toInstant();
            if (s.isBefore(coveredUntil)) s = coveredUntil;
            if (e.isAfter(s)) {
                seconds += Duration.between(s, e).toSeconds();
                coveredUntil = e;
            }
        }
        return new ReadingTimeResponse(date.toString(), seconds / 60, now);
    }

    /** 독서한 날 전체: 끝난 스탠드·직접 기록(DONE)의 ended_at 날짜 + 완독(DONE) 책의 finished_at 날짜 + 저장된 모닥불 입장의 left_at 날짜. 버려진·진행 중·확인 필요 기록은 세지 않는다. */
    Set<LocalDate> readingDays(long userId) {
        Set<LocalDate> out = new HashSet<>();
        calendarRepository.readingDays(userId, userId)
                .forEach(r -> out.add(r.get(0, java.sql.Date.class).toLocalDate()));
        return out;
    }

    /** 오늘에 기록이 있으면 오늘부터, 없으면 어제부터 거꾸로 센다. 월과 상관없이 전체 기록. 오늘·어제 모두 없으면 0. */
    int streak(Set<LocalDate> days) {
        LocalDate d = LocalDate.ofInstant(clock.instant(), ClockConfig.SEOUL);
        if (!days.contains(d)) d = d.minusDays(1);
        int n = 0;
        while (days.contains(d)) {
            n++;
            d = d.minusDays(1);
        }
        return n;
    }
}
