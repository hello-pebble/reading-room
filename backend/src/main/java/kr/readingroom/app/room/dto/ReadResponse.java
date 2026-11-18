package kr.readingroom.app.room.dto;

import java.time.Instant;

public record ReadResponse(long roomId, Instant lastReadAt) {}
