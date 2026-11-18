package kr.readingroom.app.push;

import kr.readingroom.app.push.dto.*;
import kr.readingroom.app.common.ApiException;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class SubscriptionService {
    private final SubscriptionRepository subscriptionRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
    }

    /** 브라우저 PushSubscription({endpoint, keys:{p256dh, auth}}) 또는 평평한 {endpoint, p256dh, auth}를 받는다. 같은 endpoint면 덮어쓴다(멱등). */
    public SubscriptionResponse save(long userId, SubscriptionRequest b, String userAgent) {
        String endpoint = b.endpoint();
        String p256dh = b.keys() != null && b.keys().p256dh() != null && !b.keys().p256dh().isBlank() ? b.keys().p256dh() : b.p256dh();
        String auth = b.keys() != null && b.keys().auth() != null && !b.keys().auth().isBlank() ? b.keys().auth() : b.auth();
        if (endpoint == null || endpoint.isBlank() || endpoint.length() > 1000 || !endpoint.startsWith("https://"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_ENDPOINT", "endpoint(https 주소)가 필요해요");
        if (p256dh == null || p256dh.isBlank() || auth == null || auth.isBlank())
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_KEYS", "keys(p256dh, auth)가 필요해요");
        Record r = subscriptionRepository.upsert(userId, endpoint, p256dh, auth, userAgent == null ? null : userAgent.substring(0, Math.min(300, userAgent.length())));
        return new SubscriptionResponse(r.get("id", Long.class), r.get("endpoint", String.class));
    }

    /** 내 구독 해제. 없어도 성공으로 본다. */
    public void delete(long userId, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_ENDPOINT", "endpoint가 필요해요");
        subscriptionRepository.deleteOwned(userId, endpoint);
    }

}
