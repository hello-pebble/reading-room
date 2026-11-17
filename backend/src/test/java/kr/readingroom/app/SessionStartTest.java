package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SessionStartTest extends ApiTestBase {
    long sofa(long u, int cur) throws Exception {
        long id = body(mvc.perform(POST(u, "/books", Map.of("title", "책", "totalPages", 300))).andReturn()).get("id").asLong();
        mvc.perform(PATCH(u, "/books/" + id, Map.of("currentPage", cur)));
        return id;
    }

    @Test
    void startNeedsReadingBook() throws Exception {
        long u = newUser("alice");
        mvc.perform(POST(u, "/sessions/start", Map.of())).andExpect(status().isBadRequest());
    }

    @Test
    void startUsesServerTimeAndSecondStartIs409WithExistingSession() throws Exception {
        long u = newUser("alice");
        long book = sofa(u, 42);
        JsonNode s = body(mvc.perform(POST(u, "/sessions/start", Map.of("startedAt", "1999-01-01T00:00:00Z", "elapsed", 99999)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("RUNNING"))
                .andExpect(jsonPath("$.source").value("TIMER"))
                .andExpect(jsonPath("$.bookId").value(book))
                .andExpect(jsonPath("$.startPage").value(42)).andReturn());
        // 클라이언트가 보낸 시각·경과는 무시, 서버 시각(고정 Clock)이 들어간다
        assertThat(s.get("startedAt").asText()).isEqualTo("2026-11-17T03:00:00Z");
        mvc.perform(POST(u, "/sessions/start", Map.of()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.session.id").value(s.get("id").asLong()))
                .andExpect(jsonPath("$.session.status").value("RUNNING"));
        assertThat(dsl.fetchCount(dsl.selectFrom("reading_session"))).isEqualTo(1);
    }

    @Test
    void currentReturnsSessionAndServerNow() throws Exception {
        long u = newUser("alice");
        mvc.perform(GET(u, "/sessions/current"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.session").value((Object) null))
                .andExpect(jsonPath("$.serverNow").value("2026-11-17T03:00:00Z"));
        sofa(u, 0);
        mvc.perform(POST(u, "/sessions/start", Map.of()));
        clock.advance(Duration.ofMinutes(7));
        mvc.perform(GET(u, "/sessions/current"))
                .andExpect(jsonPath("$.session.status").value("RUNNING"))
                .andExpect(jsonPath("$.session.startedAt").value("2026-11-17T03:00:00Z"))
                .andExpect(jsonPath("$.serverNow").value("2026-11-17T03:07:00Z"));
        // 남의 세션은 보이지 않는다
        mvc.perform(GET(newUser("bob"), "/sessions/current")).andExpect(jsonPath("$.session").value((Object) null));
    }

    @Test
    void idempotencyKeyReplaysSameResultWithoutDuplicates() throws Exception {
        long u = newUser("alice");
        sofa(u, 0);
        var first = mvc.perform(POST(u, "/sessions/start", Map.of()).header("Idempotency-Key", "k-1")).andExpect(status().isCreated()).andReturn();
        clock.advance(Duration.ofMinutes(3));
        var again = mvc.perform(POST(u, "/sessions/start", Map.of()).header("Idempotency-Key", "k-1")).andExpect(status().isCreated()).andReturn();
        assertThat(body(again)).isEqualTo(body(first));
        assertThat(dsl.fetchCount(dsl.selectFrom("reading_session"))).isEqualTo(1);
        // 같은 키를 다른 경로에 쓰면 422
        mvc.perform(POST(u, "/books", Map.of("title", "x")).header("Idempotency-Key", "k-1")).andExpect(status().isUnprocessableEntity());
        // 다른 사용자의 같은 키는 별개
        long b = newUser("bob");
        sofa(b, 0);
        mvc.perform(POST(b, "/sessions/start", Map.of()).header("Idempotency-Key", "k-1")).andExpect(status().isCreated());
    }

    @Test
    void bookPostIsIdempotentToo() throws Exception {
        long u = newUser("alice");
        var a = mvc.perform(POST(u, "/books", Map.of("title", "책")).header("Idempotency-Key", "b-1")).andExpect(status().isCreated()).andReturn();
        var b = mvc.perform(POST(u, "/books", Map.of("title", "책")).header("Idempotency-Key", "b-1")).andExpect(status().isCreated()).andReturn();
        assertThat(body(b)).isEqualTo(body(a));
        assertThat(dsl.fetchCount(dsl.selectFrom("book"))).isEqualTo(1);
    }
}
