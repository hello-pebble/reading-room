package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 초대 없이 들어오는 방(공개, 결정 #101): 개설 때 고르고, 마을의 누구나 코드 없이 입장한다 */
class PublicRoomTest extends ApiTestBase {
    Map<String, Object> m(Object... kv) {
        Map<String, Object> b = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) b.put((String) kv[i], kv[i + 1]);
        return b;
    }

    @Test
    void publicRoomIsJoinableByEveryoneWithoutBeingInvited() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        long pub = body(mvc.perform(POST(a, "/rooms", m("kind", "OWN", "title", "누구나", "visibility", "PUBLIC"))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.visibility").value("PUBLIC")).andReturn()).get("id").asLong();
        mvc.perform(POST(a, "/rooms", m("kind", "OWN", "title", "초대만"))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.visibility").value("INVITE"));                          // 고르지 않으면 초대만
        var rooms = body(mvc.perform(GET(b, "/rooms")).andExpect(status().isOk()).andReturn());
        String code = null;
        for (var r : rooms) {
            if (r.get("title").asText().equals("누구나")) {
                code = r.get("inviteCode").asText();                                          // 공개 방은 입장에 쓰는 코드를 누구에게나 준다
                assertThat(r.get("joined").asBoolean()).isFalse();
            } else {
                assertThat(r.has("inviteCode") && !r.get("inviteCode").isNull()).as("초대만 방의 코드는 개설자만").isFalse();
            }
        }
        mvc.perform(POST(b, "/rooms/join", m("code", code))).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(pub));
    }

    @Test
    void unknownVisibilityIsRejected() throws Exception {
        long a = newUser("alice");
        mvc.perform(POST(a, "/rooms", m("kind", "OWN", "visibility", "SECRET"))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BAD_VISIBILITY"));
    }
}
