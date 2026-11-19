package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;

/**
 * 화면(다른 주소)이 서버 응답을 읽으려면 오류 응답에도 CORS 헤더가 있어야 한다.
 * 로그인 필터(UserIdFilter)가 401을 직접 돌려줄 때 헤더가 없으면 브라우저는 401 대신 "서버에 닿지 못함"으로 처리해 화면이 만료를 알 수 없다.
 */
class CorsTest extends ApiTestBase {
    static final String ORIGIN = "http://localhost:8765";   // application.properties의 기본 허용 주소

    @Test
    void theFilterThatAnswers401StillSendsCorsHeaders() throws Exception {
        mvc.perform(get("/me").header("Origin", ORIGIN).header("Authorization", "Bearer 만료된토큰"))
                .andExpect(status().isUnauthorized()).andExpect(header().string("Access-Control-Allow-Origin", ORIGIN));
        mvc.perform(get("/me").header("Origin", ORIGIN))                                              // 토큰이 아예 없을 때도
                .andExpect(status().isUnauthorized()).andExpect(header().string("Access-Control-Allow-Origin", ORIGIN));
    }

    @Test
    void errorsFromControllersAndNormalAnswersCarryThemToo() throws Exception {
        long u = newUser("alice");
        mvc.perform(GET(u, "/books/9999").header("Origin", ORIGIN)).andExpect(status().isNotFound()).andExpect(header().string("Access-Control-Allow-Origin", ORIGIN));
        mvc.perform(GET(u, "/me").header("Origin", ORIGIN)).andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", ORIGIN));
    }

    @Test
    void preflightAllowsTheMethodsAndTheAuthorizationHeaderTheScreenUses() throws Exception {
        for (String method : new String[] {"GET", "POST", "PUT", "PATCH", "DELETE"}) {
            var r = mvc.perform(options("/books/1/notes/2").header("Origin", ORIGIN).header("Access-Control-Request-Method", method)
                    .header("Access-Control-Request-Headers", "authorization,content-type"))
                    .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", ORIGIN)).andReturn();
            assertThat(r.getResponse().getHeader("Access-Control-Allow-Methods")).contains(method);
            assertThat(r.getResponse().getHeader("Access-Control-Allow-Headers").toLowerCase()).contains("authorization");
        }
    }

    @Test
    void anOriginThatIsNotAllowedGetsNothing() throws Exception {
        mvc.perform(options("/me").header("Origin", "http://evil.example").header("Access-Control-Request-Method", "GET")).andExpect(status().isForbidden());
        var r = mvc.perform(get("/me").header("Origin", "http://evil.example")).andReturn();
        assertThat(r.getResponse().getHeader("Access-Control-Allow-Origin")).isNull();
    }

    @Test
    void requestsWithoutAnOriginAreUnchanged() throws Exception {
        var r = mvc.perform(get("/me")).andExpect(status().isUnauthorized()).andReturn();
        assertThat(r.getResponse().getHeader("Access-Control-Allow-Origin")).isNull();
    }
}
