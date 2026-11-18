package kr.readingroom.app.book.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record CreateBookRequest(String title, String author, String isbn, String coverUrl, JsonNode totalPages, JsonNode currentPage) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static CreateBookRequest fromJson(JsonNode b) {
        return new CreateBookRequest(RequestJson.text(b, "title"), RequestJson.text(b, "author"), RequestJson.text(b, "isbn"), RequestJson.text(b, "coverUrl"), RequestJson.field(b, "totalPages"), RequestJson.field(b, "currentPage"));
    }
}
