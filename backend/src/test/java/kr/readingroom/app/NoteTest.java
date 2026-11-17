package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NoteTest extends ApiTestBase {
    long book(long u, Map<String, Object> b) throws Exception {
        return body(mvc.perform(POST(u, "/books", b)).andReturn()).get("id").asLong();
    }

    @Test
    void memoWithLargerPageRaisesCurrentPageAndSmallerKeepsIt() throws Exception {
        long u = newUser("alice");
        long id = book(u, Map.of("title", "책", "totalPages", 200));
        mvc.perform(POST(u, "/books/" + id + "/notes", Map.of("type", "MEMO", "content", "좋다", "page", 80)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.currentPage").value(80)).andExpect(jsonPath("$.percent").value(40));
        // 더 작은 쪽을 적어도 현재 쪽은 줄지 않는다
        mvc.perform(POST(u, "/books/" + id + "/notes", Map.of("type", "QUOTE", "content", "인용", "page", 10)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.currentPage").value(80));
        // 쪽이 없으면 현재 쪽은 그대로
        mvc.perform(POST(u, "/books/" + id + "/notes", Map.of("content", "쪽 없음")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("MEMO")).andExpect(jsonPath("$.page").doesNotExist())
                .andExpect(jsonPath("$.currentPage").value(80));
        // 전체 쪽수를 넘는 쪽은 전체 쪽수까지만 올린다
        mvc.perform(POST(u, "/books/" + id + "/notes", Map.of("content", "끝", "page", 500)))
                .andExpect(jsonPath("$.currentPage").value(200)).andExpect(jsonPath("$.percent").value(100));
        assertThat(body(mvc.perform(GET(u, "/books/" + id)).andReturn()).get("currentPage").asInt()).isEqualTo(200);
    }

    @Test
    void validationAndOrdering() throws Exception {
        long u = newUser("alice");
        long id = book(u, Map.of("title", "책"));
        mvc.perform(POST(u, "/books/" + id + "/notes", Map.of("content", "  "))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/books/" + id + "/notes", Map.of("type", "OTHER", "content", "x"))).andExpect(status().isBadRequest());
        // 전체 쪽수가 없으면 쪽만큼 올라간다
        mvc.perform(POST(u, "/books/" + id + "/notes", Map.of("content", "첫", "page", 30))).andExpect(jsonPath("$.currentPage").value(30));
        clock.advance(Duration.ofMinutes(5));
        mvc.perform(POST(u, "/books/" + id + "/notes", Map.of("content", "둘", "page", -4))).andExpect(jsonPath("$.page").value(0));
        JsonNode list = body(mvc.perform(GET(u, "/books/" + id + "/notes")).andExpect(status().isOk()).andReturn());
        assertThat(list).hasSize(2);
        assertThat(list.get(0).get("content").asText()).isEqualTo("둘");   // 최신순
    }

    @Test
    void othersBookIs404() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        long id = book(a, Map.of("title", "책"));
        mvc.perform(POST(b, "/books/" + id + "/notes", Map.of("content", "x"))).andExpect(status().isNotFound());
        mvc.perform(GET(b, "/books/" + id + "/notes")).andExpect(status().isNotFound());
    }
}
