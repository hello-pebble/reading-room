package kr.readingroom.app.book.dto;

import java.time.Instant;

public record NoteCreatedResponse(long id, long bookId, String type, String content, Integer page, Instant createdAt, int currentPage, Integer percent) {}
