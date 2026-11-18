package kr.readingroom.app.room.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

/** page는 정수가 아니면 서비스가 400으로 거른다. 내용은 앞뒤 공백을 그대로 둔다(글을 고쳐 쓰지 않는다). */
public record RoomMessageRequest(String content, JsonNode page) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static RoomMessageRequest fromJson(JsonNode b) {
        return new RoomMessageRequest(RequestJson.rawText(b, "content"), RequestJson.field(b, "page"));
    }
}
