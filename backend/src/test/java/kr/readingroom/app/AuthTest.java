package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.Signature;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import kr.readingroom.app.auth.GoogleIdTokenVerifier;
import kr.readingroom.app.auth.GoogleKeys;
import kr.readingroom.app.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.ResultActions;

/** 구글 로그인과 Bearer 세션 토큰 (결정 #67·#68). 구글 키 대신 테스트가 만든 RSA 키로 ID 토큰을 서명한다. */
@TestPropertySource(properties = "app.auth.google-client-id=" + AuthTest.CLIENT)
@Import(AuthTest.KeysConfig.class)
class AuthTest extends ApiTestBase {
    static final String CLIENT = "test-client.apps.googleusercontent.com";
    static final KeyPair KEY = rsa(), OTHER = rsa();

    @TestConfiguration
    static class KeysConfig {
        /** kid "k1"만 알고 있는 가짜 구글 키 목록 */
        @Bean
        @Primary
        GoogleKeys googleKeys() {
            return kid -> "k1".equals(kid) ? KEY.getPublic() : null;
        }
    }

    static KeyPair rsa() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
            g.initialize(2048);
            return g.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String b64(byte[] b) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    String b64(Object o) throws Exception {
        return b64(json.writeValueAsBytes(o));
    }

    String rs256(String signingInput, PrivateKey key) throws Exception {
        Signature s = Signature.getInstance("SHA256withRSA");
        s.initSign(key);
        s.update(signingInput.getBytes(StandardCharsets.US_ASCII));
        return b64(s.sign());
    }

    Map<String, Object> claims(String sub) {
        long now = clock.instant().getEpochSecond();
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("iss", "https://accounts.google.com");
        c.put("aud", CLIENT);
        c.put("sub", sub);
        c.put("iat", now);
        c.put("exp", now + 3600);
        return c;
    }

    Map<String, Object> header() {
        return new LinkedHashMap<>(Map.of("alg", "RS256", "kid", "k1", "typ", "JWT"));
    }

    String token(Map<String, Object> header, Map<String, Object> claims, PrivateKey key) throws Exception {
        String input = b64(header) + "." + b64(claims);
        return input + "." + rs256(input, key);
    }

    String idToken(String sub) throws Exception {
        return token(header(), claims(sub), KEY.getPrivate());
    }

