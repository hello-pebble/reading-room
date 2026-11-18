package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.YearMonth;
import java.util.Map;
import kr.readingroom.app.calendar.GoalService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class GoalTest extends ApiTestBase {
    @Autowired GoalService goals;

    @Test
    void newUserGetsThisMonthRowWithDefaultOnFirstRead() throws Exception {
        long u = newUser("alice");
        assertThat(dsl.fetchCount(dsl.selectFrom("monthly_goal"))).isZero();
        mvc.perform(GET(u, "/me/goal")).andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-11")).andExpect(jsonPath("$.goal").value(1))
                .andExpect(jsonPath("$.goalInherited").value(false)).andExpect(jsonPath("$.goalChanges").isEmpty());
        assertThat(dsl.fetchOne("select year_month from monthly_goal").get(0, String.class)).isEqualTo("2026-11");
        mvc.perform(GET(u, "/me/goal"));
        assertThat(dsl.fetchCount(dsl.selectFrom("monthly_goal"))).isEqualTo(1);
    }

    @Test
    void putValidatesRangeAndIsIdempotent() throws Exception {
        long u = newUser("alice");
        for (Object bad : new Object[] {0, 100, -1, "3", 2.5})
            mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", bad))).andExpect(status().isBadRequest());
        mvc.perform(PUT(u, "/me/goal", Map.of())).andExpect(status().isBadRequest());
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 99))).andExpect(status().isOk()).andExpect(jsonPath("$.goal").value(99));
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 3))).andExpect(status().isOk());
        var first = mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 3))).andExpect(status().isOk()).andReturn();
        var second = mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 3))).andExpect(status().isOk()).andReturn();
        assertThat(body(second)).isEqualTo(body(first));
        assertThat(body(second).get("goal").asInt()).isEqualTo(3);
        assertThat(body(second).get("goalChanges")).hasSize(1);   // 같은 값 재전송은 기록을 늘리지 않는다
    }

    @Test
    void sameDayChangesMergeAndReturningToStartClearsTheRecord() throws Exception {
        long u = newUser("alice");
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 3)));   // 1 → 3 (첫 행 1권 뒤 변경)
        clock.advance(java.time.Duration.ofDays(1));                  // 11/18
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 4)))
                .andExpect(jsonPath("$.goalChanges.length()").value(2))
                .andExpect(jsonPath("$.goalChanges[1].at").value("2026-11-18"))
                .andExpect(jsonPath("$.goalChanges[1].from").value(3)).andExpect(jsonPath("$.goalChanges[1].to").value(4));
        // 같은 날 또 바꾸면 한 번으로 합친다 (3→4, 4→6 이 아니라 3→6)
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 6)))
                .andExpect(jsonPath("$.goalChanges.length()").value(2))
                .andExpect(jsonPath("$.goalChanges[1].from").value(3)).andExpect(jsonPath("$.goalChanges[1].to").value(6));
        // 그날의 처음 값(3)으로 돌아오면 그날 기록을 지운다
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 3)))
                .andExpect(jsonPath("$.goal").value(3)).andExpect(jsonPath("$.goalChanges.length()").value(1))
                .andExpect(jsonPath("$.goalChanges[0].at").value("2026-11-17"));
    }

    @Test
    void sameDayIsJudgedByKoreanDate() throws Exception {
        long u = newUser("alice");
        clock.set("2026-11-17T14:50:00Z");   // 한국 11/17 23:50
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 2)));
        clock.set("2026-11-17T15:10:00Z");   // 한국 11/18 00:10 → 다른 날
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 5)))
                .andExpect(jsonPath("$.goalChanges.length()").value(2)).andExpect(jsonPath("$.goalChanges[1].at").value("2026-11-18"));
    }

    @Test
    void lookupInheritsForwardOnlyAndIsNullBeforeEarliestRow() throws Exception {
        long u = newUser("alice");
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 3)));   // 2026-11 = 3
        var m = GoalService.class;
        // 이른 달은 기록 없음
        var before = goals.lookup(u, YearMonth.of(2026, 10));
        assertThat(before.goal()).isNull();
        assertThat(before.inherited()).isFalse();
        // 다음 달은 직전 값을 이어받는다
        var dec = goals.lookup(u, YearMonth.of(2026, 12));
        assertThat(dec.goal()).isEqualTo(3);
        assertThat(dec.inherited()).isTrue();
        assertThat(goals.lookup(u, YearMonth.of(2027, 3)).goal()).isEqualTo(3);
        // 12월이 되어 4로 바꿔도 11월 값은 그대로다
        clock.set("2026-12-05T03:00:00Z");
        mvc.perform(GET(u, "/me/goal")).andExpect(jsonPath("$.goal").value(3)).andExpect(jsonPath("$.goalInherited").value(true));
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 4)))
                .andExpect(jsonPath("$.month").value("2026-12")).andExpect(jsonPath("$.goal").value(4)).andExpect(jsonPath("$.goalInherited").value(false))
                .andExpect(jsonPath("$.goalChanges[0].from").value(3)).andExpect(jsonPath("$.goalChanges[0].to").value(4));
        assertThat(goals.lookup(u, YearMonth.of(2026, 11)).goal()).isEqualTo(3);
        assertThat(goals.lookup(u, YearMonth.of(2026, 11)).inherited()).isFalse();
        assertThat(goals.lookup(u, YearMonth.of(2027, 1)).goal()).isEqualTo(4);
        // 같은 값을 이어받은 채 보내면 행을 만들지 않는다 (2027-01 에서 4 그대로)
        clock.set("2027-01-05T03:00:00Z");
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 4))).andExpect(jsonPath("$.goalInherited").value(true));
        assertThat(dsl.fetchCount(dsl.selectFrom("monthly_goal"))).isEqualTo(2);
    }

    @Test
    void monthRollsOverAtKoreanMidnightNotUtc() throws Exception {
        long u = newUser("alice");
        clock.set("2026-11-30T14:59:00Z");   // 한국 11/30 23:59
        mvc.perform(GET(u, "/me/goal")).andExpect(jsonPath("$.month").value("2026-11"));
        clock.set("2026-11-30T15:00:00Z");   // 한국 12/01 00:00
        mvc.perform(GET(u, "/me/goal")).andExpect(jsonPath("$.month").value("2026-12")).andExpect(jsonPath("$.goalInherited").value(true));
    }

    @Test
    void goalsAreSeparatePerUser() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        mvc.perform(PUT(a, "/me/goal", Map.of("monthlyGoal", 7)));
        mvc.perform(GET(b, "/me/goal")).andExpect(jsonPath("$.goal").value(1));
    }
}
