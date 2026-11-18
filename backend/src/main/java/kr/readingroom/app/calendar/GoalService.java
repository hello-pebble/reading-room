package kr.readingroom.app.calendar;

import kr.readingroom.app.calendar.dto.*;
import kr.readingroom.app.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.ClockConfig;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 월 완독 목표: 달마다 따로 보관한다 (결정 #39). 날짜는 모두 Asia/Seoul 기준. */
@Service
public class GoalService {
    public static final int DEFAULT_GOAL = 1;
    private final GoalRepository goalRepository;
    private final UserRepository userRepository;
    private final Clock clock;
    private final ObjectMapper json;

    public GoalService(GoalRepository goalRepository, UserRepository userRepository, Clock clock, ObjectMapper json) {
        this.goalRepository = goalRepository;
        this.userRepository = userRepository;
        this.clock = clock;
        this.json = json;
    }

    public record Goal(Integer goal, JsonNode changes, boolean inherited) {}

    public YearMonth thisMonth() {
        return YearMonth.from(LocalDate.ofInstant(clock.instant(), ClockConfig.SEOUL));
    }

    /**
     * 조회 규칙: 그 달 행 → 없으면 이른 달 중 가장 최근 값을 이어받기(inherited) → 가장 이른 행보다 앞선 달은 null.
     * 이어받기는 앞으로만 가므로 지난 달 값은 이번 달 변경에 영향받지 않는다.
     */
    public Goal lookup(long userId, YearMonth ym) {
        Record own = goalRepository.find(userId, ym.toString());
        if (own != null) return new Goal(own.get("goal", Integer.class), parse(own.get("changes", String.class)), false);
        Record prev = goalRepository.findPrevious(userId, ym.toString());
        if (prev != null) return new Goal(prev.get("goal", Integer.class), json.createArrayNode(), true);
        return new Goal(null, json.createArrayNode(), false);
    }

    /** 새 사용자(목표 행이 하나도 없음)의 첫 조회 때 이번 달 행을 기본 1권으로 만든다. */
    @Transactional
    public void ensureFirstRow(long userId) {
        lockUser(userId);
        if (goalRepository.count(userId).get(0, Integer.class) > 0) return;
        goalRepository.insertDefault(userId, thisMonth().toString(), DEFAULT_GOAL, clock.instant().toString());
    }

    /** 이번 달 목표만 바꾼다. 같은 값이면 그대로(멱등), 같은 한국 날짜의 여러 번 변경은 한 번으로 합치고 처음 값으로 돌아오면 지운다. */
    @Transactional
    public GoalResponse set(long userId, GoalRequest body) {
        if (body == null || !RequestJson.present(body.monthlyGoal()) || !body.monthlyGoal().isIntegralNumber()
                || body.monthlyGoal().asLong() < 1 || body.monthlyGoal().asLong() > 99)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_GOAL", "월 목표는 1~99권이에요");
        int want = body.monthlyGoal().asInt();
        ensureFirstRow(userId);
        lockUser(userId);
        YearMonth ym = thisMonth();
        String today = LocalDate.ofInstant(clock.instant(), ClockConfig.SEOUL).toString();
        Goal cur = lookup(userId, ym);
        int base = cur.goal();
        if (want != base) {
            ArrayNode changes = cur.inherited() ? json.createArrayNode() : (ArrayNode) cur.changes().deepCopy();
            ObjectNode last = changes.isEmpty() ? null : (ObjectNode) changes.get(changes.size() - 1);
            if (last != null && today.equals(last.get("at").asText())) {
                if (last.get("from").asInt() == want) changes.remove(changes.size() - 1);   // 그날의 처음 값으로 돌아왔다
                else last.put("to", want);
            } else {
                changes.addObject().put("at", today).put("from", base).put("to", want);
            }
            goalRepository.upsert(userId, ym.toString(), want, write(changes), clock.instant().toString());
        }
        return view(ym, lookup(userId, ym));
    }

    @Transactional
    public GoalResponse current(long userId) {
        ensureFirstRow(userId);
        YearMonth ym = thisMonth();
        return view(ym, lookup(userId, ym));
    }

    private GoalResponse view(YearMonth ym, Goal g) {
        return new GoalResponse(ym.toString(), g.goal(), GoalChange.list(g.changes()), g.inherited());
    }

    private void lockUser(long userId) {
        if (userRepository.lock(userId) == null)
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사용자를 찾을 수 없어요");
    }

    private JsonNode parse(String s) {
        try {
            return json.readTree(s);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private String write(JsonNode n) {
        try {
            return json.writeValueAsString(n);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
