package kr.readingroom.app.room.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

/** 숫자 필드는 JsonNode로 받아 정수가 아니면(문자열·소수) 서비스가 400으로 거른다. */
public record CreateRoomRequest(String kind, String isbn, String title, String visibility,
                                JsonNode maxParticipants, String openAt, JsonNode hours, JsonNode bookId) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static CreateRoomRequest fromJson(JsonNode b) {
        return new CreateRoomRequest(RequestJson.text(b, "kind"), RequestJson.text(b, "isbn"), RequestJson.text(b, "title"),
                RequestJson.text(b, "visibility"), RequestJson.field(b, "maxParticipants"), RequestJson.text(b, "openAt"),
                RequestJson.field(b, "hours"), RequestJson.field(b, "bookId"));
    }
}
