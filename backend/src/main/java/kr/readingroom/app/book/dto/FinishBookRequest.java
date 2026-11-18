package kr.readingroom.app.book.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record FinishBookRequest(JsonNode rating, String oneLineReview) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static FinishBookRequest fromJson(JsonNode b) {
        return new FinishBookRequest(RequestJson.field(b, "rating"), RequestJson.text(b, "oneLineReview"));
    }
}
