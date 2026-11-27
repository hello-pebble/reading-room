package kr.readingroom.app;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 모닥불 참여자 명단 GET /rooms/{id}/participants (결정 #92): 모닥불 장면에 실제 참여자를 그린다 */
class RoomParticipantsTest extends ApiTestBase {
    Map<String, Object> m(Object... kv) {
        Map<String, Object> b = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) b.put((String) kv[i], kv[i + 1]);
        return b;
    }

    long book(long uid, String title) {
        return dsl.fetchOne("insert into book(user_id, title, status) values (?, ?, 'READING') returning id", uid, title).get("id", Long.class);
    }

    record Room(long id, String code) {}

    Room open(long uid, Map<String, Object> b) throws Exception {
        var r = body(mvc.perform(POST(uid, "/rooms", b)).andExpect(status().isCreated()).andReturn());
        return new Room(r.get("id").asLong(), r.get("inviteCode").asText());
    }

    @Test
    void listsCurrentParticipantsInJoinOrderWithTheirBook() throws Exception {
        long a = newUser("alice"), b = newUser("bob"), c = newUser("carol");
        long ab = book(a, "데미안"), bb = book(b, "싯다르타");
        Room r = open(a, m("kind", "OWN", "bookId", ab));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code(), "bookId", bb))).andExpect(status().isCreated());
        mvc.perform(POST(c, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());

        mvc.perform(GET(b, "/rooms/" + r.id() + "/participants")).andExpect(status().isOk())   // 보관 동의 전에도 모닥불 둘레는 보인다
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].publicId").value(publicId(a))).andExpect(jsonPath("$[0].nickname").value("alice"))
                .andExpect(jsonPath("$[0].owner").value(true)).andExpect(jsonPath("$[0].mine").value(false))
                .andExpect(jsonPath("$[0].avatar.color").exists())
                .andExpect(jsonPath("$[1].publicId").value(publicId(b))).andExpect(jsonPath("$[1].mine").value(true))
                .andExpect(jsonPath("$[1].bookTitle").value("싯다르타"))
                .andExpect(jsonPath("$[2].nickname").value("carol")).andExpect(jsonPath("$[2].bookTitle").doesNotExist())
                .andExpect(jsonPath("$[0].id").doesNotExist()).andExpect(jsonPath("$[0].userId").doesNotExist());   // 공개 번호로만 (결정 #69)

        mvc.perform(DELETE(c, "/rooms/" + r.id() + "/participants/me")).andExpect(status().is2xxSuccessful());
        mvc.perform(GET(a, "/rooms/" + r.id() + "/participants")).andExpect(jsonPath("$.length()").value(2));   // 나간 사람은 빠진다
    }

    @Test
    void onlyParticipantsCanSeeTheList() throws Exception {
        long a = newUser("alice"), x = newUser("xeno");
        Room r = open(a, m("kind", "OWN"));
        mvc.perform(GET(x, "/rooms/" + r.id() + "/participants")).andExpect(status().isForbidden())   // 대화와 같은 규칙
                .andExpect(jsonPath("$.error").value("NOT_PARTICIPANT"));
        mvc.perform(GET(a, "/rooms/999999/participants")).andExpect(status().isNotFound());
    }
}
