package kr.readingroom.app.book.dto;

import java.time.Instant;

public record BookResponse(long id, String isbn, String title, String author, String coverUrl, Integer totalPages, int currentPage, Integer percent, String status, Short rating, String oneLineReview, Instant startedAt, Instant finishedAt) {}
