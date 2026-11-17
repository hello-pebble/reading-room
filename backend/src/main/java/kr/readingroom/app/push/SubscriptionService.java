package kr.readingroom.app.push;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class SubscriptionService {
    private final DSLContext dsl;

    public SubscriptionService(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 브라우저 PushSubscription({endpoint, keys:{p256dh, auth}}) 또는 평평한 {endpoint, p256dh, auth}를 받는다. 같은 endpoint면 덮어쓴다(멱등). */
    public Map<String, Object> save(long userId, JsonNode b, String userAgent) {
        String endpoint = text(b, "endpoint");
        String p256dh = text(b.path("keys"), "p256dh") != null ? text(b.path("keys"), "p256dh") : text(b, "p256dh");
        String auth = text(b.path("keys"), "auth") != null ? text(b.path("keys"), "auth") : text(b, "auth");
        if (endpoint == null || endpoint.length() > 1000 || !endpoint.startsWith("https://"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_ENDPOINT", "endpoint(https 주소)가 필요해요");
        if (p256dh == null || auth == null)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_KEYS", "keys(p256dh, auth)가 필요해요");
        Record r = dsl.fetchOne("""
                insert into push_subscription(user_id, endpoint, p256dh, auth, user_agent) values (?, ?, ?, ?, ?)
                on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent
                returning id, endpoint""", userId, endpoint, p256dh, auth, userAgent == null ? null : userAgent.substring(0, Math.min(300, userAgent.length())));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.get("id", Long.class));
        m.put("endpoint", r.get("endpoint", String.class));
        return m;
    }

    /** 내 구독 해제. 없어도 성공으로 본다. */
    public void delete(long userId, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_ENDPOINT", "endpoint가 필요해요");
        dsl.execute("delete from push_subscription where user_id = ? and endpoint = ?", userId, endpoint);
    }

    private static String text(JsonNode n, String k) {
        return n != null && n.hasNonNull(k) && n.get(k).isTextual() && !n.get(k).asText().isBlank() ? n.get(k).asText().trim() : null;
    }
}
