package kr.readingroom.app.calendar.dto;

import java.util.List;

public record GoalChange(String at, int from, int to) {
    public static List<GoalChange> list(com.fasterxml.jackson.databind.JsonNode changes) {
        List<GoalChange> result = new java.util.ArrayList<>();
        changes.forEach(c -> result.add(new GoalChange(c.get("at").asText(), c.get("from").asInt(), c.get("to").asInt())));
        return result;
    }
}
