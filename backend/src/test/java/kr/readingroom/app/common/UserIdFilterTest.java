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
    /** 토큰 "good"만 사용자 7로 인정하는 가짜 확인기. dev가 true면 개발용 X-User-Id 헤더도 받는다. */
    static UserIdFilter filter(boolean dev) {
        org.springframework.mock.env.MockEnvironment env = new org.springframework.mock.env.MockEnvironment();
        if (dev) env.setActiveProfiles("dev");
        return new UserIdFilter(t -> "good".equals(t) ? 7L : null, env);
    }

    static MockMvc app(boolean dev) {
        return standaloneSetup(new BookSearchController(new BookSearchService((f, v) -> List.of(Map.of("title", "소년이 온다"))), java.time.Clock.systemUTC(), 30))
                .addFilters(filter(dev)).setControllerAdvice(new ApiExceptionHandler()).build();
    }

    final MockMvc mvc = app(true);

    @Test
    void searchIsPublicButOtherPathsNeedUserId() throws Exception {
        mvc.perform(get("/books/search").param("q", "소년")).andExpect(status().isOk());
        mvc.perform(get("/books")).andExpect(status().isUnauthorized());
        mvc.perform(get("/books").header("X-User-Id", "1")).andExpect(status().isNotFound());   // 헤더가 있으면 필터는 통과(이 테스트에는 목록 컨트롤러가 없어 404)
    }

    @Test
    void invitePreviewIsPublicButOnlyForGet() throws Exception {
        mvc.perform(get("/rooms/invite/ABCDEFGH")).andExpect(status().isNotFound());           // 헤더 없이 필터를 통과(이 테스트에는 컨트롤러가 없어 404)
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/rooms/invite/ABCDEFGH")).andExpect(status().isUnauthorized());
        mvc.perform(get("/rooms")).andExpect(status().isUnauthorized());
    }

    @Test
    void preflightPassesWithoutUserId() throws Exception {
        var req = new org.springframework.mock.web.MockHttpServletRequest("OPTIONS", "/books/search");
        var res = new org.springframework.mock.web.MockHttpServletResponse();
        var chain = new org.springframework.mock.web.MockFilterChain();
        filter(true).doFilter(req, res, chain);
        org.assertj.core.api.Assertions.assertThat(res.getStatus()).isNotEqualTo(401);
        org.assertj.core.api.Assertions.assertThat(chain.getRequest()).isNotNull();   // 다음 단계로 넘어갔다
    }

    @Test
    void outsideTheDevProfileOnlyBearerTokensWorkAndAWrongTokenNeverFallsBackToTheDevHeader() throws Exception {
        MockMvc prod = app(false), dev = app(true);
        prod.perform(get("/books").header("X-User-Id", "1")).andExpect(status().isUnauthorized());                  // 운영에서는 개발용 헤더를 믿지 않는다
        prod.perform(get("/books").header("Authorization", "Bearer bad")).andExpect(status().isUnauthorized());
        prod.perform(get("/books").header("Authorization", "Bearer good")).andExpect(status().isNotFound());         // 토큰이 맞으면 통과(컨트롤러가 없어 404)
        prod.perform(get("/books").header("Authorization", "bearer good")).andExpect(status().isNotFound());         // 접두어는 대소문자 무시
        prod.perform(get("/books").header("Authorization", "good")).andExpect(status().isUnauthorized());
        prod.perform(get("/books").header("Authorization", "Bearer ")).andExpect(status().isUnauthorized());
        dev.perform(get("/books").header("Authorization", "Bearer bad").header("X-User-Id", "1")).andExpect(status().isUnauthorized());   // dev에서도 틀린 토큰은 거절
        dev.perform(get("/books").header("Authorization", "Bearer good")).andExpect(status().isNotFound());
    }

    @Test
    void googleLoginIsPublicOnlyForPost() throws Exception {
        MockMvc prod = app(false);
        prod.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/auth/google")).andExpect(status().isNotFound());   // 필터 통과(컨트롤러가 없어 404)
        prod.perform(get("/auth/google")).andExpect(status().isUnauthorized());
        prod.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/auth/logout")).andExpect(status().isUnauthorized());   // 로그아웃은 토큰이 있어야 한다
    }
}
