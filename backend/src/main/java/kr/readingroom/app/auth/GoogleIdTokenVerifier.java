package kr.readingroom.app.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.PublicKey;
import java.security.Signature;
import java.time.Clock;
import java.util.Base64;
import java.util.Set;
import kr.readingroom.app.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 구글 ID 토큰(JWT)을 확인하고 구글 계정 고유 ID(sub)를 돌려준다 (결정 #67).
 * 받아들이는 것: RS256 서명(구글 공개키, kid로 선택), iss가 구글, aud가 우리 클라이언트 ID(문자열), 만료 전(exp > 지금), sub가 있음.
 * 그 밖의 알고리즘(none·HS256 등)과 형식이 어긋난 토큰은 모두 401 INVALID_ID_TOKEN이다. 클라이언트 ID가 설정되지 않았으면 503.
 */
@Component
public class GoogleIdTokenVerifier {
    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");
    private static final int MAX_LENGTH = 4096, MAX_SUB = 100;   // sub는 auth_identity.provider_user_id(100자)에 들어간다
    private static final ObjectMapper JSON = new ObjectMapper();

    private final String clientId;
    private final GoogleKeys keys;
    private final Clock clock;

    public GoogleIdTokenVerifier(@Value("${app.auth.google-client-id:}") String clientId, GoogleKeys keys, Clock clock) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.keys = keys;
        this.clock = clock;
    }

    /** 올바른 토큰이면 sub, 아니면 ApiException(401 INVALID_ID_TOKEN, 클라이언트 ID가 없으면 503 AUTH_UNAVAILABLE) */
    public String verify(String idToken) {
        if (clientId.isEmpty()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AUTH_UNAVAILABLE", "구글 로그인이 아직 준비되지 않았어요");
        try {
            if (idToken == null || idToken.length() > MAX_LENGTH) throw invalid();
            String[] p = idToken.split("\\.", -1);
            if (p.length != 3 || p[0].isEmpty() || p[1].isEmpty() || p[2].isEmpty()) throw invalid();
            JsonNode header = JSON.readTree(decode(p[0]));
            if (!"RS256".equals(textOrNull(header, "alg")) || textOrNull(header, "kid") == null || textOrNull(header, "kid").isEmpty()) throw invalid();
            PublicKey key = keys.key(header.get("kid").asText());
            if (key == null) throw invalid();
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(key);
            sig.update((p[0] + "." + p[1]).getBytes(StandardCharsets.US_ASCII));
            if (!sig.verify(Base64.getUrlDecoder().decode(p[2]))) throw invalid();

            JsonNode c = JSON.readTree(decode(p[1]));
            String iss = textOrNull(c, "iss"), aud = textOrNull(c, "aud"), sub = textOrNull(c, "sub");
            if (iss == null || !ISSUERS.contains(iss) || !clientId.equals(aud)) throw invalid();
            if (!c.path("exp").isNumber() || c.get("exp").asLong() <= clock.instant().getEpochSecond()) throw invalid();
            if (sub == null || sub.isEmpty() || sub.length() > MAX_SUB) throw invalid();
            return sub;
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw invalid();   // 깨진 Base64·JSON·서명 형식 등 모든 해석 실패
        }
    }

    private static byte[] decode(String part) {
        return Base64.getUrlDecoder().decode(part);
    }

    private static String textOrNull(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v != null && v.isTextual() ? v.asText() : null;
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_ID_TOKEN", "구글 로그인 정보를 확인할 수 없어요");
    }
}
