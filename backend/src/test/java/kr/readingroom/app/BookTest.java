package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.junit.jupiter.api.Test;

class BookTest extends ApiTestBase {
    long put(long uid, Map<String, Object> b) throws Exception {
        return body(mvc.perform(POST(uid, "/books", b)).andExpect(status().isCreated()).andReturn()).get("id").asLong();
    }

    @Test
    void createPutsBookOnSofaAndOnlyOneReadingAllowed() throws Exception {
        long u = newUser("alice");
        mvc.perform(POST(u, "/books", Map.of("title", "데미안", "author", "헤세", "totalPages", 200, "isbn", "9788937460449")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("READING"))
                .andExpect(jsonPath("$.currentPage").value(0))
                .andExpect(jsonPath("$.percent").value(0))
                .andExpect(jsonPath("$.startedAt").exists());
        mvc.perform(POST(u, "/books", Map.of("title", "두번째"))).andExpect(status().isConflict());
        // 다른 사용자는 따로 올릴 수 있다
        put(newUser("bob"), Map.of("title", "다른 책"));
        // 제목이 없으면 400
        mvc.perform(POST(newUser("carol"), "/books", Map.of("author", "x"))).andExpect(status().isBadRequest());
    }

    @Test
    void currentPageNeverDecreasesAndPercentIsServerComputed() throws Exception {
        long u = newUser("alice");
        long id = put(u, Map.of("title", "책", "totalPages", 300));
        mvc.perform(PATCH(u, "/books/" + id, Map.of("currentPage", 150)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.currentPage").value(150)).andExpect(jsonPath("$.percent").value(50));
        // 줄이면 무시
        mvc.perform(PATCH(u, "/books/" + id, Map.of("currentPage", 40)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.currentPage").value(150)).andExpect(jsonPath("$.percent").value(50));
        mvc.perform(PATCH(u, "/books/" + id, Map.of("currentPage", -5)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.currentPage").value(150));
        // 더 작은 값(100)을 다시 보내도 150쪽·50% 그대로
        mvc.perform(PATCH(u, "/books/" + id, Map.of("currentPage", 100))).andExpect(jsonPath("$.percent").value(50));
    }

    @Test
    void totalPagesRangeAndOverTotalCapsPercent() throws Exception {
        long u = newUser("alice");
        long id = put(u, Map.of("title", "책"));
        // 전체 쪽수가 없으면 percent는 null
        mvc.perform(PATCH(u, "/books/" + id, Map.of("currentPage", 30)))
                .andExpect(jsonPath("$.totalPages").doesNotExist()).andExpect(jsonPath("$.percent").doesNotExist());
        mvc.perform(PATCH(u, "/books/" + id, Map.of("totalPages", 100)))
                .andExpect(jsonPath("$.totalPages").value(100)).andExpect(jsonPath("$.percent").value(30));
        // 현재 쪽이 전체보다 크면 100%로 계산한다
        mvc.perform(PATCH(u, "/books/" + id, Map.of("currentPage", 130)))
                .andExpect(jsonPath("$.currentPage").value(130)).andExpect(jsonPath("$.percent").value(100));
        // 상한 9999, 0·음수는 비운 것
        mvc.perform(PATCH(u, "/books/" + id, Map.of("totalPages", 50000))).andExpect(jsonPath("$.totalPages").value(9999));
        mvc.perform(PATCH(u, "/books/" + id, Map.of("totalPages", 0))).andExpect(jsonPath("$.totalPages").doesNotExist());
        mvc.perform(PATCH(u, "/books/" + id, Map.of("totalPages", -3))).andExpect(jsonPath("$.totalPages").doesNotExist());
        mvc.perform(PATCH(u, "/books/" + id, Map.of("currentPage", "abc"))).andExpect(status().isBadRequest());
    }

    @Test
    void listFiltersByStatusAndHidesOthersBooks() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        long id = put(a, Map.of("title", "앨리스 책"));
        dsl.execute("insert into book(user_id, title, status, finished_at) values (?, '다 읽음', 'DONE', now())", a);
        dsl.execute("insert into book(user_id, title, status) values (?, '나중에', 'LATER')", a);
        JsonNode reading = body(mvc.perform(GET(a, "/books?status=READING")).andExpect(status().isOk()).andReturn());
        assertThat(reading).hasSize(1);
        assertThat(reading.get(0).get("title").asText()).isEqualTo("앨리스 책");
        assertThat(body(mvc.perform(GET(a, "/books?status=DONE")).andReturn())).hasSize(1);
        assertThat(body(mvc.perform(GET(a, "/books")).andReturn())).hasSize(3);
        assertThat(body(mvc.perform(GET(b, "/books")).andReturn())).isEmpty();
        mvc.perform(GET(a, "/books?status=WRONG")).andExpect(status().isBadRequest());
        // 남의 책은 404
        mvc.perform(GET(b, "/books/" + id)).andExpect(status().isNotFound());
        mvc.perform(PATCH(b, "/books/" + id, Map.of("currentPage", 5))).andExpect(status().isNotFound());
    }
}
