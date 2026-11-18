package kr.readingroom.app.session.dto;

import java.time.Instant;

public record SessionResponse(long id, long bookId, String status, String source, Instant startedAt, Instant endedAt, Instant lastCheckAt, String endedBy, Integer startPage, Integer endPage, String memo, Long minutes) {}
