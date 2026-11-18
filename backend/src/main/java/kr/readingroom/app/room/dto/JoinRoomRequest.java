package kr.readingroom.app.room.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record JoinRoomRequest(String code, JsonNode bookId) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static JoinRoomRequest fromJson(JsonNode b) {
        return new JoinRoomRequest(RequestJson.text(b, "code"), RequestJson.field(b, "bookId"));
    }
}
