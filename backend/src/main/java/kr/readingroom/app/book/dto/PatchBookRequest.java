package kr.readingroom.app.book.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record PatchBookRequest(JsonNode totalPages, JsonNode currentPage) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static PatchBookRequest fromJson(JsonNode b) {
        return new PatchBookRequest(RequestJson.field(b, "totalPages"), RequestJson.field(b, "currentPage"));
    }
}
