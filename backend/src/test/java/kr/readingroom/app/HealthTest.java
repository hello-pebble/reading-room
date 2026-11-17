package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;

class HealthTest extends ApiTestBase {
    @Test
    void healthIsOk() throws Exception {
        mvc.perform(get("/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void flywayAppliedV1() {
        Integer v = dsl.fetchOne("select count(*) from flyway_schema_history where version = '1' and success").into(Integer.class);
        assertThat(v).isEqualTo(1);
    }
}
