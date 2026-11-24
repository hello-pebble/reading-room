package kr.readingroom.app;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

import org.junit.jupiter.api.Test;

class SecurityHeadersTest extends ApiTestBase {
    @Test
    void everyResponseCarriesTheBasicSecurityHeaders() throws Exception {
        mvc.perform(get("/health")).andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY")).andExpect(header().string("Referrer-Policy", "no-referrer"));
        mvc.perform(get("/me")).andExpect(header().string("X-Frame-Options", "DENY")); // 401 응답에도 붙는다
    }
}
