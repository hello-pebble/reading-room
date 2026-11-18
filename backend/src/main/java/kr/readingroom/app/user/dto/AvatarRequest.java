package kr.readingroom.app.user.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record AvatarRequest(String color, String expr, String face, String head, String prop) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static AvatarRequest fromJson(JsonNode b) {
        return new AvatarRequest(RequestJson.rawText(b, "color"), RequestJson.rawText(b, "expr"), RequestJson.rawText(b, "face"), RequestJson.rawText(b, "head"), RequestJson.rawText(b, "prop"));
    }

    public String value(String key) { return switch (key) { case "color" -> color; case "expr" -> expr; case "face" -> face; case "head" -> head; case "prop" -> prop; default -> null; }; }
}
