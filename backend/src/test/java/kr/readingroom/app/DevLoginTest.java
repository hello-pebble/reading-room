package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** 개발용 로그인(dev 프로파일 전용): 구글 로그인과 같은 흐름으로 진짜 Bearer 토큰을 받는다. 화면 연결을 구글 없이 시작하려는 용도다. */
class DevLoginTest extends ApiTestBase {
    ResultActions login(String label) throws Exception {
        Map<String, Object> b = new HashMap<>();
        b.put("label", label);
        return mvc.perform(post("/dev/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(b)));
    }

    JsonNode ok(String label) throws Exception {
        return body(login(label).andExpect(status().isOk()).andReturn());
    }

    @Test
    void anAccountPerLabelWithARealBearerToken() throws Exception {
        JsonNode r = ok("alice");
        assertThat(r.get("newUser").asBoolean()).isTrue();
        assertThat(r.get("token").asText()).hasSizeGreaterThanOrEqualTo(40);
        assertThat(r.get("user").get("nickname").asText()).isEqualTo("손님");
        assertThat(r.get("user").get("needsNickname").asBoolean()).isTrue();
        assertThat(r.get("user").get("publicId").asText()).matches("[0-9a-f-]{36}");
        assertThat(dsl.fetchOne("select provider from auth_identity where provider_user_id = 'alice'").get(0, String.class)).isEqualTo("dev");

        String token = r.get("token").asText();
        mvc.perform(get("/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(r.get("user").get("id").asLong()));

        JsonNode again = ok("alice");                                       // 같은 이름으로 다시 들어오면 같은 계정
        assertThat(again.get("newUser").asBoolean()).isFalse();
        assertThat(again.get("user").get("publicId").asText()).isEqualTo(r.get("user").get("publicId").asText());
        assertThat(again.get("token").asText()).isNotEqualTo(token);        // 토큰은 새로 나온다

        JsonNode bob = ok("bob");                                           // 다른 이름은 다른 계정
        assertThat(bob.get("user").get("publicId").asText()).isNotEqualTo(r.get("user").get("publicId").asText());
        assertThat(dsl.fetchCount(dsl.selectFrom("app_user"))).isEqualTo(2);
    }

    @Test
    void theNicknameChosenAfterLoginSticksOnTheNextLogin() throws Exception {
        String token = ok("alice").get("token").asText();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/me/nickname").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"나무\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.needsNickname").value(false));
        JsonNode again = ok("alice");
        assertThat(again.get("user").get("nickname").asText()).isEqualTo("나무");
        assertThat(again.get("user").get("needsNickname").asBoolean()).isFalse();
    }

    @Test
    void sameLabelIsADifferentAccountThanTheSameGoogleSubject() throws Exception {
        ok("sub-1");
        dsl.execute("insert into app_user(nickname) values ('구글')");
        long g = dsl.fetchOne("select id from app_user where nickname = '구글'").get(0, Long.class);
        dsl.execute("insert into auth_identity(user_id, provider, provider_user_id) values (?, 'google', 'sub-1')", g);   // 같은 값이어도 제공자가 다르면 서로 다른 계정
        assertThat(dsl.fetchCount(dsl.selectFrom("auth_identity"))).isEqualTo(2);
    }

    @Test
    void badLabelsAreRejectedAndCreateNothing() throws Exception {
        for (String bad : new String[] {"", "   ", "x".repeat(41)}) {
            login(bad).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BAD_LABEL"));
        }
        login(null).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BAD_LABEL"));
        mvc.perform(post("/dev/login").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
        assertThat(dsl.fetchCount(dsl.selectFrom("app_user"))).isZero();
        assertThat(dsl.fetchCount(dsl.selectFrom("auth_session"))).isZero();
        ok(" alice ");                                                      // 앞뒤 공백은 다듬는다
        assertThat(dsl.fetchOne("select provider_user_id from auth_identity").get(0, String.class)).isEqualTo("alice");
    }
}
