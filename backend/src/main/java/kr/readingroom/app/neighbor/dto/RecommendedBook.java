package kr.readingroom.app.neighbor.dto;

/** 추천에 복사해 두는 책 정보. 독서 메모·평점·진행률은 담지 않는다. */
public record RecommendedBook(String isbn, String title, String author, String coverUrl) {}
