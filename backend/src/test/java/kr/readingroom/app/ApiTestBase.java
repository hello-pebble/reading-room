package kr.readingroom.app;

import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** API 통합 테스트 공통: 실제 PostgreSQL, dev 프로파일(임시 사용자 생성), 테스트마다 데이터 비움. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@org.springframework.test.context.TestPropertySource(properties = "app.scheduling.enabled=false")
@org.springframework.context.annotation.Import(ApiTestBase.ClockConfig.class)
public abstract class ApiTestBase extends PgTestBase {
    @org.springframework.boot.test.context.TestConfiguration
    static class ClockConfig {
        @org.springframework.context.annotation.Bean
        @org.springframework.context.annotation.Primary
        TestClock testClock() { return new TestClock(); }
    }

    @Autowired protected TestClock clock;
    @Autowired protected MockMvc mvc;
    @Autowired protected DSLContext dsl;
    @Autowired protected ObjectMapper json;

    @BeforeEach
    void cleanDb() {
        clock.set("2026-11-17T03:00:00Z");
        dsl.execute("truncate app_user restart identity cascade");
    }

    protected long newUser(String handle) throws Exception {
        MvcResult r = mvc.perform(MockMvcRequestBuilders.post("/dev/users").contentType(MediaType.APPLICATION_JSON)
                .content("{\"handle\":\"" + handle + "\",\"nickname\":\"" + handle + "\"}")).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    protected MockHttpServletRequestBuilder as(long uid, MockHttpServletRequestBuilder b) {
        return b.header("X-User-Id", uid);
    }

    protected MockHttpServletRequestBuilder GET(long uid, String url) {
        return as(uid, MockMvcRequestBuilders.get(url));
    }

    protected MockHttpServletRequestBuilder DELETE(long uid, String url) {
        return as(uid, MockMvcRequestBuilders.delete(url));
    }

    protected MockHttpServletRequestBuilder POST(long uid, String url, Object body) throws Exception {
        return as(uid, MockMvcRequestBuilders.post(url)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    }

    protected MockHttpServletRequestBuilder PATCH(long uid, String url, Object body) throws Exception {
        return as(uid, MockMvcRequestBuilders.patch(url)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    }

    protected MockHttpServletRequestBuilder PUT(long uid, String url, Object body) throws Exception {
        return as(uid, MockMvcRequestBuilders.put(url)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    }

    protected JsonNode body(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString());
    }
}
