package kr.readingroom.app.book;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import kr.readingroom.app.book.dto.*;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.IpWindowLimit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/books")
public class BookSearchController {
    private final BookSearchService search;
    private final IpWindowLimit limit; // IP당 1분 (결정 #88). 국립중앙도서관·카카오 호출 한도를 로그인 없는 요청이 소진하지 못하게 한다

    public BookSearchController(BookSearchService search, Clock clock, @Value("${app.search.per-minute-per-ip:30}") int perMinute) {
        this.search = search;
        this.limit = new IpWindowLimit(clock, perMinute, Duration.ofMinutes(1));
    }

    /** 제목·저자·ISBN·책 링크로 찾기. 응답 [{title, author, totalPages, isbn, coverUrl}]. IP당 1분에 30번을 넘으면 429 */
    @GetMapping("/search")
    public List<BookSearchResponse> search(@RequestParam("q") String q, HttpServletRequest req) {
        if (!limit.tryAcquire(req.getRemoteAddr())) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_REQUESTS", "잠시 뒤에 다시 검색해 주세요");
        return search.search(q);
    }
}
