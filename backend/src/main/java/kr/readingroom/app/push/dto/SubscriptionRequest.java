package kr.readingroom.app.push.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record SubscriptionRequest(String endpoint, String p256dh, String auth, Keys keys) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static SubscriptionRequest fromJson(JsonNode b) {
        return new SubscriptionRequest(RequestJson.text(b, "endpoint"), RequestJson.text(b, "p256dh"), RequestJson.text(b, "auth"), b != null && b.hasNonNull("keys") ? new Keys(RequestJson.text(b.get("keys"), "p256dh"), RequestJson.text(b.get("keys"), "auth")) : null);
    }

    public record Keys(String p256dh, String auth) {}
}
