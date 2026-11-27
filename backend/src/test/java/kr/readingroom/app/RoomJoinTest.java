package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;

/** 공유방 입장·나가기·보관 동의 (기준 시각 2026-11-17T03:00:00Z) */
class RoomJoinTest extends ApiTestBase {
    Map<String, Object> m(Object... kv) {
        Map<String, Object> b = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) b.put((String) kv[i], kv[i + 1]);
        return b;
    }

    long book(long uid, String title, String isbn) {
        return dsl.fetchOne("insert into book(user_id, isbn, title, status) values (?, ?, ?, 'LATER') returning id", uid, isbn, title).get("id", Long.class);
    }

    /** 방을 열고 {id, code}를 돌려준다 */
    record Room(long id, String code) {}

    Room open(long uid, Map<String, Object> b) throws Exception {
        var r = body(mvc.perform(POST(uid, "/rooms", b)).andExpect(status().isCreated()).andReturn());
        return new Room(r.get("id").asLong(), r.get("inviteCode").asText());
    }

    int active(long roomId) {
        return dsl.fetchOne("select count(*) as n from room_participant where room_id = ? and left_at is null", roomId).get("n", Integer.class);
    }

    @Test
    void joinAddsParticipantAndShowsRoomOnTheBoard() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room r = open(a, m("kind", "OWN", "maxParticipants", 3));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(r.id())).andExpect(jsonPath("$.joined").value(true)).andExpect(jsonPath("$.mine").value(false))
                .andExpect(jsonPath("$.participants").value(2)).andExpect(jsonPath("$.agreed").value(false)).andExpect(jsonPath("$.inviteCode").doesNotExist());
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(r.id()));
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$[0].participants").value(2));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code().toLowerCase() + " "))).andExpect(status().isOk());      // 대소문자·공백을 가리지 않는다
    }

    @Test
    void joiningAgainIsIdempotentAndKeepsEverythingAsIs() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        long bk = book(b, "싯다르타", "9788937460111");
        Room r = open(a, m("kind", "OWN", "maxParticipants", 2));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code(), "bookId", bk))).andExpect(status().isCreated());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        clock.set("2026-11-17T03:30:00Z");
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isOk())            // 정원이 차도 이미 참여 중이면 200
                .andExpect(jsonPath("$.participants").value(2)).andExpect(jsonPath("$.agreed").value(true));
        mvc.perform(POST(a, "/rooms/join", m("code", r.code()))).andExpect(status().isOk());           // 개설자가 자기 코드로 들어와도 그대로
        var p = dsl.fetchOne("select book_id, joined_at from room_participant where room_id = ? and user_id = ?", r.id(), b);
        assertThat(p.get("book_id", Long.class)).isEqualTo(bk);
        assertThat(p.get("joined_at", java.time.OffsetDateTime.class).toInstant()).isEqualTo(java.time.Instant.parse("2026-11-17T03:00:00Z"));
        assertThat(active(r.id())).isEqualTo(2);
    }

    @Test
    void fullRoomIs409AndALeavingSeatFreesIt() throws Exception {
        long a = newUser("alice"), b = newUser("bob"), c = newUser("carol");
        Room r = open(a, m("kind", "OWN", "maxParticipants", 2));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        mvc.perform(POST(c, "/rooms/join", m("code", r.code()))).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("ROOM_FULL"));
        assertThat(active(r.id())).isEqualTo(2);
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());
        mvc.perform(POST(c, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isConflict());     // 나갔다 돌아와도 정원이 차 있으면 못 들어온다
    }

    @Test
    void concurrentJoinsNeverExceedTheLimit() throws Exception {
        long a = newUser("alice");
        Room r = open(a, m("kind", "OWN", "maxParticipants", 4));
        List<Long> users = new ArrayList<>();
        for (int i = 0; i < 8; i++) users.add(newUser("user" + i));
        var pool = Executors.newFixedThreadPool(8);
        List<Callable<Integer>> calls = new ArrayList<>();
        for (long u : users) calls.add(() -> mvc.perform(POST(u, "/rooms/join", m("code", r.code()))).andReturn().getResponse().getStatus());
        int created = 0, full = 0;
        for (var f : pool.invokeAll(calls)) {
            int st = f.get();
            if (st == 201) created++;
            else if (st == 409) full++;
        }
        pool.shutdown();
        assertThat(created).isEqualTo(3);                                                              // 개설자 포함 4명
        assertThat(full).isEqualTo(5);
        assertThat(active(r.id())).isEqualTo(4);
    }

    @Test
    void closedOrCanceledOrUnknownRoomsCannotBeJoined() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room closedEarly = open(a, m("kind", "OWN"));
        Room timedOut = open(a, m("kind", "OWN", "hours", 1));
        mvc.perform(POST(a, "/rooms/" + closedEarly.id() + "/close", Map.of())).andExpect(status().isOk());
        mvc.perform(POST(b, "/rooms/join", m("code", closedEarly.code()))).andExpect(status().isGone()).andExpect(jsonPath("$.error").value("ROOM_CLOSED"));
        clock.set("2026-11-17T04:00:00Z");                                                             // 시간이 다 됨 (배치 없이도 계산)
        mvc.perform(POST(b, "/rooms/join", m("code", timedOut.code()))).andExpect(status().isGone());
        clock.set("2026-11-20T04:00:00Z");                                                             // 보관 기간 안이어도, 지나도 410
        mvc.perform(POST(b, "/rooms/join", m("code", timedOut.code()))).andExpect(status().isGone());
        clock.set("2026-11-17T04:00:00Z");
        Room later = open(a, m("kind", "OWN", "openAt", "2026-11-17T08:00:00Z"));
        mvc.perform(POST(a, "/rooms/" + later.id() + "/close", Map.of())).andExpect(status().isOk());   // 취소 → 행이 없다
        mvc.perform(POST(b, "/rooms/join", m("code", later.code()))).andExpect(status().isNotFound());
        mvc.perform(POST(b, "/rooms/join", m("code", "AAAAAAAA"))).andExpect(status().isNotFound());
        mvc.perform(POST(b, "/rooms/join", m("code", " "))).andExpect(status().isBadRequest());
        mvc.perform(POST(b, "/rooms/join", Map.of())).andExpect(status().isBadRequest());
        mvc.perform(post("/rooms/join").contentType("application/json").content("{\"code\":\"AAAAAAAA\"}")).andExpect(status().isUnauthorized());
        assertThat(dsl.fetchOne("select count(*) as n from room_participant where user_id = ?", b).get("n", Integer.class)).isZero();
    }

    @Test
    void scheduledRoomCanBeJoinedBeforeItOpens() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room r = open(a, m("kind", "OWN", "openAt", "2026-11-17T08:00:00Z"));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("SCHEDULED"));
    }

    @Test
    void bookIsCheckedAgainstTheRoom() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        long abook = book(a, "데미안", "9788937460449");
        long same = book(b, "데미안(내 책)", "9788937460449"), other = book(b, "싯다르타", "9788937460111"), notMine = book(a, "다른 책", "9788937460222");
        Room same1 = open(a, m("kind", "SAME", "isbn", "9788937460449", "bookId", abook));
        mvc.perform(POST(b, "/rooms/join", m("code", same1.code(), "bookId", other))).andExpect(status().isBadRequest());     // 같은 책 방인데 다른 책
        mvc.perform(POST(b, "/rooms/join", m("code", same1.code(), "bookId", notMine))).andExpect(status().isNotFound());       // 남의 책
        mvc.perform(POST(b, "/rooms/join", m("code", same1.code(), "bookId", "x"))).andExpect(status().isBadRequest());
        assertThat(active(same1.id())).isEqualTo(1);                                                                           // 실패하면 들어가지 않는다
        mvc.perform(POST(b, "/rooms/join", m("code", same1.code(), "bookId", same))).andExpect(status().isCreated());
        long c = newUser("carol");
        mvc.perform(POST(c, "/rooms/join", m("code", same1.code()))).andExpect(status().isCreated());                            // 책은 없어도 된다
        Room own = open(a, m("kind", "OWN"));
        mvc.perform(POST(b, "/rooms/join", m("code", own.code(), "bookId", other))).andExpect(status().isCreated());              // 각자 읽기는 아무 내 책
        assertThat(dsl.fetchOne("select book_id from room_participant where room_id = ? and user_id = ?", own.id(), b).get("book_id", Long.class)).isEqualTo(other);
    }

    @Test
    void leaveThenRejoinIsAllowedAndAsksForAgreementAgain() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        long bk = book(b, "싯다르타", "9788937460111");
        Room r = open(a, m("kind", "OWN"));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].joined").value(false));   // 나가도 열린 방은 보이지만 참여 중은 아니다 (결정 #97)
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$[0].participants").value(1));
        clock.set("2026-11-17T04:00:00Z");
        mvc.perform(POST(b, "/rooms/join", m("code", r.code(), "bookId", bk))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.joined").value(true)).andExpect(jsonPath("$.agreed").value(false)).andExpect(jsonPath("$.participants").value(2));
        var p = dsl.fetchOne("select book_id, left_at, joined_at from room_participant where room_id = ? and user_id = ?", r.id(), b);
        assertThat(p.get("left_at")).isNull();
        assertThat(p.get("book_id", Long.class)).isEqualTo(bk);
        assertThat(p.get("joined_at", java.time.OffsetDateTime.class).toInstant()).isEqualTo(java.time.Instant.parse("2026-11-17T04:00:00Z"));
        assertThat(dsl.fetchOne("select count(*) as n from room_participant where room_id = ?", r.id()).get("n", Integer.class)).isEqualTo(2);   // 새 행이 아니라 같은 행
    }

    @Test
    void leaveRules() throws Exception {
        long a = newUser("alice"), b = newUser("bob"), c = newUser("carol");
        Room r = open(a, m("kind", "OWN"));
        mvc.perform(DELETE(a, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("OWNER_CANNOT_LEAVE"));
        mvc.perform(DELETE(c, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNotFound());       // 들어온 적 없음
        mvc.perform(DELETE(a, "/rooms/9999/participants/me")).andExpect(status().isNotFound());
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNotFound());       // 이미 나감
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/rooms/" + r.id() + "/participants/me")).andExpect(status().isUnauthorized());
        assertThat(dsl.fetchOne("select left_at from room_participant where room_id = ? and user_id = ?", r.id(), b).get("left_at")).isNotNull();   // 행은 남는다
        mvc.perform(POST(a, "/rooms/" + r.id() + "/close", Map.of())).andExpect(status().isOk());              // 개설자는 닫기로 끝낸다
    }

    @Test
    void agreeRecordsFirstTimeAndIsParticipantOnly() throws Exception {
        long a = newUser("alice"), b = newUser("bob"), c = newUser("carol");
        Room r = open(a, m("kind", "OWN"));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value(r.id())).andExpect(jsonPath("$.agreedAt").value("2026-11-17T03:00:00Z"));
        clock.set("2026-11-17T03:20:00Z");
        mvc.perform(POST(b, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk()).andExpect(jsonPath("$.agreedAt").value("2026-11-17T03:00:00Z"));   // 처음 시각 유지
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].agreed").value(true));
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$[0].agreed").value(false));
        mvc.perform(POST(c, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isForbidden());      // 참여자가 아님
        mvc.perform(POST(a, "/rooms/9999/agree", Map.of())).andExpect(status().isNotFound());
        mvc.perform(post("/rooms/" + r.id() + "/agree")).andExpect(status().isUnauthorized());
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isForbidden());      // 나간 사람도 안 된다
    }

    // ---- 같은 규칙을 DB도 지킨다 ----

    @Test
    void databaseKeepsOneRowPerParticipantAndValidReferences() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room r = open(a, m("kind", "OWN"));
        assertThrows(Exception.class, () -> dsl.execute("insert into room_participant(room_id, user_id) values (?, ?)", r.id(), a));      // (방, 사용자) 중복
        assertThrows(Exception.class, () -> dsl.execute("insert into room_participant(room_id, user_id) values (9999, ?)", b));            // 없는 방
        assertThrows(Exception.class, () -> dsl.execute("insert into room_participant(room_id, user_id) values (?, 9999)", r.id()));      // 없는 사용자
        assertThrows(Exception.class, () -> dsl.execute("insert into room_participant(room_id, user_id, book_id) values (?, ?, 9999)", r.id(), b));   // 없는 책
        long bk = book(b, "싯다르타", "9788937460111");
        mvc.perform(POST(b, "/rooms/join", m("code", r.code(), "bookId", bk))).andExpect(status().isCreated());
        dsl.execute("delete from book where id = ?", bk);                                                                                    // 책을 지워도 참여는 남고 책만 비운다
        assertThat(dsl.fetchOne("select book_id from room_participant where room_id = ? and user_id = ?", r.id(), b).get("book_id")).isNull();
        dsl.execute("delete from shared_room where id = ?", r.id());                                                                         // 방을 지우면 참여자도 지워진다
        assertThat(dsl.fetchOne("select count(*) as n from room_participant").get("n", Integer.class)).isZero();
    }
}
