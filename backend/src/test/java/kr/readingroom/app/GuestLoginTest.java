package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 게스트 로그인(결정 #84): 가입 없이 시작한다. 기기가 만든 무작위 키(deviceKey)로 같은 기기는 같은 계정이 된다.
 * 서버에는 키 원문이 아니라 SHA-256만 남기고, 응답은 구글 로그인과 같다. 새 계정 만들기만 IP당 시간당 횟수를 제한한다.
 */
class GuestLoginTest extends ApiTestBase {
    static final String KEY_A = "k3Jx9QbT1mZp0VwL8sNd2RfHyU6aCeG4tYoXiBq5MnA"; // 43자, base64url 모양
    static final String KEY_B = "Zr7WcP2dFgH9jKlM3nBvXqS5tYuI1oAe8LkDxQ0mNbV";

    ResultActions guest(String key, String ip) throws Exception {
        Map<String, Object> b = new HashMap<>();
        if (key != null) b.put("deviceKey", key);
        return mvc.perform(post("/auth/guest").with(r -> { r.setRemoteAddr(ip); return r; })
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(b)));
    }

    JsonNode ok(String key) throws Exception {
        return body(guest(key, "10.0.0.1").andExpect(status().isOk()).andReturn());
    }

    @Test
    void theSameDeviceKeyIsTheSameAccountAndADifferentKeyIsAnotherOne() throws Exception {
        JsonNode first = ok(KEY_A);
        assertThat(first.get("newUser").asBoolean()).isTrue();
        assertThat(first.get("token").asText()).hasSizeGreaterThanOrEqualTo(40);
        assertThat(first.get("user").get("nickname").asText()).isEqualTo("손님");
        assertThat(first.get("user").get("needsNickname").asBoolean()).isTrue();
        assertThat(first.get("user").get("publicId").asText()).matches("[0-9a-f-]{36}");

        String token = first.get("token").asText();
        mvc.perform(get("/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(first.get("user").get("id").asLong()));

        JsonNode again = ok(KEY_A);                                          // 토큰이 만료돼도 같은 기기 키로 같은 계정에 다시 들어온다
        assertThat(again.get("newUser").asBoolean()).isFalse();
        assertThat(again.get("user").get("publicId").asText()).isEqualTo(first.get("user").get("publicId").asText());
        assertThat(again.get("token").asText()).isNotEqualTo(token);

        JsonNode other = ok(KEY_B);
        assertThat(other.get("user").get("publicId").asText()).isNotEqualTo(first.get("user").get("publicId").asText());
        assertThat(dsl.fetchCount(dsl.selectFrom("app_user"))).isEqualTo(2);
    }

    @Test
    void theServerKeepsOnlyAHashOfTheDeviceKey() throws Exception {
        ok(KEY_A);
        var row = dsl.fetchOne("select provider, provider_user_id from auth_identity");
        assertThat(row.get("provider", String.class)).isEqualTo("guest");
        String stored = row.get("provider_user_id", String.class);
        assertThat(stored).isNotEqualTo(KEY_A).hasSize(64).matches("[0-9a-f]{64}");
        assertThat(dsl.fetchCount(dsl.selectFrom("auth_identity").where("provider_user_id like ?", "%" + KEY_A + "%"))).isZero();
    }

    @Test
    void theNicknameChosenLaterSticksWhenTheSameDeviceComesBack() throws Exception {
        String token = ok(KEY_A).get("token").asText();
        mvc.perform(put("/me/nickname").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"나무\"}"))
                .andExpect(status().isOk());
        JsonNode again = ok(KEY_A);
        assertThat(again.get("user").get("nickname").asText()).isEqualTo("나무");
        assertThat(again.get("user").get("needsNickname").asBoolean()).isFalse();
    }

    @Test
    void aMissingOrMalformedDeviceKeyIsRejected() throws Exception {
        for (String bad : new String[] {null, "", "short", "x".repeat(129), "공백이 있는 키 ".repeat(5), "has space in it 0123456789 0123456789 0123456789"})
            guest(bad, "10.0.0.1").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BAD_DEVICE_KEY"));
        assertThat(dsl.fetchCount(dsl.selectFrom("app_user"))).isZero();
    }

    @Test
    void theGuestLoginNeedsNoTokenEvenWhenAStaleOneIsSent() throws Exception {
        mvc.perform(post("/auth/guest").header("Authorization", "Bearer 만료된토큰").contentType(MediaType.APPLICATION_JSON)
                .content("{\"deviceKey\":\"" + KEY_A + "\"}")).andExpect(status().isOk());
    }

    /** 새 계정 만들기는 IP당 시간당 30개까지(기본값). 이미 있는 기기 키로 다시 들어오는 것과 다른 IP는 막지 않는다. */
    @Test
    void newAccountsPerIpAreLimitedButReturningDevicesAndOtherIpsAreNot() throws Exception {
        for (int i = 0; i < 30; i++) guest(String.format("limit-key-%02d-", i) + "a".repeat(30), "10.9.9.9").andExpect(status().isOk());
        guest("limit-key-31-" + "a".repeat(30), "10.9.9.9").andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.error").value("TOO_MANY_GUESTS"));
        guest("limit-key-00-" + "a".repeat(30), "10.9.9.9").andExpect(status().isOk());      // 이미 만든 기기는 다시 들어올 수 있다
        guest("limit-key-31-" + "a".repeat(30), "10.8.8.8").andExpect(status().isOk());      // 다른 IP는 따로 센다
        clock.advance(Duration.ofHours(1).plusSeconds(1));
        guest("limit-key-32-" + "a".repeat(30), "10.9.9.9").andExpect(status().isOk());      // 한 시간이 지나면 다시 만들 수 있다
    }
}
