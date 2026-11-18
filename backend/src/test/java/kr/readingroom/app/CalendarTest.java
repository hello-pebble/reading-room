package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CalendarTest extends ApiTestBase {
    long u;

    void session(String status, String source, String endedAtUtc) {
        dsl.execute("""
                insert into reading_session(user_id, book_id, started_at, ended_at, last_check_at, status, source)
                values (?, (select coalesce(min(id), 0) from book where user_id = ?), ?::timestamptz - interval '30 minutes', ?::timestamptz, ?::timestamptz, ?, ?)""",
                u, u, endedAtUtc, endedAtUtc, endedAtUtc, status, source);   // 상태 필터가 걸러내는지 보려고 ended_at을 항상 채운다
    }

    void book(String status, String finishedAtUtc) {
        dsl.execute("insert into book(user_id, title, status, finished_at) values (?, 'b', ?, ?::timestamptz)", u, status, finishedAtUtc);
    }

    JsonNode cal(String qs) throws Exception {
        return body(mvc.perform(GET(u, "/me/calendar" + qs)).andExpect(status().isOk()).andReturn());
    }

    List<String> days(JsonNode c) {
        List<String> l = new ArrayList<>();
        c.get("days").forEach(n -> l.add(n.asText()));
        return l;
    }

    void setup() throws Exception {
        u = newUser("alice");
        // 세션이 참조할 책 한 권
        dsl.execute("insert into book(user_id, title, status) values (?, 'x', 'READING')", u);
    }

    @Test
    void daysComeFromDoneSessionsAndDoneBooksOnly() throws Exception {
        setup();
        session("DONE", "TIMER", "2026-11-03T05:00:00Z");
        session("DONE", "MANUAL", "2026-11-05T05:00:00Z");
        session("DISCARDED", "TIMER", "2026-11-09T05:00:00Z");
        book("DONE", "2026-11-11T05:00:00Z");
        book("DROPPED", "2026-11-12T05:00:00Z");
        book("LATER", "2026-11-13T05:00:00Z");
        JsonNode c = cal("");
        assertThat(c.get("month").asText()).isEqualTo("2026-11");
        assertThat(days(c)).containsExactly("2026-11-03", "2026-11-05", "2026-11-11");
        assertThat(c.get("finishedCount").asInt()).isEqualTo(1);   // 포기·나중에 읽을 책은 세지 않는다
        assertThat(c.get("serverNow").asText()).isEqualTo("2026-11-17T03:00:00Z");
        // 진행 중(RUNNING)·확인 필요(NEEDS_CONFIRM) 기록은 세지 않는다 (켜진 스탠드는 사용자당 하나라 차례로 확인)
        session("RUNNING", "TIMER", "2026-11-07T05:00:00Z");
        assertThat(days(cal(""))).containsExactly("2026-11-03", "2026-11-05", "2026-11-11");
        dsl.execute("update reading_session set status = 'NEEDS_CONFIRM' where status = 'RUNNING'");
        assertThat(days(cal(""))).containsExactly("2026-11-03", "2026-11-05", "2026-11-11");
    }

    @Test
    void koreanMidnightBoundary() throws Exception {
        setup();
        session("DONE", "TIMER", "2026-11-09T14:59:59Z");   // 한국 11/09 23:59:59
        session("DONE", "TIMER", "2026-11-09T15:00:00Z");   // 한국 11/10 00:00:00
        book("DONE", "2026-11-30T14:59:59Z");               // 한국 11/30 23:59:59 → 11월
        book("DONE", "2026-11-30T15:00:00Z");               // 한국 12/01 00:00:00 → 12월
        JsonNode nov = cal("?month=2026-11");
        assertThat(days(nov)).containsExactly("2026-11-09", "2026-11-10", "2026-11-30");
        assertThat(nov.get("finishedCount").asInt()).isEqualTo(1);
        clock.set("2026-12-02T03:00:00Z");
        JsonNode dec = cal("?month=2026-12");
        assertThat(days(dec)).containsExactly("2026-12-01");
        assertThat(dec.get("finishedCount").asInt()).isEqualTo(1);
    }

    @Test
    void finishedCountIgnoresOtherYearsSameMonth() throws Exception {
        setup();
        book("DONE", "2025-11-05T05:00:00Z");
        book("DONE", "2026-11-05T05:00:00Z");
        book("DONE", "2026-11-06T05:00:00Z");
        assertThat(cal("").get("finishedCount").asInt()).isEqualTo(2);
        assertThat(cal("?month=2025-11").get("finishedCount").asInt()).isEqualTo(1);
    }

    @Test
    void streakCountsFromTodayOrYesterdayAcrossMonths() throws Exception {
        setup();
        clock.set("2026-12-02T03:00:00Z");   // 한국 12/02 12:00
        session("DONE", "TIMER", "2026-11-29T05:00:00Z");
        session("DONE", "TIMER", "2026-11-30T05:00:00Z");
        session("DONE", "MANUAL", "2026-12-01T05:00:00Z");
        session("DONE", "TIMER", "2026-12-01T06:00:00Z");   // 같은 날 여러 번은 하루
        // 오늘(12/02) 기록 없음 → 어제부터: 12/01, 11/30, 11/29 = 3 (월을 넘어 센다)
        assertThat(cal("").get("streak").asInt()).isEqualTo(3);
        // 오늘 기록이 생기면 오늘부터 4
        session("DONE", "TIMER", "2026-12-02T01:00:00Z");
        assertThat(cal("").get("streak").asInt()).isEqualTo(4);
    }

    @Test
    void streakIsZeroWhenNeitherTodayNorYesterday() throws Exception {
        setup();
        session("DONE", "TIMER", "2026-11-14T05:00:00Z");
        session("DONE", "TIMER", "2026-11-15T05:00:00Z");   // 그저께(11/15)까지만, 오늘은 11/17
        assertThat(cal("").get("streak").asInt()).isZero();
        session("DONE", "TIMER", "2026-11-16T05:00:00Z");   // 어제
        assertThat(cal("").get("streak").asInt()).isEqualTo(3);
    }

    @Test
    void streakStartsFromKoreanDateNotUtc() throws Exception {
        setup();
        session("DONE", "TIMER", "2026-11-30T05:00:00Z");   // 한국 11/30
        clock.set("2026-11-30T15:30:00Z");                   // UTC로는 11/30이지만 한국은 12/01 00:30
        JsonNode c = cal("");
        assertThat(c.get("month").asText()).isEqualTo("2026-12");
        assertThat(c.get("streak").asInt()).isEqualTo(1);    // 어제(11/30)부터
        clock.advance(Duration.ofDays(1));                   // 한국 12/02 → 어제도 없다
        assertThat(cal("").get("streak").asInt()).isZero();
    }

    @Test
    void streakIsHiddenForPastMonths() throws Exception {
        setup();
        session("DONE", "TIMER", "2026-11-16T05:00:00Z");
        clock.set("2026-12-05T03:00:00Z");
        assertThat(cal("?month=2026-11").get("streak").isNull()).isTrue();
    }

    @Test
    void monthParamRules() throws Exception {
        setup();
        for (String bad : new String[] {"2026-13", "abc", "2026-1", "2026/11", "202611", "2026-00"})
            mvc.perform(GET(u, "/me/calendar?month=" + bad)).andExpect(status().isBadRequest());
        mvc.perform(GET(u, "/me/calendar?month=2026-12")).andExpect(status().isBadRequest());   // 이번 달보다 뒤
        assertThat(cal("?month=2026-11").get("month").asText()).isEqualTo("2026-11");
        assertThat(cal("?month=2026-10").get("days")).isEmpty();
    }

    @Test
    void goalFieldsFollowGoalRules() throws Exception {
        setup();
        JsonNode nov = cal("");
        assertThat(nov.get("goal").asInt()).isEqualTo(1);   // 새 사용자 첫 조회 때 이번 달 기본 1권
        assertThat(nov.get("goalInherited").asBoolean()).isFalse();
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 3)));
        assertThat(cal("").get("goalChanges")).hasSize(1);
        // 처음 기록 이전 달은 목표 기록 없음
        JsonNode oct = cal("?month=2026-10");
        assertThat(oct.get("goal").isNull()).isTrue();
        assertThat(oct.get("goalInherited").asBoolean()).isFalse();
        // 새 달은 직전 목표를 이어받고, 지난 달은 그대로
        clock.set("2026-12-03T03:00:00Z");
        JsonNode dec = cal("");
        assertThat(dec.get("goal").asInt()).isEqualTo(3);
        assertThat(dec.get("goalInherited").asBoolean()).isTrue();
        mvc.perform(PUT(u, "/me/goal", Map.of("monthlyGoal", 5)));
        assertThat(cal("?month=2026-11").get("goal").asInt()).isEqualTo(3);
        assertThat(cal("?month=2026-12").get("goal").asInt()).isEqualTo(5);
    }

    @Test
    void endToEndTimerManualAndFinishAppearInCalendar() throws Exception {
        u = newUser("alice");
        long book = body(mvc.perform(POST(u, "/books", Map.of("title", "책", "totalPages", 100))).andReturn()).get("id").asLong();
        assertThat(days(cal(""))).isEmpty();
        // 어제 직접 기록
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 20, "daysAgo", 1)));
        // 1분 미만 스탠드는 날짜를 남기지 않는다
        long s0 = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofSeconds(30));
        mvc.perform(POST(u, "/sessions/" + s0 + "/stop", Map.of()));
        assertThat(days(cal(""))).containsExactly("2026-11-16");
        // 켜져 있는 동안에는 세지 않는다
        long s1 = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofMinutes(10));
        assertThat(days(cal(""))).containsExactly("2026-11-16");
        mvc.perform(POST(u, "/sessions/" + s1 + "/stop", Map.of()));
        assertThat(days(cal(""))).containsExactly("2026-11-16", "2026-11-17");
        assertThat(cal("").get("streak").asInt()).isEqualTo(2);
        // 완독
        clock.advance(Duration.ofDays(1));
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of("rating", 5)));
        JsonNode c = cal("");
        assertThat(days(c)).containsExactly("2026-11-16", "2026-11-17", "2026-11-18");
        assertThat(c.get("finishedCount").asInt()).isEqualTo(1);
        assertThat(c.get("streak").asInt()).isEqualTo(3);
    }

    @Test
    void othersRecordsAreNotMixedIn() throws Exception {
        setup();
        long other = newUser("bob");
        long old = u;
        u = other;
        dsl.execute("insert into book(user_id, title, status) values (?, 'x', 'READING')", u);
        session("DONE", "TIMER", "2026-11-16T05:00:00Z");
        u = old;
        assertThat(days(cal(""))).isEmpty();
        assertThat(cal("").get("streak").asInt()).isZero();
    }
}
