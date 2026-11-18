package kr.readingroom.app.book.dto;


public record BookSearchResponse(String title, String author, Integer totalPages, String isbn, String coverUrl) {}
