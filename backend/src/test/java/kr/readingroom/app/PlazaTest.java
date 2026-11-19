package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Duration;
import java.util.Map;
import kr.readingroom.app.village.PlazaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** 마을 광장 채팅: 40자, 3초 3건·같은 글 제한, 24시간 보관 (기준 시각 2026-11-17T03:00:00Z) */
class PlazaTest extends ApiTestBase {
    @Autowired PlazaService plaza;

    void put(long uid, String text, String at) {
        dsl.execute("insert into plaza_message(user_id, content, created_at) values (?, ?, ?::timestamptz)", uid, text, at);
    }

    @Test
    void sendReturnsMessageAndLimitsToThreePerThreeSeconds() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "  안녕하세요  "))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("안녕하세요")).andExpect(jsonPath("$.publicId").value(publicId(a)))
                .andExpect(jsonPath("$.handle").doesNotExist()).andExpect(jsonPath("$.userId").doesNotExist())   // 핸들·내부 번호는 밖으로 나가지 않는다 (결정 #69)
                .andExpect(jsonPath("$.avatar.color").exists()).andExpect(jsonPath("$.createdAt").value("2026-11-17T03:00:00Z"));
        clock.advance(Duration.ofSeconds(1));
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "둘"))).andExpect(status().isCreated());
        clock.advance(Duration.ofSeconds(1));
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "셋"))).andExpect(status().isCreated());
        clock.advance(Duration.ofMillis(999));
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "넷"))).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.error").value("TOO_FAST"));
        mvc.perform(POST(b, "/plaza/messages", Map.of("content", "다른 사람은 바로"))).andExpect(status().isCreated());
        clock.advance(Duration.ofMillis(1));
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "3초 뒤"))).andExpect(status().isCreated());   // 첫 글이 창 밖으로 나갔다
    }

    @Test
    void sameTextInARowIsBlockedForThirtySeconds() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "ㅎㅇ"))).andExpect(status().isCreated());
        clock.advance(Duration.ofSeconds(4));
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", " ㅎㅇ "))).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("DUPLICATE_MESSAGE"));
        mvc.perform(POST(b, "/plaza/messages", Map.of("content", "ㅎㅇ"))).andExpect(status().isCreated());
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "ㅎㅇㅎㅇ"))).andExpect(status().isCreated());
        clock.advance(Duration.ofSeconds(4));
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "ㅎㅇ"))).andExpect(status().isCreated());       // 직전 글이 아니면 된다
        clock.advance(Duration.ofSeconds(29));
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "ㅎㅇ"))).andExpect(status().isConflict());
        clock.advance(Duration.ofSeconds(1));
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "ㅎㅇ"))).andExpect(status().isCreated());       // 30초가 지났다
        assertThat(dsl.fetchOne("select count(*) as n from plaza_message where user_id = ?", a).get("n", Long.class)).isEqualTo(4L);
    }

    @Test
    void plazaAndRoomChatsAreCountedSeparately() throws Exception {
        long a = newUser("alice");
        for (int i = 0; i < 3; i++) mvc.perform(POST(a, "/plaza/messages", Map.of("content", "광장 " + i))).andExpect(status().isCreated());
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "광장 4"))).andExpect(status().isTooManyRequests());
        var room = body(mvc.perform(POST(a, "/rooms", Map.of("kind", "OWN"))).andReturn()).get("id").asLong();
        mvc.perform(POST(a, "/rooms/" + room + "/agree", Map.of())).andExpect(status().isOk());
        mvc.perform(POST(a, "/rooms/" + room + "/messages", Map.of("content", "방 글"))).andExpect(status().isCreated());   // 광장에서 막혀도 공유방은 따로
    }

    @Test
    void contentMustBeOneToFortyCharacters() throws Exception {
        long a = newUser("alice");
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", ""))).andExpect(status().isBadRequest());
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "   "))).andExpect(status().isBadRequest());
        mvc.perform(POST(a, "/plaza/messages", Map.of("other", "x"))).andExpect(status().isBadRequest());
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "가".repeat(41)))).andExpect(status().isBadRequest());
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "가".repeat(40)))).andExpect(status().isCreated());
    }

    @Test
    void listIsOldestFirstLastThirtyWithinTwentyFourHours() throws Exception {
        long a = newUser("alice");
        put(a, "하루 전보다 오래됨", "2026-11-16T02:59:00Z");
        for (int i = 1; i <= 35; i++) put(a, "글" + i, "2026-11-17T01:00:" + String.format("%02d", i) + "Z");
        mvc.perform(GET(a, "/plaza/messages")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(30))
                .andExpect(jsonPath("$[0].content").value("글6")).andExpect(jsonPath("$[29].content").value("글35"));
        mvc.perform(GET(a, "/plaza/messages?since=2026-11-17T01:00:33Z")).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].content").value("글34")).andExpect(jsonPath("$[1].content").value("글35"));
        mvc.perform(GET(a, "/plaza/messages?since=2026-11-10T00:00:00Z")).andExpect(jsonPath("$.length()").value(30))
                .andExpect(jsonPath("$[0].content").value("글1"));
        mvc.perform(GET(a, "/plaza/messages?since=어제")).andExpect(status().isBadRequest());
    }

    @Test
    void purgeDeletesMessagesOlderThanTwentyFourHours() throws Exception {
        long a = newUser("alice");
        put(a, "오래됨", "2026-11-16T02:00:00Z");
        put(a, "경계", "2026-11-16T03:00:00Z");
        put(a, "최근", "2026-11-17T02:00:00Z");
        assertThat(plaza.purgeExpired()).isEqualTo(2);
        assertThat(dsl.fetchOne("select count(*) as n from plaza_message").get("n", Long.class)).isEqualTo(1L);
    }
}
