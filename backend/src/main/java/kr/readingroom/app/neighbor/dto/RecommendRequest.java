package kr.readingroom.app.neighbor.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

/** bookId는 정수가 아니면 서비스가 400으로 거른다. */
public record RecommendRequest(JsonNode bookId) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static RecommendRequest fromJson(JsonNode b) {
        return new RecommendRequest(RequestJson.field(b, "bookId"));
    }
}
