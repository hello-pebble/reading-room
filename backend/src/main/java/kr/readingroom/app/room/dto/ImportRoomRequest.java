package kr.readingroom.app.room.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

/** 가져올 내 책. 생략하면 입장할 때 고른 책, 없으면 같은 ISBN의 내 책을 쓴다. 정수가 아니면 서비스가 400으로 거른다. */
public record ImportRoomRequest(JsonNode bookId) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static ImportRoomRequest fromJson(JsonNode b) {
        return new ImportRoomRequest(RequestJson.field(b, "bookId"));
    }
}
