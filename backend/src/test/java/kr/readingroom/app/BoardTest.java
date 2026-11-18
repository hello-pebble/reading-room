package kr.readingroom.app;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;

/** 마을 게시판 읽기: 내 방만, 상태는 시각으로 계산, 종료 방은 7일만 (기준 시각 2026-11-17T03:00:00Z) */
class BoardTest extends ApiTestBase {
    int seq = 0;

    long room(long creator, String title, String open, String close, String closedAt) {
        long id = dsl.fetchOne("insert into shared_room(created_by, kind, title, invite_code, open_at, close_at, closed_at) "
                + "values (?, 'OWN', ?, ?, ?::timestamptz, ?::timestamptz, ?::timestamptz) returning id", creator, title, "CODE000" + (++seq), open, close, closedAt).get("id", Long.class);
        dsl.execute("insert into room_participant(room_id, user_id, agreed_at) values (?, ?, now())", id, creator);
        return id;
    }

    @Test
    void onlyMyRoomsAndInviteCodeOnlyForOwner() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        long r = room(a, "책 자랑", "2026-11-17T02:00:00Z", "2026-11-17T05:00:00Z", null);
        mvc.perform(GET(a, "/rooms")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("책 자랑")).andExpect(jsonPath("$[0].status").value("OPEN"))
                .andExpect(jsonPath("$[0].mine").value(true)).andExpect(jsonPath("$[0].inviteCode").value("CODE0001"))
                .andExpect(jsonPath("$[0].ownerNickname").exists()).andExpect(jsonPath("$[0].participants").value(1));
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$.length()").value(0));
        dsl.execute("insert into room_participant(room_id, user_id) values (?, ?)", r, b);
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].mine").value(false))
                .andExpect(jsonPath("$[0].joined").value(true)).andExpect(jsonPath("$[0].agreed").value(false))
                .andExpect(jsonPath("$[0].inviteCode").doesNotExist()).andExpect(jsonPath("$[0].participants").value(2));
        dsl.execute("update room_participant set left_at = now() where room_id = ? and user_id = ?", r, b);
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$[0].participants").value(1));
    }

    @Test
    void statusIsComputedFromTimeAndClosedRoomsStaySevenDays() throws Exception {
        long a = newUser("alice");
        room(a, "곧", "2026-11-17T04:00:00Z", "2026-11-17T06:00:00Z", null);
        room(a, "지금", "2026-11-17T01:00:00Z", "2026-11-17T05:00:00Z", null);
        room(a, "시간 지남", "2026-11-16T23:00:00Z", "2026-11-17T02:00:00Z", null);
        room(a, "일찍 끝", "2026-11-17T01:00:00Z", "2026-11-17T06:00:00Z", "2026-11-17T02:30:00Z");
        room(a, "오래전", "2026-11-09T01:00:00Z", "2026-11-09T03:00:00Z", null);
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].title").value("지금")).andExpect(jsonPath("$[0].status").value("OPEN"))
                .andExpect(jsonPath("$[1].title").value("곧")).andExpect(jsonPath("$[1].status").value("SCHEDULED"))
                .andExpect(jsonPath("$[1].deleteAt").doesNotExist())
                .andExpect(jsonPath("$[2].status").value("CLOSED")).andExpect(jsonPath("$[3].status").value("CLOSED"))
                .andExpect(jsonPath("$[2].title").value("일찍 끝")).andExpect(jsonPath("$[2].deleteAt").value("2026-11-24T02:30:00Z"))
                .andExpect(jsonPath("$[3].title").value("시간 지남")).andExpect(jsonPath("$[3].deleteAt").value("2026-11-24T02:00:00Z"));
        clock.set("2026-11-24T02:10:00Z");
        mvc.perform(GET(a, "/rooms?status=CLOSED")).andExpect(jsonPath("$.length()").value(3))   // 시간 지남은 사라지고, 지금·곧은 그사이 끝나 지난 방이 된다
                .andExpect(jsonPath("$[0].title").value("곧")).andExpect(jsonPath("$[1].title").value("지금")).andExpect(jsonPath("$[2].title").value("일찍 끝"));
    }

    @Test
    void statusFilterAndBadStatus() throws Exception {
        long a = newUser("alice");
        room(a, "곧", "2026-11-17T04:00:00Z", "2026-11-17T06:00:00Z", null);
        room(a, "지금", "2026-11-17T01:00:00Z", "2026-11-17T05:00:00Z", null);
        mvc.perform(GET(a, "/rooms?status=OPEN")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("지금"));
        mvc.perform(GET(a, "/rooms?status=SCHEDULED")).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(GET(a, "/rooms?status=NOPE")).andExpect(status().isBadRequest());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/rooms")).andExpect(status().isUnauthorized());
    }

    @Test
    void roomLengthAndIsbnRulesAreEnforcedByTheDatabase() throws Exception {
        long a = newUser("alice");
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> room(a, "너무 김", "2026-11-17T01:00:00Z", "2026-11-17T09:00:00Z", null));
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> dsl.execute("insert into shared_room(created_by, kind, title, invite_code, open_at, close_at) "
                + "values (?, 'SAME', 'x', 'CODE9999', now(), now() + interval '2 hours')", a));
    }
}
