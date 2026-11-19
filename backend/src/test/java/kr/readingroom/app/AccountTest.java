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
                .andExpect(jsonPath("$.publicId").value(publicId(id)))
                .andExpect(jsonPath("$.handle").doesNotExist())                                   // 핸들은 없다 (결정 #69)
                .andExpect(jsonPath("$.nickname").value("reade"))   // 라벨에서 영문·숫자만 남겨 5자까지 (닉네임 규칙 #67)
                .andExpect(jsonPath("$.avatar.color").value("#f6f3ff"))
                .andExpect(jsonPath("$.avatar.prop").value("book"));
    }

    @Test
    void unknownUserIs404() throws Exception {
        mvc.perform(get("/me").header("X-User-Id", 9999)).andExpect(status().isNotFound());
    }

    @Test
    void publicIdIsUniqueThereIsNoHandleAndIdentityIsUnique() throws Exception {
        long id = newUser("dup_user");
        // 핸들 열은 없다 (결정 #69)
        assertThat(dsl.fetchCount(dsl.selectFrom("information_schema.columns").where("table_name = 'app_user' and column_name = 'handle'"))).isZero();
        // 공개 번호는 겹칠 수 없다
        org.junit.jupiter.api.Assertions.assertThrows(DataIntegrityViolationException.class,
                () -> dsl.execute("insert into app_user(nickname, public_id) values ('x', (select public_id from app_user where id = ?))", id));
        dsl.execute("insert into auth_identity(user_id, provider, provider_user_id) values (?, 'kakao', 'k1')", id);
        org.junit.jupiter.api.Assertions.assertThrows(DataIntegrityViolationException.class,
                () -> dsl.execute("insert into auth_identity(user_id, provider, provider_user_id) values (?, 'kakao', 'k1')", id));
        assertThat(dsl.fetchCount(dsl.selectFrom("invite_code"))).isZero();
    }
}
