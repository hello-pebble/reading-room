package kr.readingroom.app.room.dto;

import java.time.Instant;

/** 보관 동의 시각. 이미 동의했으면 처음 동의한 시각을 그대로 돌려준다. */
public record AgreeResponse(long roomId, Instant agreedAt) {}
