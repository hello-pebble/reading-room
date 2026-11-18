package kr.readingroom.app.book.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record NoteRequest(String type, String content, JsonNode page) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static NoteRequest fromJson(JsonNode b) {
        return new NoteRequest(RequestJson.rawText(b, "type"), RequestJson.text(b, "content"), RequestJson.field(b, "page"));
    }
}
