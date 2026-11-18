package kr.readingroom.app.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;

/** 요청의 숫자 타입과 PATCH의 누락/null 구분을 보존한다. 문자열은 각 DTO가 필요한 방식으로 읽는다. */
public final class RequestJson {
    private RequestJson() {}
    public static JsonNode field(JsonNode body, String name) { return body == null ? null : body.get(name); }
    public static boolean present(JsonNode value) { return value != null && !value.isNull(); }
    public static JsonNode node(JsonNode value) { return value == null ? MissingNode.getInstance() : value; }
    public static String rawText(JsonNode body, String name) {
        JsonNode value = field(body, name);
        return present(value) && value.isTextual() ? value.asText() : null;
    }
    public static String text(JsonNode body, String name) {
        String value = rawText(body, name);
        return value == null ? null : value.trim();
    }
}