    ResultActions login(String idToken) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("idToken", idToken);
        return mvc.perform(post("/auth/google").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    JsonNode loginOk(String sub) throws Exception {
        return body(login(idToken(sub)).andExpect(status().isOk()).andReturn());
    }

    ResultActions me(String token) throws Exception {
        return mvc.perform(get("/me").header("Authorization", "Bearer " + token));
    }

    int users() {
        return dsl.fetchCount(dsl.selectFrom("app_user"));
    }

    @Test
    void firstLoginCreatesAUserWhoThenChoosesANickname() throws Exception {
        JsonNode r = loginOk("sub-1");
        assertThat(r.get("newUser").asBoolean()).isTrue();
        assertThat(r.get("expiresAt").asText()).isEqualTo("2026-12-17T03:00:00Z");       // 30일
        String token = r.get("token").asText();
        assertThat(token).hasSizeGreaterThanOrEqualTo(40);
        JsonNode user = r.get("user");
        long id = user.get("id").asLong();
        assertThat(user.get("publicId").asText()).matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}");   // 무작위 UUID (결정 #69)
        assertThat(user.has("handle")).isFalse();                                                                                    // 핸들은 없다
        assertThat(user.get("nickname").asText()).isEqualTo("손님");
        assertThat(user.get("needsNickname").asBoolean()).isTrue();
        assertThat(dsl.fetchOne("select user_id from auth_identity where provider = 'google' and provider_user_id = 'sub-1'").get(0, Long.class)).isEqualTo(id);

        me(token).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id)).andExpect(jsonPath("$.needsNickname").value(true));
        mvc.perform(put("/me/nickname").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"나무\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("나무")).andExpect(jsonPath("$.needsNickname").value(false));

        // 다시 로그인하면 같은 사용자이고 새 토큰이 나온다. 닉네임은 그대로다
        JsonNode again = loginOk("sub-1");
        assertThat(again.get("newUser").asBoolean()).isFalse();
        assertThat(again.get("user").get("id").asLong()).isEqualTo(id);
        assertThat(again.get("user").get("nickname").asText()).isEqualTo("나무");
        assertThat(again.get("user").get("needsNickname").asBoolean()).isFalse();
        String second = again.get("token").asText();
        assertThat(second).isNotEqualTo(token);
        me(token).andExpect(status().isOk());                                              // 다른 기기 토큰은 둘 다 유효
        me(second).andExpect(status().isOk());
        assertThat(users()).isEqualTo(1);
        // DB에는 토큰이 아니라 해시만 있다
        assertThat(dsl.fetchCount(dsl.selectFrom("auth_session"))).isEqualTo(2);
        assertThat(dsl.fetchOne("select count(*) as n from auth_session where token_hash = ? or token_hash = ?", token, second).get("n", Integer.class)).isZero();
    }

    @Test
    void differentGoogleAccountsAreDifferentUsers() throws Exception {
        long a = loginOk("sub-a").get("user").get("id").asLong(), b = loginOk("sub-b").get("user").get("id").asLong();
        assertThat(a).isNotEqualTo(b);
        assertThat(users()).isEqualTo(2);
    }

    @Test
    void badIdTokensAreRejectedAndCreateNoUser() throws Exception {
        long now = clock.instant().getEpochSecond();
        Map<String, Object> c;
        java.util.List<String> bad = new java.util.ArrayList<>();
        c = claims("s"); c.put("aud", "someone-else");                              bad.add(token(header(), c, KEY.getPrivate()));   // 다른 앱용
        c = claims("s"); c.put("aud", java.util.List.of(CLIENT));                   bad.add(token(header(), c, KEY.getPrivate()));   // aud는 문자열만
        c = claims("s"); c.put("iss", "https://evil.example");                      bad.add(token(header(), c, KEY.getPrivate()));
        c = claims("s"); c.put("iss", "accounts.google.com.evil.example");          bad.add(token(header(), c, KEY.getPrivate()));
        c = claims("s"); c.put("exp", now - 1);                                     bad.add(token(header(), c, KEY.getPrivate()));   // 만료
        c = claims("s"); c.put("exp", now);                                         bad.add(token(header(), c, KEY.getPrivate()));   // 정확히 지금도 만료
        c = claims("s"); c.remove("exp");                                           bad.add(token(header(), c, KEY.getPrivate()));
        c = claims("s"); c.remove("sub");                                           bad.add(token(header(), c, KEY.getPrivate()));
        c = claims("");                                                             bad.add(token(header(), c, KEY.getPrivate()));
        bad.add(token(header(), claims("s"), OTHER.getPrivate()));                                                               // 다른 키로 서명
        String good = idToken("victim");
        String[] parts = good.split("\\.");
        bad.add(parts[0] + "." + b64(claims("attacker")) + "." + parts[2]);                                                      // 내용만 바꿈
        Map<String, Object> none = header(); none.put("alg", "none");
        bad.add(b64(none) + "." + b64(claims("s")) + ".");                                                                       // alg none
        bad.add(b64(none) + "." + b64(claims("s")) + "." + parts[2]);
        Map<String, Object> hs = header(); hs.put("alg", "HS256");                                                               // 공개키를 비밀키처럼 쓰는 공격
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(KEY.getPublic().getEncoded(), "HmacSHA256"));
        String hsInput = b64(hs) + "." + b64(claims("s"));
        bad.add(hsInput + "." + b64(mac.doFinal(hsInput.getBytes(StandardCharsets.US_ASCII))));
        Map<String, Object> unknownKid = header(); unknownKid.put("kid", "nope");
        bad.add(token(unknownKid, claims("s"), KEY.getPrivate()));
        Map<String, Object> noKid = header(); noKid.remove("kid");
        bad.add(token(noKid, claims("s"), KEY.getPrivate()));
        bad.addAll(java.util.List.of("", "abc", "a.b", "a.b.c", "....", "x.y.z.w"));
        for (String t : bad) {
            login(t).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("INVALID_ID_TOKEN"));
        }
        login(null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("INVALID_ID_TOKEN"));              // idToken 없음
        mvc.perform(post("/auth/google").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        assertThat(users()).isZero();
        assertThat(dsl.fetchCount(dsl.selectFrom("auth_session"))).isZero();
        loginOk("victim");                                                                                                       // 올바른 토큰은 된다
    }

    @Test
    void withoutAClientIdTheVerifierSaysServiceUnavailable() throws Exception {
        ApiException e = assertThrows(ApiException.class, () -> new GoogleIdTokenVerifier("", kid -> KEY.getPublic(), clock).verify(idToken("s")));
        assertThat(e.status.value()).isEqualTo(503);
    }

    @Test
    void bearerTokensAreRequiredAndExpireAfterThirtyDays() throws Exception {
        String token = loginOk("sub-1").get("token").asText();
        mvc.perform(get("/me")).andExpect(status().isUnauthorized());
        me("garbage").andExpect(status().isUnauthorized());
        me("").andExpect(status().isUnauthorized());
        mvc.perform(get("/me").header("Authorization", token)).andExpect(status().isUnauthorized());                              // Bearer 접두어 없음
        mvc.perform(get("/me").header("Authorization", "Basic " + token)).andExpect(status().isUnauthorized());
        me(token).andExpect(status().isOk());
        clock.advance(Duration.ofDays(30).minusSeconds(1));
        me(token).andExpect(status().isOk());
        clock.advance(Duration.ofSeconds(1));
        me(token).andExpect(status().isUnauthorized());                                                                           // 정확히 30일 뒤 만료
        JsonNode again = loginOk("sub-1");                                                                                       // 다시 로그인하면 지난 세션도 정리된다
        assertThat(dsl.fetchCount(dsl.selectFrom("auth_session"))).isEqualTo(1);
        me(again.get("token").asText()).andExpect(status().isOk());
    }

    @Test
    void logoutEndsOnlyThatDevicesToken() throws Exception {
        String phone = loginOk("sub-1").get("token").asText(), pc = loginOk("sub-1").get("token").asText();
        mvc.perform(post("/auth/logout")).andExpect(status().isUnauthorized());
        mvc.perform(post("/auth/logout").header("Authorization", "Bearer " + phone)).andExpect(status().isNoContent());
        me(phone).andExpect(status().isUnauthorized());
        me(pc).andExpect(status().isOk());
        mvc.perform(post("/auth/logout").header("Authorization", "Bearer " + phone)).andExpect(status().isUnauthorized());      // 이미 끝난 토큰
    }

    @Test
    void theDevHeaderStillWorksUnderTheDevProfileSoOtherTestsKeepRunning() throws Exception {
        long id = newUser("alice");
        mvc.perform(get("/me").header("X-User-Id", id)).andExpect(status().isOk());
    }
}
