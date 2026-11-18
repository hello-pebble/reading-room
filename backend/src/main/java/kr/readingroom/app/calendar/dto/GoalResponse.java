package kr.readingroom.app.calendar.dto;

import java.util.List;

public record GoalResponse(String month, Integer goal, List<GoalChange> goalChanges, boolean goalInherited) {}
