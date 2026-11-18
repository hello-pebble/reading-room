package kr.readingroom.app.calendar.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;

public record GoalRequest(JsonNode monthlyGoal) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static GoalRequest fromJson(JsonNode b) {
        return new GoalRequest(RequestJson.field(b, "monthlyGoal"));
    }
}
