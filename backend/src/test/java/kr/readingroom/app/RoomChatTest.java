package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

/** 공유방 대화·읽음 (기준 시각 2026-11-17T03:00:00Z). 방은 API로 열어 규칙이 그대로 지켜진다. */
class RoomChatTest extends ApiTestBase {
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

    /** 방을 열고(개설자는 동의까지) 나머지 사용자를 들여 동의시킨다 */
    Room roomWith(Map<String, Object> b, long owner, long... guests) throws Exception {
        Room r = open(owner, b);
        mvc.perform(POST(owner, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        for (long g : guests) {
            mvc.perform(POST(g, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
            mvc.perform(POST(g, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        }
        return r;
    }

    ResultActions say(long uid, Room r, String content) throws Exception {
        return mvc.perform(POST(uid, "/rooms/" + r.id() + "/messages", m("content", content)));
    }

    /** 도배 제한(3초 3건·같은 글)에 걸리지 않게 시각을 옮겨 보낸다 */
    long sayOk(long uid, Room r, String content) throws Exception {
        clock.advance(Duration.ofSeconds(6));
        return body(say(uid, r, content).andExpect(status().isCreated()).andReturn()).get("id").asLong();
    }

    @Test
    void sendAndListInOrderWithAuthorAndPage() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room r = roomWith(m("kind", "SAME", "isbn", "9788937460449"), a, b);
        mvc.perform(POST(a, "/rooms/" + r.id() + "/messages", m("content", "  안녕하세요  ", "page", 42))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("  안녕하세요  ")).andExpect(jsonPath("$.page").value(42)).andExpect(jsonPath("$.mine").value(true))
                .andExpect(jsonPath("$.nickname").value("alice")).andExpect(jsonPath("$.publicId").value(publicId(a)))
                .andExpect(jsonPath("$.userId").doesNotExist()).andExpect(jsonPath("$.handle").doesNotExist())      // 핸들·내부 번호는 밖으로 나가지 않는다 (결정 #69)
                .andExpect(jsonPath("$.left").value(false))
                .andExpect(jsonPath("$.createdAt").value("2026-11-17T03:00:00Z")).andExpect(jsonPath("$.avatar.color").exists());
        clock.advance(Duration.ofSeconds(10));
        say(b, r, "반가워요").andExpect(status().isCreated()).andExpect(jsonPath("$.page").doesNotExist());
        mvc.perform(GET(b, "/rooms/" + r.id() + "/messages")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].nickname").value("alice")).andExpect(jsonPath("$[0].mine").value(false)).andExpect(jsonPath("$[0].page").value(42))
                .andExpect(jsonPath("$[1].content").value("반가워요")).andExpect(jsonPath("$[1].mine").value(true))
                .andExpect(jsonPath("$[0].progress").doesNotExist()).andExpect(jsonPath("$[0].percent").doesNotExist());
    }

    @Test
    void threeMessagesPerThreeSecondsPerUserAcrossRooms() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room r1 = roomWith(m("kind", "OWN"), a, b), r2 = roomWith(m("kind", "OWN"), a, b);
        say(a, r1, "하나").andExpect(status().isCreated());                              // 03:00:00
        clock.advance(Duration.ofSeconds(1));
        say(a, r2, "둘").andExpect(status().isCreated());                                // 방이 달라도 사용자당 센다
        clock.advance(Duration.ofSeconds(1));
        say(a, r1, "셋").andExpect(status().isCreated());                                // 03:00:02 — 3초 안에 3건째
        clock.advance(Duration.ofMillis(999));
        say(a, r1, "넷").andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.error").value("TOO_FAST"));   // 03:00:02.999 — 아직 3건
        say(b, r1, "다른 사람").andExpect(status().isCreated());                         // 다른 사람은 따로 센다
        clock.advance(Duration.ofMillis(1));
        say(a, r2, "다시").andExpect(status().isCreated());                               // 03:00:03 — 첫 글이 3초 밖으로 나가 한 자리가 난다
        say(a, r2, "또").andExpect(status().isTooManyRequests());                         // 03:00:01·02·03 의 3건이 창 안
        assertThat(dsl.fetchOne("select count(*) as n from room_message where user_id = ?", a).get("n", Integer.class)).isEqualTo(4);
    }

    @Test
    void quickShortTypistsAreNotBlocked() throws Exception {
        long a = newUser("alice");
        Room r = roomWith(m("kind", "OWN"), a);
        for (int i = 0; i < 12; i++) {                                                  // 1.1초마다 한 줄씩 계속 — 어떤 3초 창에도 3건을 넘지 않는다
            say(a, r, "짧은 글 " + i).andExpect(status().isCreated());
            clock.advance(Duration.ofMillis(1100));
        }
    }

    @Test
    void sameTextInARowIsBlockedForThirtySeconds() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room r1 = roomWith(m("kind", "OWN"), a, b), r2 = roomWith(m("kind", "OWN"), a, b);
        say(a, r1, "ㅋㅋ").andExpect(status().isCreated());
        clock.advance(Duration.ofSeconds(4));
        say(a, r1, "ㅋㅋ").andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("DUPLICATE_MESSAGE"));
        say(a, r1, "  ㅋㅋ \n").andExpect(status().isConflict());                     // 앞뒤 공백은 무시하고 비교
        say(a, r2, "ㅋㅋ").andExpect(status().isConflict());                             // 다른 방이어도 내 직전 글과 같으면 막는다
        say(b, r1, "ㅋㅋ").andExpect(status().isCreated());                              // 다른 사람은 같은 말을 해도 된다
        say(a, r1, "ㅋㅋㅋ").andExpect(status().isCreated());                            // 조금이라도 다르면 된다
        clock.advance(Duration.ofSeconds(4));
        say(a, r1, "ㅋㅋ").andExpect(status().isCreated());                              // 직전 글이 아니라 그 앞 글과 같은 것은 된다
        clock.advance(Duration.ofSeconds(29));
        say(a, r1, "ㅋㅋ").andExpect(status().isConflict());                             // 29초 뒤: 직전 글과 같음
        clock.advance(Duration.ofSeconds(1));
        say(a, r1, "ㅋㅋ").andExpect(status().isCreated());                              // 정확히 30초가 지나면 된다
        assertThat(dsl.fetchOne("select count(*) as n from room_message where user_id = ?", a).get("n", Integer.class)).isEqualTo(4);   // 막힌 글은 저장하지 않는다
    }

    @Test
    void blockedMessagesDoNotCountTowardTheRateLimit() throws Exception {
        long a = newUser("alice");
        Room r = roomWith(m("kind", "OWN"), a);
        say(a, r, "하나").andExpect(status().isCreated());
        for (int i = 0; i < 5; i++) say(a, r, "하나").andExpect(status().isConflict());   // 같은 글로 막히기만 한다
        say(a, r, "둘").andExpect(status().isCreated());
        say(a, r, "셋").andExpect(status().isCreated());
        say(a, r, "넷").andExpect(status().isTooManyRequests());
        for (int i = 0; i < 5; i++) say(a, r, "셋").andExpect(status().isTooManyRequests());
        clock.advance(Duration.ofSeconds(3));
        say(a, r, "넷").andExpect(status().isCreated());                                  // 막힌 요청이 시간을 늘리지 않는다
    }

    @Test
    void concurrentSendsFromOneUserNeverExceedThreeInTheWindow() throws Exception {
        long a = newUser("alice");
        Room r = roomWith(m("kind", "OWN"), a);
        var pool = Executors.newFixedThreadPool(6);
        List<Callable<Integer>> calls = new ArrayList<>();
        for (int i = 0; i < 6; i++) { String t = "글" + i; calls.add(() -> say(a, r, t).andReturn().getResponse().getStatus()); }
        int created = 0, tooFast = 0;
        for (var f : pool.invokeAll(calls)) {
            int st = f.get();
            if (st == 201) created++; else if (st == 429) tooFast++;
        }
        pool.shutdown();
        assertThat(created).isEqualTo(3);                                                // 3초에 3건까지
        assertThat(tooFast).isEqualTo(3);
    }

    @Test
    void contentAndPageValidation() throws Exception {
        long a = newUser("alice");
        Room same = roomWith(m("kind", "SAME", "isbn", "9788937460449"), a), own = roomWith(m("kind", "OWN"), a);
        String[] bad = {"", "   ", "\n\t"};
        for (String c : bad) { clock.advance(Duration.ofSeconds(6)); say(a, same, c).andExpect(status().isBadRequest()); }
        say(a, same, "가".repeat(301)).andExpect(status().isBadRequest());
        mvc.perform(POST(a, "/rooms/" + same.id() + "/messages", Map.of())).andExpect(status().isBadRequest());
        mvc.perform(POST(a, "/rooms/" + same.id() + "/messages", m("content", 123))).andExpect(status().isBadRequest());
        for (Object p : new Object[]{0, 10000, -1, "5", 2.5})
            mvc.perform(POST(a, "/rooms/" + same.id() + "/messages", m("content", "쪽", "page", p))).andExpect(status().isBadRequest());
        mvc.perform(POST(a, "/rooms/" + own.id() + "/messages", m("content", "쪽", "page", 3))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("PAGE_NOT_ALLOWED"));
        mvc.perform(post("/rooms/" + same.id() + "/messages").header("X-User-Id", a).contentType("application/json").content("{")).andExpect(status().isBadRequest());
        assertThat(dsl.fetchOne("select count(*) as n from room_message").get("n", Integer.class)).isZero();      // 실패한 글은 도배 제한 횟수에도 세지 않는다
        say(a, same, "가".repeat(300)).andExpect(status().isCreated());                                          // 경계: 300자
        clock.advance(Duration.ofSeconds(4));
        mvc.perform(POST(a, "/rooms/" + same.id() + "/messages", m("content", "😀".repeat(300), "page", 9999))).andExpect(status().isCreated());   // 글자 수는 이모지도 한 글자
        clock.advance(Duration.ofSeconds(4));
        mvc.perform(POST(a, "/rooms/" + same.id() + "/messages", m("content", "쪽", "page", 1))).andExpect(status().isCreated());
    }

    @Test
    void onlyAgreedParticipantsCanReadOrWrite() throws Exception {
        long a = newUser("alice"), b = newUser("bob"), c = newUser("carol");
        Room r = roomWith(m("kind", "OWN"), a);
        sayOk(a, r, "첫 글");
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());         // 들어왔지만 아직 동의 전
        mvc.perform(GET(b, "/rooms/" + r.id() + "/messages")).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("AGREE_REQUIRED"));
        say(b, r, "몰래").andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("AGREE_REQUIRED"));
        mvc.perform(GET(c, "/rooms/" + r.id() + "/messages")).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("NOT_PARTICIPANT"));
        say(c, r, "외부인").andExpect(status().isForbidden());
        mvc.perform(GET(a, "/rooms/9999/messages")).andExpect(status().isNotFound());
        say(a, new Room(9999, ""), "없는 방").andExpect(status().isNotFound());
        mvc.perform(get("/rooms/" + r.id() + "/messages")).andExpect(status().isUnauthorized());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        mvc.perform(GET(b, "/rooms/" + r.id() + "/messages")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());
        mvc.perform(GET(b, "/rooms/" + r.id() + "/messages")).andExpect(status().isForbidden());           // 나간 사람
        say(b, r, "나간 뒤").andExpect(status().isForbidden());
        assertThat(dsl.fetchOne("select count(*) as n from room_message").get("n", Integer.class)).isEqualTo(1);
    }

    @Test
    void writingOnlyWhileOpenButReadingForSevenDaysAfterClose() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room soon = roomWith(m("kind", "OWN", "openAt", "2026-11-17T05:00:00Z", "hours", 2), a, b);
        say(a, soon, "일러요").andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("ROOM_NOT_OPEN"));
        mvc.perform(GET(a, "/rooms/" + soon.id() + "/messages")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        clock.set("2026-11-17T05:30:00Z");                                                                  // 시각이 되면 배치 없이도 열린다
        say(a, soon, "열렸어요").andExpect(status().isCreated());
        clock.set("2026-11-17T07:00:00Z");                                                                  // 시간이 다 됨
        say(b, soon, "늦었어요").andExpect(status().isGone()).andExpect(jsonPath("$.error").value("ROOM_CLOSED"));
        mvc.perform(GET(b, "/rooms/" + soon.id() + "/messages")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(POST(b, "/rooms/" + soon.id() + "/read", Map.of())).andExpect(status().isOk());
        clock.set("2026-11-24T06:59:59Z");
        mvc.perform(GET(b, "/rooms/" + soon.id() + "/messages")).andExpect(status().isOk());
        clock.set("2026-11-24T07:00:00Z");                                                                  // 보관 7일이 지나면 없는 방
        mvc.perform(GET(b, "/rooms/" + soon.id() + "/messages")).andExpect(status().isNotFound());
        mvc.perform(POST(b, "/rooms/" + soon.id() + "/read", Map.of())).andExpect(status().isNotFound());

        clock.set("2026-11-25T03:00:00Z");
        Room early = roomWith(m("kind", "OWN"), a, b);
        sayOk(a, early, "곧 끝나요");
        mvc.perform(POST(a, "/rooms/" + early.id() + "/close", Map.of())).andExpect(status().isOk());       // 일찍 끝냄
        clock.advance(Duration.ofSeconds(10));
        say(b, early, "한마디만").andExpect(status().isGone());
        mvc.perform(GET(b, "/rooms/" + early.id() + "/messages")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void afterPagingAndRecentWindow() throws Exception {
        long a = newUser("alice");
        Room r = roomWith(m("kind", "OWN"), a);
        for (int i = 1; i <= 105; i++)
            dsl.execute("insert into room_message(room_id, user_id, content, created_at) values (?, ?, ?, now())", r.id(), a, "글" + i);
        var latest = body(mvc.perform(GET(a, "/rooms/" + r.id() + "/messages")).andReturn());
        assertThat(latest.size()).isEqualTo(100);                                                            // 가장 최근 100개, 오래된 순
        assertThat(latest.get(0).get("content").asText()).isEqualTo("글6");
        assertThat(latest.get(99).get("content").asText()).isEqualTo("글105");
        long firstId = latest.get(0).get("id").asLong();
        mvc.perform(GET(a, "/rooms/" + r.id() + "/messages?after=" + (firstId + 96))).andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].content").value("글103"));
        mvc.perform(GET(a, "/rooms/" + r.id() + "/messages?after=" + (firstId - 1))).andExpect(jsonPath("$.length()").value(100))
                .andExpect(jsonPath("$[0].content").value("글6"));
        mvc.perform(GET(a, "/rooms/" + r.id() + "/messages?after=0")).andExpect(jsonPath("$.length()").value(100)).andExpect(jsonPath("$[0].content").value("글1"));
        mvc.perform(GET(a, "/rooms/" + r.id() + "/messages?after=" + (firstId + 99))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(GET(a, "/rooms/" + r.id() + "/messages?after=abc")).andExpect(status().isBadRequest());
        mvc.perform(GET(a, "/rooms/" + r.id() + "/messages?after=-5")).andExpect(status().isBadRequest());
    }

    @Test
    void leavingMakesMessagesAnonymousButTheyStay() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room r = roomWith(m("kind", "OWN"), a, b);
        sayOk(a, r, "앨리스 글");
        sayOk(b, r, "밥의 글");
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());
        mvc.perform(GET(a, "/rooms/" + r.id() + "/messages")).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].content").value("밥의 글")).andExpect(jsonPath("$[1].nickname").value("나간 참여자")).andExpect(jsonPath("$[1].left").value(true))
                .andExpect(jsonPath("$[1].userId").doesNotExist()).andExpect(jsonPath("$[1].handle").doesNotExist()).andExpect(jsonPath("$[1].publicId").doesNotExist()).andExpect(jsonPath("$[1].avatar").doesNotExist())
                .andExpect(jsonPath("$[1].mine").value(false)).andExpect(jsonPath("$[0].nickname").value("alice"));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());              // 다시 들어와 동의하면 다시 이름으로 보인다
        mvc.perform(POST(b, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        mvc.perform(GET(b, "/rooms/" + r.id() + "/messages")).andExpect(jsonPath("$[1].nickname").value("bob")).andExpect(jsonPath("$[1].mine").value(true));
    }

    @Test
    void ownMessagesNeverMakeAStarAndReadClearsIt() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        Room r = roomWith(m("kind", "OWN"), a, b);
        sayOk(a, r, "앨리스");
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$[0].unread").value(false));                       // 내 글은 별을 만들지 않는다
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].unread").value(true));
        clock.advance(Duration.ofSeconds(1));
        mvc.perform(POST(b, "/rooms/" + r.id() + "/read", Map.of())).andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value(r.id())).andExpect(jsonPath("$.lastReadAt").value("2026-11-17T03:00:07Z"));
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].unread").value(false));
        sayOk(a, r, "또 한마디");
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].unread").value(true));
        mvc.perform(POST(b, "/rooms/" + r.id() + "/read", Map.of())).andExpect(status().isOk());
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].unread").value(false));
        sayOk(b, r, "밥도 한마디");
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].unread").value(false));
        assertThat(dsl.fetchOne("select last_read_at is not null as r from room_participant where room_id = ? and user_id = ?", r.id(), b).get("r", Boolean.class)).isTrue();
    }

    @Test
    void readIsForParticipantsOnly() throws Exception {
        long a = newUser("alice"), b = newUser("bob"), c = newUser("carol");
        Room r = roomWith(m("kind", "OWN"), a, b);
        mvc.perform(POST(c, "/rooms/" + r.id() + "/read", Map.of())).andExpect(status().isForbidden());
        mvc.perform(POST(a, "/rooms/9999/read", Map.of())).andExpect(status().isNotFound());
        mvc.perform(post("/rooms/" + r.id() + "/read")).andExpect(status().isUnauthorized());
        sayOk(a, r, "글");
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/read", Map.of())).andExpect(status().isForbidden());        // 나간 사람
        mvc.perform(GET(b, "/rooms")).andExpect(jsonPath("$[0].joined").value(false));   // 나가도 열린 방은 보이지만 참여 중은 아니다 (결정 #97)
        assertThat(dsl.fetchOne("select last_read_at from room_participant where room_id = ? and user_id = ?", r.id(), b).get("last_read_at")).isNull();
    }

    @Test
    void sentMessagesCannotBeEditedOrDeleted() throws Exception {
        long a = newUser("alice");
        Room r = roomWith(m("kind", "OWN"), a);
        long id = sayOk(a, r, "지울 수 없는 글");
        mvc.perform(DELETE(a, "/rooms/" + r.id() + "/messages/" + id)).andExpect(status().is4xxClientError());
        mvc.perform(PATCH(a, "/rooms/" + r.id() + "/messages/" + id, m("content", "고침"))).andExpect(status().is4xxClientError());
        mvc.perform(PUT(a, "/rooms/" + r.id() + "/messages/" + id, m("content", "고침"))).andExpect(status().is4xxClientError());
        mvc.perform(DELETE(a, "/rooms/" + r.id() + "/messages")).andExpect(status().is4xxClientError());
        assertThat(dsl.fetchOne("select content from room_message where id = ?", id).get("content", String.class)).isEqualTo("지울 수 없는 글");
    }

    // ---- 같은 규칙을 DB도 지킨다 ----

    void insert(long roomId, long uid, String content, Integer page) {
        dsl.execute("insert into room_message(room_id, user_id, content, page, created_at) values (?, ?, ?, ?, now())", roomId, uid, content, page);
    }

    @Test
    void databaseEnforcesLengthPageAndReferences() throws Exception {
        long a = newUser("alice");
        Room r = roomWith(m("kind", "OWN"), a);
        insert(r.id(), a, "가".repeat(300), 9999);
        insert(r.id(), a, "x", 1);
        assertThrows(Exception.class, () -> insert(r.id(), a, "가".repeat(301), null));
        assertThrows(Exception.class, () -> insert(r.id(), a, "", null));
        assertThrows(Exception.class, () -> insert(r.id(), a, "   ", null));
        assertThrows(Exception.class, () -> insert(r.id(), a, "쪽", 0));
        assertThrows(Exception.class, () -> insert(r.id(), a, "쪽", 10000));
        assertThrows(Exception.class, () -> insert(9999, a, "없는 방", null));
        assertThrows(Exception.class, () -> insert(r.id(), 9999, "없는 사람", null));
        assertThrows(Exception.class, () -> dsl.execute("insert into room_message(room_id, user_id, content) values (?, ?, 'x')", r.id(), a));   // 시각은 필수
        dsl.execute("delete from shared_room where id = ?", r.id());                                          // 방이 지워지면 글도 함께
        assertThat(dsl.fetchOne("select count(*) as n from room_message").get("n", Integer.class)).isZero();
    }
}
