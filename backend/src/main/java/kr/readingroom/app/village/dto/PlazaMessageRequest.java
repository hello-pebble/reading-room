package kr.readingroom.app.village.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record PlazaMessageRequest(String content) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static PlazaMessageRequest fromJson(JsonNode b) {
        return new PlazaMessageRequest(RequestJson.text(b, "content"));
    }
}
