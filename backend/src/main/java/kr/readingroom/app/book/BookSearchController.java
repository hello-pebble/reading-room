package kr.readingroom.app.book;

import kr.readingroom.app.book.dto.*;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/books")
public class BookSearchController {
    private final BookSearchService search;

    public BookSearchController(BookSearchService search) {
        this.search = search;
    }

    /** 제목·저자·ISBN·책 링크로 찾기. 응답 [{title, author, totalPages, isbn, coverUrl}] */
    @GetMapping("/search")
    public List<BookSearchResponse> search(@RequestParam("q") String q) {
        return search.search(q);
    }
}
