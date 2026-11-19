package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** 사용자를 가리키는 공개 번호는 무작위 UUID이고, 핸들과 내부 숫자 id는 다른 사람에게 보이지 않는다 (결정 #69). */
class PublicIdTest extends ApiTestBase {
    static final String UUID_V4 = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

    @Test
    void everyUserGetsADifferentRandomUuidThatNeverChanges() throws Exception {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 20; i++) {
            long id = newUser("u" + i);
            String p = body(mvc.perform(GET(id, "/me")).andExpect(status().isOk()).andReturn()).get("publicId").asText();
            assertThat(p).matches(UUID_V4);
            assertThat(seen.add(p)).isTrue();                                          // 모두 다르다 (무작위 v4라 순번이 아니다)
            assertThat(publicId(id)).isEqualTo(p);
            mvc.perform(GET(id, "/me")).andExpect(jsonPath("$.publicId").value(p));    // 다시 불러도 같다
        }
    }

    @Test
    void otherPeopleSeeOnlyThePublicIdOnPlazaMessages() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        mvc.perform(POST(a, "/plaza/messages", Map.of("content", "안녕"))).andExpect(status().isCreated());
        JsonNode list = body(mvc.perform(GET(b, "/plaza/messages")).andExpect(status().isOk()).andReturn());
        assertThat(list).hasSize(1);
        JsonNode m = list.get(0);
        assertThat(m.get("publicId").asText()).isEqualTo(publicId(a));
        assertThat(m.has("userId")).isFalse();
        assertThat(m.has("handle")).isFalse();
    }

    @Test
    void aHouseIsFoundByThePublicIdAndKeepsItsAddressWhenTheNicknameChanges() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        String house = "/neighbors/" + publicId(b);
        mvc.perform(GET(a, house)).andExpect(status().isOk()).andExpect(jsonPath("$.publicId").value(publicId(b))).andExpect(jsonPath("$.nickname").value("bobby"));
        mvc.perform(GET(a, "/neighbors/bobby")).andExpect(status().isNotFound());                  // 닉네임은 주소가 아니다
        mvc.perform(GET(a, "/neighbors/" + b)).andExpect(status().isNotFound());                   // 내부 숫자 id도 주소가 아니다
        mvc.perform(PUT(b, "/me/nickname", Map.of("nickname", "나무"))).andExpect(status().isOk());
        mvc.perform(GET(a, house)).andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("나무"));   // 닉네임을 바꿔도 주소는 그대로
    }
}
