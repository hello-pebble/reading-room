package kr.readingroom.app.calendar.dto;

import java.time.Instant;
import java.util.List;

public record CalendarResponse(String month, List<String> days, Integer streak, Integer finishedCount, Integer goal, List<GoalChange> goalChanges, boolean goalInherited, Instant serverNow) {}
