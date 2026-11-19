package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;

/** 닉네임 규칙: 한글·영문·숫자만, 공백 없이 1~5자 (결정 #52·#67). 이모티콘·특수문자 금지. */
class NicknameTest extends ApiTestBase {
    String nickname(long uid) throws Exception {
        return body(mvc.perform(GET(uid, "/me")).andExpect(status().isOk()).andReturn()).get("nickname").asText();
    }

    @Test
    void hangulLettersAndDigitsUpToFiveCharactersAreAccepted() throws Exception {
        long u = newUser("alice");
        for (String ok : new String[] {"나무", "Tree", "a1", "독서a1", "12345", "한", "ㅋㅋ", "AbCdE"}) {
            mvc.perform(PUT(u, "/me/nickname", Map.of("nickname", ok))).andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value(ok));
            assertThat(nickname(u)).isEqualTo(ok);
        }
    }

    @Test
    void emojiSpecialCharactersSpacesAndLongNamesAreRejectedAndNothingChanges() throws Exception {
        long u = newUser("alice");
        mvc.perform(PUT(u, "/me/nickname", Map.of("nickname", "나무"))).andExpect(status().isOk());
        String[] bad = {"", " ", "여섯글자이름이", "abcdef", "a b", "나무 ", " 나무", "나\t무", "😀", "나무😀", "👨‍👩‍👧", "나무!", "@pebble", "a_b", "a-b", "나무.", "ａｂ", "①", "ñ", "é"};
        for (String b : bad) {
            mvc.perform(PUT(u, "/me/nickname", Map.of("nickname", b))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BAD_NICKNAME"));
        }
        mvc.perform(PUT(u, "/me/nickname", new java.util.HashMap<String, Object>())).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BAD_NICKNAME"));   // 없음
        mvc.perform(PUT(u, "/me/nickname", java.util.Collections.singletonMap("nickname", null))).andExpect(status().isBadRequest());
        assertThat(nickname(u)).isEqualTo("나무");                                   // 거절된 요청은 아무것도 바꾸지 않는다
    }

    @Test
    void changingNeedsALoginAndAnExistingUser() throws Exception {
        mvc.perform(put("/me/nickname").contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"나무\"}")).andExpect(status().isUnauthorized());
        mvc.perform(PUT(9999L, "/me/nickname", Map.of("nickname", "나무"))).andExpect(status().isNotFound());
    }

    @Test
    void twoPeopleMayShareANicknameBecauseTheHandleIsTheUniqueName() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        mvc.perform(PUT(a, "/me/nickname", Map.of("nickname", "나무"))).andExpect(status().isOk());
        mvc.perform(PUT(b, "/me/nickname", Map.of("nickname", "나무"))).andExpect(status().isOk());
    }

    @Test
    void creatingAUserAppliesTheSameRuleAndHasATemporaryDefault() throws Exception {
        for (String bad : new String[] {"😀", "여섯글자이름이", "a b", "나무!"}) {
            mvc.perform(POST(0, "/dev/users", Map.of("nickname", bad))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BAD_NICKNAME"));
        }
        // 닉네임을 안 주면 임시 닉네임 "손님"을 쓴다 (구글 가입 직후와 같다)
        mvc.perform(POST(0, "/dev/users", Map.of())).andExpect(status().isCreated()).andExpect(jsonPath("$.nickname").value("손님"));
    }

    @Test
    void theDatabaseRefusesBadNicknamesForNewRows() {
        for (String bad : new String[] {"😀", "여섯글자이름이", "a b", "나무!", ""}) {
            assertThrows(DataIntegrityViolationException.class, () -> dsl.execute("insert into app_user(nickname) values (?)", bad));
        }
        dsl.execute("insert into app_user(nickname) values ('나무1')");
        assertThrows(DataIntegrityViolationException.class, () -> dsl.execute("update app_user set nickname = '나무!' where nickname = '나무1'"));
    }
}
