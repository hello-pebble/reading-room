package kr.readingroom.app.book;

import java.util.List;
import java.util.Map;

/** 책 정보를 찾아 주는 곳. 지금은 국립중앙도서관 하나다 (결정 H). 테스트에서는 가짜로 바꿔 끼운다. */
public interface BookSearchSource {
    /** field는 isbn / title / author. 각 항목은 {title, author, totalPages(없으면 null), isbn, coverUrl}. */
    List<Map<String, Object>> search(String field, String value);
}
