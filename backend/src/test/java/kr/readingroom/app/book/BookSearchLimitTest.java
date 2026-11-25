package kr.readingroom.app.book;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.TestClock;
import kr.readingroom.app.common.ApiExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** 책 검색은 IP당 1분에 30번까지(국립중앙도서관·카카오 호출 한도 보호). DB 없이 도는 테스트 */
class BookSearchLimitTest {
    final TestClock clock = new TestClock();
    final MockMvc mvc = standaloneSetup(new BookSearchController(new BookSearchService((f, v) -> List.of(Map.of("title", "소년이 온다"))), clock, 30))
            .setControllerAdvice(new ApiExceptionHandler()).build();

    static RequestPostProcessor from(String ip) {
        return req -> {
            req.setRemoteAddr(ip);
            return req;
        };
    }

    @Test
    void thirtyPerMinutePerIpThen429AndOtherIpsAndLaterMinutesAreFine() throws Exception {
        for (int i = 0; i < 30; i++) mvc.perform(get("/books/search").param("q", "소년").with(from("10.0.0.1"))).andExpect(status().isOk());
        mvc.perform(get("/books/search").param("q", "소년").with(from("10.0.0.1")))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.error").value("TOO_MANY_REQUESTS"));
        mvc.perform(get("/books/search").param("q", "소년").with(from("10.0.0.2"))).andExpect(status().isOk());      // 다른 IP는 따로 센다
        clock.advance(Duration.ofSeconds(61));
        mvc.perform(get("/books/search").param("q", "소년").with(from("10.0.0.1"))).andExpect(status().isOk());      // 1분이 지나면 다시 된다
    }
}
