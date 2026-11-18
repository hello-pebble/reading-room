package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 공유방 개방 알림 켜기·끄기 (기준 시각 2026-11-17T03:00:00Z) */
class RoomAlarmTest extends ApiTestBase {
    Map<String, Object> m(Object... kv) {
        Map<String, Object> b = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) b.put((String) kv[i], kv[i + 1]);
        return b;
    }

    record Room(long id, String code) {}

    Room open(long uid, Map<String, Object> b) throws Exception {
        var r = body(mvc.perform(POST(uid, "/rooms", b)).andExpect(status().isCreated()).andReturn());
        return new Room(r.get("id").asLong(), r.get("inviteCode").asText());
    }

    Room scheduled(long owner, long... guests) throws Exception {
        Room r = open(owner, m("kind", "OWN", "openAt", "2026-11-17T08:00:00Z"));
        for (long g : guests) mvc.perform(POST(g, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        return r;
    }

    @Test
    void turnOnAndOffAndTheBoardShowsIt() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        Room r = scheduled(a, b);
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].alarm").value(false));
        mvc.perform(PUT(b, "/rooms/" + r.id() + "/alarm", Map.of())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomId").value(r.id())).andExpect(jsonPath("$.alarm").value(true));
        mvc.perform(PUT(b, "/rooms/" + r.id() + "/alarm", Map.of())).andExpect(status().isOk()).andExpect(jsonPath("$.alarm").value(true));   // 멱등
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].alarm").value(true));
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$[0].alarm").value(false));                                    // 사람마다 따로
        mvc.perform(PUT(a, "/rooms/" + r.id() + "/alarm", Map.of())).andExpect(status().isCreated());                    // 개설자도 켤 수 있다
        assertThat(dsl.fetchOne("select count(*) as n from room_alarm where room_id = ?", r.id()).get("n", Integer.class)).isEqualTo(2);
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/alarm")).andExpect(status().isNoContent());
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/alarm")).andExpect(status().isNoContent());                         // 이미 꺼도 204
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].alarm").value(false));
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$[0].alarm").value(true));
    }

    @Test
    void onlyParticipantsAndOnlyBeforeTheRoomOpens() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol");
        Room later = scheduled(a, b);
        mvc.perform(PUT(c, "/rooms/" + later.id() + "/alarm", Map.of())).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("NOT_PARTICIPANT"));
        mvc.perform(PUT(a, "/rooms/9999/alarm", Map.of())).andExpect(status().isNotFound());
        mvc.perform(DELETE(a, "/rooms/9999/alarm")).andExpect(status().isNotFound());
        mvc.perform(put("/rooms/" + later.id() + "/alarm")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/rooms/" + later.id() + "/alarm")).andExpect(status().isUnauthorized());
        clock.set("2026-11-17T08:00:00Z");                                                                              // 시각이 되면 열린 방
        mvc.perform(PUT(b, "/rooms/" + later.id() + "/alarm", Map.of())).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("ROOM_ALREADY_OPEN"));
        clock.set("2026-11-17T12:00:00Z");                                                                              // 끝난 방
        mvc.perform(PUT(b, "/rooms/" + later.id() + "/alarm", Map.of())).andExpect(status().isGone());
        clock.set("2026-11-25T12:00:00Z");                                                                              // 보관 7일이 지나면 없는 방
        mvc.perform(PUT(b, "/rooms/" + later.id() + "/alarm", Map.of())).andExpect(status().isNotFound());
        assertThat(dsl.fetchOne("select count(*) as n from room_alarm").get("n", Integer.class)).isZero();
    }

    @Test
    void leavingOrCancelingRemovesTheAlarm() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        Room r = scheduled(a, b);
        mvc.perform(PUT(b, "/rooms/" + r.id() + "/alarm", Map.of())).andExpect(status().isCreated());
        mvc.perform(PUT(a, "/rooms/" + r.id() + "/alarm", Map.of())).andExpect(status().isCreated());
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());               // 나가면 알림도 꺼진다
        assertThat(dsl.fetchOne("select count(*) as n from room_alarm where user_id = ?", b).get("n", Integer.class)).isZero();
        mvc.perform(PUT(b, "/rooms/" + r.id() + "/alarm", Map.of())).andExpect(status().isForbidden());
        mvc.perform(POST(a, "/rooms/" + r.id() + "/close", Map.of())).andExpect(status().isOk());                       // 예정 방 취소 → 행과 함께 사라진다
        assertThat(dsl.fetchOne("select count(*) as n from room_alarm").get("n", Integer.class)).isZero();
    }

    @Test
    void databaseKeepsOneAlarmPerUserAndRoomAndCascades() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        Room r = scheduled(a);
        dsl.execute("insert into room_alarm(user_id, room_id, created_at) values (?, ?, now())", b, r.id());
        assertThrows(Exception.class, () -> dsl.execute("insert into room_alarm(user_id, room_id, created_at) values (?, ?, now())", b, r.id()));   // 중복
        assertThrows(Exception.class, () -> dsl.execute("insert into room_alarm(user_id, room_id, created_at) values (9999, ?, now())", r.id()));
        assertThrows(Exception.class, () -> dsl.execute("insert into room_alarm(user_id, room_id, created_at) values (?, 9999, now())", a));
        assertThrows(Exception.class, () -> dsl.execute("insert into room_alarm(user_id, room_id) values (?, ?)", a, r.id()));                       // 시각 필수
        dsl.execute("delete from app_user where id = ?", b);
        assertThat(dsl.fetchOne("select count(*) as n from room_alarm").get("n", Integer.class)).isZero();
        dsl.execute("insert into room_alarm(user_id, room_id, created_at) values (?, ?, now())", a, r.id());
        dsl.execute("delete from shared_room where id = ?", r.id());
        assertThat(dsl.fetchOne("select count(*) as n from room_alarm").get("n", Integer.class)).isZero();
    }
}
