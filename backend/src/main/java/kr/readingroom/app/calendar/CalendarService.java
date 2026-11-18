package kr.readingroom.app.calendar;

import kr.readingroom.app.calendar.dto.*;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.ClockConfig;
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

    /** 독서한 날 전체: 끝난 스탠드·직접 기록(DONE)의 ended_at 날짜 + 완독(DONE) 책의 finished_at 날짜. 버려진·진행 중·확인 필요 기록은 세지 않는다. */
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
