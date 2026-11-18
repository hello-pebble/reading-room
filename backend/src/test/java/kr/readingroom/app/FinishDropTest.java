package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FinishDropTest extends ApiTestBase {
    long u, book;

    void sofa(int total) throws Exception {
        u = newUser("alice");
        book = body(mvc.perform(POST(u, "/books", Map.of("title", "책", "totalPages", total))).andReturn()).get("id").asLong();
    }

    JsonNode book() throws Exception {
        return body(mvc.perform(GET(u, "/books/" + book)).andReturn());
    }

    @Test
    void finishSavesRatingReviewAndSurvivesReload() throws Exception {
        sofa(200);
        clock.advance(Duration.ofDays(1));
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of("rating", 4, "oneLineReview", "  또 읽고 싶다  ")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE")).andExpect(jsonPath("$.rating").value(4))
                .andExpect(jsonPath("$.finishedAt").value("2026-11-18T03:00:00Z"));
        // 저장 후 사라지지 않는다 (Codex QA 결함 재발 방지)
        assertThat(book().get("rating").asInt()).isEqualTo(4);
        assertThat(book().get("oneLineReview").asText()).isEqualTo("또 읽고 싶다");
        JsonNode done = body(mvc.perform(GET(u, "/books?status=DONE")).andReturn());
        assertThat(done.get(0).get("rating").asInt()).isEqualTo(4);
        assertThat(done.get(0).get("oneLineReview").asText()).isEqualTo("또 읽고 싶다");
        // 다시 보내도 그대로
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of("rating", 1))).andExpect(jsonPath("$.rating").value(4));
        // 소파가 비었으니 새 책을 올릴 수 있다
        mvc.perform(POST(u, "/books", Map.of("title", "다음 책"))).andExpect(status().isCreated());
    }

    @Test
    void ratingIsOptionalAndValidated() throws Exception {
        sofa(200);
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of("rating", 6))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of("rating", 0)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rating").doesNotExist()).andExpect(jsonPath("$.oneLineReview").doesNotExist());
    }

    @Test
    void finishNeverKeepsCurrentPageAboveTotal() throws Exception {
        sofa(200);
        mvc.perform(PATCH(u, "/books/" + book, Map.of("currentPage", 250)));   // PATCH는 그대로 저장 (percent만 100으로 막는다)
        assertThat(book().get("currentPage").asInt()).isEqualTo(250);
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of())).andExpect(jsonPath("$.currentPage").value(200)).andExpect(jsonPath("$.percent").value(100));
        assertThat(book().get("currentPage").asInt()).isEqualTo(200);
    }

    @Test
    void finishStopsRunningSessionAndRecordsIt() throws Exception {
        sofa(200);
        long sid = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofMinutes(42));
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of("rating", 5))).andExpect(status().isOk());
        var s = dsl.fetchOne("select status, ended_by, extract(epoch from ended_at - started_at)::int as sec from reading_session where id = ?", sid);
        assertThat(s.get("status", String.class)).isEqualTo("DONE");
        assertThat(s.get("ended_by", String.class)).isEqualTo("FINISH");
        assertThat(s.get("sec", Integer.class)).isEqualTo(42 * 60);
        mvc.perform(GET(u, "/sessions/current")).andExpect(jsonPath("$.session").value((Object) null));
    }

    @Test
    void shortSessionIsDiscardedQuietlyOnFinish() throws Exception {
        sofa(200);
        long sid = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofSeconds(30));
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of())).andExpect(status().isOk());
        assertThat(dsl.fetchOne("select status from reading_session where id = ?", sid).get(0, String.class)).isEqualTo("DISCARDED");
    }

    @Test
    void needsConfirmSessionBlocksFinishAndDrop() throws Exception {
        sofa(200);
        long sid = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofHours(4));
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of())).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("NEEDS_CONFIRM"));
        mvc.perform(POST(u, "/books/" + book + "/drop", Map.of())).andExpect(status().isConflict());
        assertThat(book().get("status").asText()).isEqualTo("READING");
        // 확인 뒤에는 된다
        mvc.perform(POST(u, "/sessions/" + sid + "/confirm", Map.of("discard", true))).andExpect(status().isOk());
        mvc.perform(POST(u, "/books/" + book + "/finish", Map.of())).andExpect(status().isOk());
    }

    @Test
    void dropMovesBookToDroppedAndKeepsNotes() throws Exception {
        sofa(200);
        mvc.perform(POST(u, "/books/" + book + "/notes", Map.of("content", "남는 메모", "page", 10)));
        long sid = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofMinutes(10));
        mvc.perform(POST(u, "/books/" + book + "/drop", Map.of())).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DROPPED"));
        assertThat(body(mvc.perform(GET(u, "/books?status=DROPPED")).andReturn())).hasSize(1);
        assertThat(body(mvc.perform(GET(u, "/books/" + book + "/notes")).andReturn())).hasSize(1);
        assertThat(dsl.fetchOne("select status from reading_session where id = ?", sid).get(0, String.class)).isEqualTo("DONE");
        // 소파가 비어 새 책을 올릴 수 있다
        mvc.perform(POST(u, "/books", Map.of("title", "다음 책"))).andExpect(status().isCreated());
    }

    @Test
    void laterAndOtherUsersBooksCannotBeFinished() throws Exception {
        sofa(200);
        long later = dsl.fetchOne("insert into book(user_id, title, status) values (?, '나중에', 'LATER') returning id", u).get(0, Long.class);
        mvc.perform(POST(u, "/books/" + later + "/finish", Map.of())).andExpect(status().isConflict());
        mvc.perform(POST(u, "/books/" + later + "/drop", Map.of())).andExpect(status().isConflict());
        mvc.perform(POST(newUser("bob"), "/books/" + book + "/finish", Map.of())).andExpect(status().isNotFound());
        mvc.perform(POST(newUser("carol"), "/books/" + book + "/drop", Map.of())).andExpect(status().isNotFound());
    }
}
