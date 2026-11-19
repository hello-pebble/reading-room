package kr.readingroom.app.calendar.dto;

import java.time.Instant;

/** 한국 날짜 하루의 읽은 시간(분). 스탠드(끝난 것)와 모닥불 머문 시간을 합집합으로 더한 값이다. */
public record ReadingTimeResponse(String date, long minutes, Instant serverNow) {}
