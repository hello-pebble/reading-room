package kr.readingroom.app.room.dto;

import java.time.Instant;

/** 모닥불 입장: 서버가 적은 입장 시각. */
public record StayResponse(long roomId, Instant enteredAt) {}
