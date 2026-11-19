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

        @org.springframework.context.annotation.Bean
        @org.springframework.context.annotation.Primary
        RecordingPushSender recordingPushSender() { return new RecordingPushSender(); }
    }

    @Autowired protected TestClock clock;
    @Autowired protected RecordingPushSender pushes;
    @Autowired protected MockMvc mvc;
    @Autowired protected DSLContext dsl;
    @Autowired protected ObjectMapper json;

    @BeforeEach
    void cleanDb() {
        clock.set("2026-11-17T03:00:00Z");
        pushes.reset();
        dsl.execute("truncate app_user restart identity cascade");
    }

    /** 테스트용 사용자. label에서 영문·숫자만 남겨 5자까지를 닉네임으로 쓴다 (닉네임 규칙 #67). 사용자를 가리키는 값은 공개 번호 publicId(결정 #69). */
    protected long newUser(String label) throws Exception {
        String nickname = label.replaceAll("[^A-Za-z0-9]", "");
        if (nickname.length() > 5) nickname = nickname.substring(0, 5);
        MvcResult r = mvc.perform(MockMvcRequestBuilders.post("/dev/users").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"" + nickname + "\"}")).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    /** 다른 사람에게 보이는 사용자 번호(무작위 UUID) */
    protected String publicId(long uid) {
        return dsl.fetchOne("select public_id::text as p from app_user where id = ?", uid).get("p", String.class);
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
