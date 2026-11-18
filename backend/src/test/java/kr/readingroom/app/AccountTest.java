package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;

class AccountTest extends ApiTestBase {
    @Test
    void meWithoutHeaderIs401() throws Exception {
        mvc.perform(get("/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/me").header("X-User-Id", "abc")).andExpect(status().isUnauthorized());
    }

    @Test
    void meWithHeaderReturnsProfile() throws Exception {
        long id = newUser("reader_1");
        mvc.perform(get("/me").header("X-User-Id", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.handle").value("reader_1"))
                .andExpect(jsonPath("$.nickname").value("reader_1"))
                .andExpect(jsonPath("$.avatar.color").value("#f6f3ff"))
                .andExpect(jsonPath("$.avatar.prop").value("book"));
    }

    @Test
    void unknownUserIs404() throws Exception {
        mvc.perform(get("/me").header("X-User-Id", 9999)).andExpect(status().isNotFound());
    }

    @Test
    void handleConstraintAndUniqueIdentity() throws Exception {
        for (String bad : new String[] {"ab", "Upper1", "has-dash", "abcdefghijklmnop"}) {
            mvc.perform(post("/dev/users").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"handle\":\"" + bad + "\"}")).andExpect(status().isBadRequest());
            // DB CHECK도 막는다
            org.junit.jupiter.api.Assertions.assertThrows(DataIntegrityViolationException.class,
                    () -> dsl.execute("insert into app_user(handle, nickname) values (?, 'x')", bad));
        }
        long id = newUser("dup_user");
        mvc.perform(post("/dev/users").contentType(MediaType.APPLICATION_JSON).content("{\"handle\":\"dup_user\"}"))
                .andExpect(status().isConflict());
        dsl.execute("insert into auth_identity(user_id, provider, provider_user_id) values (?, 'kakao', 'k1')", id);
        org.junit.jupiter.api.Assertions.assertThrows(DataIntegrityViolationException.class,
                () -> dsl.execute("insert into auth_identity(user_id, provider, provider_user_id) values (?, 'kakao', 'k1')", id));
        assertThat(dsl.fetchCount(dsl.selectFrom("invite_code"))).isZero();
    }
}
