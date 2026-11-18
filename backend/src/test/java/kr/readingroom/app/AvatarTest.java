package kr.readingroom.app;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import org.junit.jupiter.api.Test;

class AvatarTest extends ApiTestBase {
    @Test
    void savesAllowedValuesAndFillsDefaults() throws Exception {
        long u = newUser("alice");
        mvc.perform(PUT(u, "/me/avatar", Map.of("color", "#ffd6e4", "expr", "happy", "head", "crown")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatar.color").value("#ffd6e4"))
                .andExpect(jsonPath("$.avatar.expr").value("happy"))
                .andExpect(jsonPath("$.avatar.head").value("crown"))
                .andExpect(jsonPath("$.avatar.face").value("none"))   // 누락 → 기본값
                .andExpect(jsonPath("$.avatar.prop").value("book"));
        mvc.perform(GET(u, "/me")).andExpect(jsonPath("$.avatar.color").value("#ffd6e4"));
    }

    @Test
    void unknownKeysAndValuesAreDropped() throws Exception {
        long u = newUser("alice");
        mvc.perform(PUT(u, "/me/avatar", Map.of("color", "#123456", "hair", "long", "style", "x", "expr", "wink", "prop", "sword")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatar.color").value("#f6f3ff"))  // 모르는 값 → 기본값
                .andExpect(jsonPath("$.avatar.expr").value("wink"))
                .andExpect(jsonPath("$.avatar.prop").value("book"))
                .andExpect(jsonPath("$.avatar.hair").doesNotExist())
                .andExpect(jsonPath("$.avatar.style").doesNotExist());
    }

    @Test
    void glassesNeedFirstBook() throws Exception {
        long u = newUser("alice");
        mvc.perform(PUT(u, "/me/avatar", Map.of("face", "glasses"))).andExpect(status().isBadRequest());
        mvc.perform(PUT(u, "/me/avatar", Map.of("face", "sunglasses"))).andExpect(status().isOk());
        mvc.perform(POST(u, "/books", Map.of("title", "첫 책")));
        mvc.perform(PUT(u, "/me/avatar", Map.of("face", "glasses")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatar.face").value("glasses"));
    }

    @Test
    void beanieNeedsTenFinishedBooks() throws Exception {
        long u = newUser("alice");
        for (int i = 0; i < 9; i++) dsl.execute("insert into book(user_id, title, status, finished_at) values (?, 'b', 'DONE', now())", u);
        dsl.execute("insert into book(user_id, title, status) values (?, 'x', 'DROPPED')", u);
        dsl.execute("insert into book(user_id, title, status) values (?, 'y', 'LATER')", u);
        mvc.perform(PUT(u, "/me/avatar", Map.of("head", "beanie"))).andExpect(status().isBadRequest());
        dsl.execute("insert into book(user_id, title, status, finished_at) values (?, 'b', 'DONE', now())", u);
        mvc.perform(PUT(u, "/me/avatar", Map.of("head", "beanie")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatar.head").value("beanie"));
    }
}
