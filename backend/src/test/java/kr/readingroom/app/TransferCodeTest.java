package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 기기 이전 코드(결정 #85): 로그인한 기기가 일회용 코드를 만들고(10분), 다른 기기가 그 코드로 같은 계정에 들어온다.
 * 코드 원문은 저장하지 않고 SHA-256만 둔다. 코드 입력은 IP당 시도 횟수를 제한한다.
 */
class TransferCodeTest extends ApiTestBase {
    static final String OLD_KEY = "k3Jx9QbT1mZp0VwL8sNd2RfHyU6aCeG4tYoXiBq5MnA";
    static final String NEW_KEY = "Zr7WcP2dFgH9jKlM3nBvXqS5tYuI1oAe8LkDxQ0mNbV";
    static final String CODE_FORMAT = "[A-HJ-NP-Z2-9]{8}"; // I O 0 1 제외

    JsonNode guest(String key) throws Exception {
        Map<String, Object> b = new HashMap<>();
        b.put("deviceKey", key);
        return body(mvc.perform(post("/auth/guest").with(r -> { r.setRemoteAddr("10.0.0.1"); return r; })
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(b))).andExpect(status().isOk()).andReturn());
    }

    ResultActions issue(String token) throws Exception {
        return mvc.perform(post("/me/transfer-code").header("Authorization", "Bearer " + token));
    }

    ResultActions redeem(String code, String key, String ip) throws Exception {
        Map<String, Object> b = new HashMap<>();
        b.put("code", code);
        b.put("deviceKey", key);
        return mvc.perform(post("/auth/transfer").with(r -> { r.setRemoteAddr(ip); return r; })
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(b)));
    }

    String issued(String token) throws Exception {
        return body(issue(token).andExpect(status().isOk()).andReturn()).get("code").asText();
    }

    @Test
    void issuingNeedsALoginAndGivesAShortCodeThatExpiresInTenMinutes() throws Exception {
        mvc.perform(post("/me/transfer-code")).andExpect(status().isUnauthorized());
        String token = guest(OLD_KEY).get("token").asText();
        JsonNode r = body(issue(token).andExpect(status().isOk()).andReturn());
        assertThat(r.get("code").asText()).matches(CODE_FORMAT);
        assertThat(r.get("expiresAt").asText()).isEqualTo(clock.instant().plus(Duration.ofMinutes(10)).toString());
        var row = dsl.fetchOne("select code_hash from transfer_code");
        assertThat(row.get(0, String.class)).hasSize(64).matches("[0-9a-f]{64}").isNotEqualTo(r.get("code").asText());
    }

    @Test
    void aNewCodeReplacesTheOldOneOfTheSameAccount() throws Exception {
        String token = guest(OLD_KEY).get("token").asText();
        String first = issued(token), second = issued(token);
        assertThat(second).isNotEqualTo(first);
        assertThat(dsl.fetchCount(dsl.selectFrom("transfer_code"))).isEqualTo(1);
        redeem(first, NEW_KEY, "10.0.0.2").andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("INVALID_CODE"));
        redeem(second, NEW_KEY, "10.0.0.2").andExpect(status().isOk());
    }

    @Test
    void theOtherDeviceEntersTheSameAccountAndTheOldDeviceKeepsWorking() throws Exception {
        JsonNode old = guest(OLD_KEY);
        String code = issued(old.get("token").asText());

        JsonNode moved = body(redeem(code, NEW_KEY, "10.0.0.2").andExpect(status().isOk()).andReturn());
        assertThat(moved.get("user").get("publicId").asText()).isEqualTo(old.get("user").get("publicId").asText());
        assertThat(moved.get("newUser").asBoolean()).isFalse();
        mvc.perform(get("/me").header("Authorization", "Bearer " + moved.get("token").asText())).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(old.get("user").get("id").asLong()));

        assertThat(guest(NEW_KEY).get("user").get("publicId").asText()).isEqualTo(old.get("user").get("publicId").asText()); // 새 기기는 이제 이 계정이다
        assertThat(guest(OLD_KEY).get("user").get("publicId").asText()).isEqualTo(old.get("user").get("publicId").asText()); // 예전 기기도 그대로
        assertThat(dsl.fetchCount(dsl.selectFrom("auth_identity").where("user_id = ?", old.get("user").get("id").asLong()))).isEqualTo(2);
    }

    @Test
    void aCodeWorksOnlyOnceAndNotAfterTenMinutes() throws Exception {
        String token = guest(OLD_KEY).get("token").asText();
        String code = issued(token);
        redeem(code, NEW_KEY, "10.0.0.2").andExpect(status().isOk());
        redeem(code, "Third-device-key-" + "x".repeat(30), "10.0.0.2").andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("INVALID_CODE"));

        String late = issued(token);
        clock.advance(Duration.ofMinutes(10).plusSeconds(1));
        redeem(late, "Fourth-device-key-" + "x".repeat(30), "10.0.0.2").andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("INVALID_CODE"));
    }

    @Test
    void theCodeIgnoresCaseSpacesAndHyphensButAMalformedOneIsRejected() throws Exception {
        String code = issued(guest(OLD_KEY).get("token").asText());
        String typed = (code.substring(0, 4) + "-" + code.substring(4)).toLowerCase();
        redeem(" " + typed + " ", NEW_KEY, "10.0.0.2").andExpect(status().isOk());
        for (String bad : new String[] {null, "", "ABC", "ABCDEFGHJK", "AB!DEFGH", "ABCDEFGO", "ABCDEFG1"})   // 짧음·김·기호·O·1
            redeem(bad, NEW_KEY, "10.0.0.3").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BAD_CODE"));
        redeem("ABCDEFGH", "short", "10.0.0.3").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BAD_DEVICE_KEY"));
    }

    /** 새 기기가 이미 게스트로 시작해 빈 계정을 만들어 둔 경우: 그 기기 키가 코드의 계정으로 옮겨 가고, 빈 계정은 더 이상 로그인할 수 없다 */
    @Test
    void aDeviceThatAlreadyStartedAsAnotherGuestMovesOverToTheCodesAccount() throws Exception {
        JsonNode account = guest(OLD_KEY);
        JsonNode stray = guest(NEW_KEY);                                      // 새 기기가 먼저 자동으로 시작했다
        assertThat(stray.get("user").get("publicId").asText()).isNotEqualTo(account.get("user").get("publicId").asText());
        String code = issued(account.get("token").asText());

        JsonNode moved = body(redeem(code, NEW_KEY, "10.0.0.2").andExpect(status().isOk()).andReturn());
        assertThat(moved.get("user").get("publicId").asText()).isEqualTo(account.get("user").get("publicId").asText());
        assertThat(guest(NEW_KEY).get("user").get("publicId").asText()).isEqualTo(account.get("user").get("publicId").asText());
        assertThat(dsl.fetchCount(dsl.selectFrom("auth_identity").where("user_id = ?", stray.get("user").get("id").asLong()))).isZero();
    }

    @Test
    void redeemingNeedsNoTokenEvenWhenAStaleOneIsSent() throws Exception {
        String code = issued(guest(OLD_KEY).get("token").asText());
        mvc.perform(post("/auth/transfer").header("Authorization", "Bearer 만료된토큰").contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"" + code + "\",\"deviceKey\":\"" + NEW_KEY + "\"}")).andExpect(status().isOk());
    }

    /** 코드 맞추기를 막는다: IP당 10분에 10번까지(맞든 틀리든 센다) */
    @Test
    void attemptsPerIpAreLimited() throws Exception {
        for (int i = 0; i < 10; i++) redeem("ABCDEFGH", NEW_KEY, "10.7.7.7").andExpect(status().isNotFound());
        redeem("ABCDEFGH", NEW_KEY, "10.7.7.7").andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.error").value("TOO_MANY_ATTEMPTS"));
        redeem("ABCDEFGH", NEW_KEY, "10.6.6.6").andExpect(status().isNotFound());                   // 다른 IP는 따로 센다
        clock.advance(Duration.ofMinutes(10).plusSeconds(1));
        redeem("ABCDEFGH", NEW_KEY, "10.7.7.7").andExpect(status().isNotFound());                   // 시간이 지나면 다시 시도할 수 있다
    }
}
