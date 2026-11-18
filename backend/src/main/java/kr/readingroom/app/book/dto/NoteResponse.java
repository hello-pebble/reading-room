package kr.readingroom.app.book.dto;

import java.time.Instant;

public record NoteResponse(long id, long bookId, String type, String content, Integer page, Instant createdAt) {}
