package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import org.junit.jupiter.api.Test;

class ManualSessionTest extends ApiTestBase {
    long sofa(long u, int total, int cur) throws Exception {
        long id = body(mvc.perform(POST(u, "/books", Map.of("title", "책", "totalPages", total))).andReturn()).get("id").asLong();
        if (cur > 0) mvc.perform(PATCH(u, "/books/" + id, Map.of("currentPage", cur)));
        return id;
    }

    @Test
    void manualSavesNoonOfTodayOrYesterdayKst() throws Exception {
        long u = newUser("alice");
        long book = sofa(u, 300, 0);
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 45)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DONE")).andExpect(jsonPath("$.source").value("MANUAL"))
                .andExpect(jsonPath("$.endedBy").value("MANUAL")).andExpect(jsonPath("$.minutes").value(45))
                .andExpect(jsonPath("$.bookId").value(book))
                .andExpect(jsonPath("$.startedAt").value("2026-11-17T03:00:00Z"))   // 한국 시간 11/17 12:00
                .andExpect(jsonPath("$.endedAt").value("2026-11-17T03:45:00Z"));
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 30, "daysAgo", 1)))
                .andExpect(jsonPath("$.startedAt").value("2026-11-16T03:00:00Z"));
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 10, "date", "2026-11-10")))
                .andExpect(jsonPath("$.startedAt").value("2026-11-10T03:00:00Z"));
        // 한국 날짜 기준: UTC로는 아직 전날이어도 한국은 오늘이다
        clock.set("2026-11-17T16:30:00Z");   // 한국 11/18 01:30
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 5, "date", "2026-11-18"))).andExpect(status().isCreated());
        // 켜 둔 스탠드와 별개로 직접 기록은 따로 쌓인다
        assertThat(dsl.fetchCount(dsl.selectFrom("reading_session"))).isEqualTo(4);
    }

    @Test
    void invalidInputsAre400() throws Exception {
        long u = newUser("alice");
        sofa(u, 300, 0);
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 0))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", -5))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 601))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/sessions/manual", Map.of())).andExpect(status().isBadRequest());
        // 미래 날짜
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 10, "date", "2026-11-18"))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 10, "daysAgo", -1))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 10, "date", "내일"))).andExpect(status().isBadRequest());
        assertThat(dsl.fetchCount(dsl.selectFrom("reading_session"))).isZero();
    }

    @Test
    void needsReadingBook() throws Exception {
        long u = newUser("alice");
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 10))).andExpect(status().isBadRequest());
    }

    @Test
    void currentPageFollowsSameRuleAsStop() throws Exception {
        long u = newUser("alice");
        long book = sofa(u, 200, 100);
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 20, "endPage", 60, "memo", "밖에서")))
                .andExpect(jsonPath("$.endPage").value(60));
        assertThat(body(mvc.perform(GET(u, "/books/" + book)).andReturn()).get("currentPage").asInt()).isEqualTo(100);   // 줄지 않는다
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 20, "endPage", 150)));
        assertThat(body(mvc.perform(GET(u, "/books/" + book)).andReturn()).get("currentPage").asInt()).isEqualTo(150);
        mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 20, "endPage", 9000)));
        assertThat(body(mvc.perform(GET(u, "/books/" + book)).andReturn()).get("currentPage").asInt()).isEqualTo(200);   // 전체 쪽수 상한
        assertThat(body(mvc.perform(GET(u, "/books/" + book + "/notes")).andReturn())).hasSize(1);
    }

    @Test
    void idempotentWithKey() throws Exception {
        long u = newUser("alice");
        sofa(u, 100, 0);
        var a = mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 25)).header("Idempotency-Key", "m-1")).andExpect(status().isCreated()).andReturn();
        var b = mvc.perform(POST(u, "/sessions/manual", Map.of("minutes", 25)).header("Idempotency-Key", "m-1")).andExpect(status().isCreated()).andReturn();
        assertThat(body(b)).isEqualTo(body(a));
        assertThat(dsl.fetchCount(dsl.selectFrom("reading_session"))).isEqualTo(1);
    }
}
