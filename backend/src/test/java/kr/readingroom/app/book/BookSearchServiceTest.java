package kr.readingroom.app.book;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** 책 찾기 입력 해석 (ISBN-10 변환, 링크, 검사 숫자, 저자 대체 검색). 외부 호출은 가짜. */
class BookSearchServiceTest {
    final List<String> calls = new ArrayList<>();
    final BookSearchService service = new BookSearchService((field, value) -> {
        calls.add(field + "=" + value);
        if (field.equals("author")) return List.of(Map.of("title", "채식주의자", "author", "한강"));
        if (value.equals("없는책")) return List.of();
        return List.of(Map.of("title", "소년이 온다", "author", "한강", "totalPages", 215));
    });

    @Test
    void isbn10HyphensAndLinksBecomeIsbn13() {
        service.search("8936434128");
        service.search("978-89-364-3412-0");
        service.search("https://shop.example/book/9788936434120?x=1");
        assertThat(calls).containsOnly("isbn=9788936434120");
    }

    @Test
    void wrongIsbnEmptyAndLinkWithoutIsbnAreBadRequest() {
        for (String q : new String[]{"9788936434121", " ", "https://shop.example/about", "1234567890"}) {
            assertThatThrownBy(() -> service.search(q)).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(HttpStatus.BAD_REQUEST));
        }
        assertThat(calls).isEmpty();
    }

    @Test
    void titleSearchFallsBackToAuthor() {
        assertThat(service.search("소년").get(0).title()).isEqualTo("소년이 온다");
        assertThat(service.search("없는책").get(0).author()).isEqualTo("한강");
        assertThat(calls).containsExactly("title=소년", "title=없는책", "author=없는책");
    }

    @Test
    void toIsbn13ChecksTheCheckDigit() {
        assertThat(BookSearchService.toIsbn13("8936434128")).isEqualTo("9788936434120");
        assertThat(BookSearchService.toIsbn13("9788936434121")).isEmpty();
        assertThat(BookSearchService.toIsbn13("123")).isEmpty();
    }
}
