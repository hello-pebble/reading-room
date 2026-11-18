package kr.readingroom.app.push.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;

public record DeleteSubscriptionRequest(String endpoint) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static DeleteSubscriptionRequest fromJson(JsonNode b) {
        return new DeleteSubscriptionRequest(b != null && b.hasNonNull("endpoint") ? b.get("endpoint").asText() : null);
    }
}
