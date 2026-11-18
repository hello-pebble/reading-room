package kr.readingroom.app.session.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record SessionRequest(String endedBy, String until, String memo, String date, JsonNode minutes, JsonNode daysAgo, JsonNode totalPages, JsonNode endPage, JsonNode discard) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static SessionRequest fromJson(JsonNode b) {
        return new SessionRequest(RequestJson.text(b, "endedBy"), RequestJson.text(b, "until"), RequestJson.text(b, "memo"), RequestJson.text(b, "date"), RequestJson.field(b, "minutes"), RequestJson.field(b, "daysAgo"), RequestJson.field(b, "totalPages"), RequestJson.field(b, "endPage"), RequestJson.field(b, "discard"));
    }
}
