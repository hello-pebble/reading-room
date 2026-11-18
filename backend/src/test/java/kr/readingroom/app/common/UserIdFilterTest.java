package kr.readingroom.app.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import java.util.List;
import java.util.Map;
import kr.readingroom.app.book.BookSearchController;
import kr.readingroom.app.book.BookSearchService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;

/** 책 검색은 사용자 헤더 없이, 나머지는 헤더가 있어야 한다. 브라우저의 OPTIONS 확인은 통과한다. (DB 없이 도는 테스트) */
class UserIdFilterTest {
    final MockMvc mvc = standaloneSetup(new BookSearchController(new BookSearchService((f, v) -> List.of(Map.of("title", "소년이 온다")))))
            .addFilters(new UserIdFilter()).setControllerAdvice(new ApiExceptionHandler()).build();

    @Test
    void searchIsPublicButOtherPathsNeedUserId() throws Exception {
        mvc.perform(get("/books/search").param("q", "소년")).andExpect(status().isOk());
        mvc.perform(get("/books")).andExpect(status().isUnauthorized());
        mvc.perform(get("/books").header("X-User-Id", "1")).andExpect(status().isNotFound());   // 헤더가 있으면 필터는 통과(이 테스트에는 목록 컨트롤러가 없어 404)
    }

    @Test
    void preflightPassesWithoutUserId() throws Exception {
        var req = new org.springframework.mock.web.MockHttpServletRequest("OPTIONS", "/books/search");
        var res = new org.springframework.mock.web.MockHttpServletResponse();
        var chain = new org.springframework.mock.web.MockFilterChain();
        new UserIdFilter().doFilter(req, res, chain);
        org.assertj.core.api.Assertions.assertThat(res.getStatus()).isNotEqualTo(401);
        org.assertj.core.api.Assertions.assertThat(chain.getRequest()).isNotNull();   // 다음 단계로 넘어갔다
    }
}
