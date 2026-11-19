package kr.readingroom.app.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 구글이 공개하는 서명 키(JWKS)를 내려받아 메모리에 둔다. 6시간 동안 쓰고, 모르는 kid가 오면 최소 1분 간격으로 다시 받는다
 * (구글이 키를 바꿔도 따라가되, 잘못된 kid로 외부 호출을 부풀리지 못하게). 내려받기가 실패하면 갖고 있는 키로 버티고, 없으면 503.
 */
@Component
public class HttpGoogleKeys implements GoogleKeys {
    private static final Logger log = LoggerFactory.getLogger(HttpGoogleKeys.class);
    static final URI CERTS = URI.create("https://www.googleapis.com/oauth2/v3/certs");
    static final Duration TTL = Duration.ofHours(6), MIN_REFETCH = Duration.ofMinutes(1);

    private final Clock clock;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final Map<String, PublicKey> keys = new HashMap<>();
    private Instant fetchedAt;

    public HttpGoogleKeys(Clock clock, ObjectMapper json) {
        this.clock = clock;
        this.json = json;
    }

    @Override
    public synchronized PublicKey key(String kid) {
        Instant now = clock.instant();
        PublicKey known = keys.get(kid);
        boolean fresh = fetchedAt != null && now.isBefore(fetchedAt.plus(TTL));
        if (known != null && fresh) return known;
        if (known == null && fetchedAt != null && now.isBefore(fetchedAt.plus(MIN_REFETCH))) return null;
        try {
            refresh(now);
        } catch (Exception e) {
            log.warn("구글 서명 키를 받지 못했어요: {}", e.toString());
            if (known != null) return known;
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AUTH_UNAVAILABLE", "지금은 로그인을 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요");
        }
        return keys.get(kid);
    }

    private void refresh(Instant now) throws Exception {
        HttpResponse<String> res = http.send(HttpRequest.newBuilder(CERTS).timeout(Duration.ofSeconds(5)).GET().build(), HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) throw new IllegalStateException("HTTP " + res.statusCode());
        Map<String, PublicKey> next = new HashMap<>();
        KeyFactory rsa = KeyFactory.getInstance("RSA");
        for (JsonNode k : json.readTree(res.body()).path("keys")) {
            if (!"RSA".equals(k.path("kty").asText()) || k.path("kid").asText().isEmpty()) continue;
            BigInteger n = new BigInteger(1, Base64.getUrlDecoder().decode(k.path("n").asText()));
            BigInteger e = new BigInteger(1, Base64.getUrlDecoder().decode(k.path("e").asText()));
            next.put(k.path("kid").asText(), rsa.generatePublic(new RSAPublicKeySpec(n, e)));
        }
        if (next.isEmpty()) throw new IllegalStateException("키가 없어요");
        keys.clear();
        keys.putAll(next);
        fetchedAt = now;
    }
}
