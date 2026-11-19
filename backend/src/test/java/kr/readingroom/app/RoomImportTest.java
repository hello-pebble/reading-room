package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 내 서재로 가져오기와 책의 공유방 탭 (기준 시각 2026-11-17T03:00:00Z). 방은 API로 열어 규칙이 그대로 지켜진다. */
class RoomImportTest extends ApiTestBase {
    static final String ISBN = "9788937460449";

    Map<String, Object> m(Object... kv) {
        Map<String, Object> b = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) b.put((String) kv[i], kv[i + 1]);
        return b;
    }

    record Room(long id, String code) {}

    long book(long uid, String isbn, String title, String status) {
        return dsl.fetchOne("insert into book(user_id, isbn, title, author, cover_url, total_pages, current_page, status) values (?, ?, ?, '헤세', 'https://img/c.jpg', 200, 0, ?) returning id",
                uid, isbn, title, status).get("id", Long.class);
    }

    /** 방을 열고(개설자 동의) 손님을 들여 동의시킨다. 손님이 book을 고르려면 joinBooks에 userId→bookId */
    Room roomWith(Map<String, Object> b, long owner, Map<Long, Long> guests) throws Exception {
        var r = body(mvc.perform(POST(owner, "/rooms", b)).andExpect(status().isCreated()).andReturn());
        Room room = new Room(r.get("id").asLong(), r.get("inviteCode").asText());
        mvc.perform(POST(owner, "/rooms/" + room.id() + "/agree", Map.of())).andExpect(status().isOk());
        for (var g : guests.entrySet()) {
            Map<String, Object> j = m("code", room.code());
            if (g.getValue() != null) j.put("bookId", g.getValue());
            mvc.perform(POST(g.getKey(), "/rooms/join", j)).andExpect(status().isCreated());
            mvc.perform(POST(g.getKey(), "/rooms/" + room.id() + "/agree", Map.of())).andExpect(status().isOk());
        }
        return room;
    }

    /** 책을 고르지 않고 입장하는 손님 */
    Map<Long, Long> noBook(long... users) {
        Map<Long, Long> g = new java.util.LinkedHashMap<>();
        for (long u : users) g.put(u, null);
        return g;
    }

    void say(long uid, Room r, String text, Integer page) throws Exception {
        clock.advance(Duration.ofSeconds(2));
        Map<String, Object> b = m("content", text);
        if (page != null) b.put("page", page);
        mvc.perform(POST(uid, "/rooms/" + r.id() + "/messages", b)).andExpect(status().isCreated());
    }

    void end(long owner, Room r) throws Exception {
        clock.advance(Duration.ofSeconds(1));
        mvc.perform(POST(owner, "/rooms/" + r.id() + "/close", Map.of())).andExpect(status().isOk());
    }

    @Test
    void importAttachesAnonymizedSnapshotToTheBookIChose() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol");
        long ba = book(a, ISBN, "데미안", "READING"), bb = book(b, ISBN, "데미안", "DONE");
        Room r = roomWith(m("kind", "SAME", "isbn", ISBN, "bookId", ba), a, new java.util.LinkedHashMap<>(Map.of(b, bb)));
        say(b, r, "밥의 첫 글", 12);
        say(a, r, "앨리스 글", null);
        say(b, r, "밥의 둘째", 30);
        mvc.perform(POST(c, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        mvc.perform(POST(c, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        say(c, r, "캐롤 글", 99);
        end(a, r);
        mvc.perform(POST(b, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.bookId").value(bb)).andExpect(jsonPath("$.bookStatus").value("DONE")).andExpect(jsonPath("$.bookCreated").value(false))
                .andExpect(jsonPath("$.roomId").value(r.id())).andExpect(jsonPath("$.roomTitle").value("『데미안』 같이 읽기")).andExpect(jsonPath("$.kind").value("SAME"))
                .andExpect(jsonPath("$.messageCount").value(4)).andExpect(jsonPath("$.messages").doesNotExist());
        var tab = body(mvc.perform(GET(b, "/books/" + bb + "/rooms")).andExpect(status().isOk()).andReturn());
        assertThat(tab.size()).isEqualTo(1);
        var msgs = tab.get(0).get("messages");
        assertThat(msgs.size()).isEqualTo(4);
        assertThat(msgs.get(0).get("author").asText()).isEqualTo("나");                                                  // 내 글
        assertThat(msgs.get(0).get("mine").asBoolean()).isTrue();
        assertThat(msgs.get(0).get("page").asInt()).isEqualTo(12);
        assertThat(msgs.get(1).get("author").asText()).isEqualTo("참여자 A");                                             // 다른 사람은 처음 말한 순서로 A, B
        assertThat(msgs.get(1).get("page").isNull()).isTrue();
        assertThat(msgs.get(2).get("author").asText()).isEqualTo("나");
        assertThat(msgs.get(3).get("author").asText()).isEqualTo("참여자 B");
        assertThat(msgs.get(3).get("content").asText()).isEqualTo("캐롤 글");
        String raw = tab.toString();
        assertThat(raw).doesNotContain("alice").doesNotContain("carol").doesNotContain("userId");                       // 실명·id가 새지 않는다
        assertThat(dsl.fetchOne("select snapshot::text as s from book_room_archive").get("s", String.class)).doesNotContain("alice").doesNotContain("carol");
        assertThat(dsl.fetchOne("select snapshot->>'roomType' as t from book_room_archive").get("t", String.class)).isEqualTo("SAME");
        // 같은 방의 다른 사람이 가져오면 시점이 달라 A/B가 그 사람 기준으로 다시 붙는다
        mvc.perform(POST(a, "/rooms/" + r.id() + "/import", m("bookId", ba))).andExpect(status().isCreated());
        assertThat(body(mvc.perform(GET(a, "/books/" + ba + "/rooms")).andReturn()).get(0).get("messages").get(0).get("author").asText()).isEqualTo("참여자 A");
    }

    @Test
    void importingAgainReturnsTheSameArchive() throws Exception {
        long a = newUser("alice");
        long ba = book(a, ISBN, "데미안", "READING");
        Room r = roomWith(m("kind", "SAME", "isbn", ISBN, "bookId", ba), a, Map.of());
        say(a, r, "혼잣말", null);
        end(a, r);
        long id = body(mvc.perform(POST(a, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isCreated()).andReturn()).get("id").asLong();
        mvc.perform(post("/rooms/" + r.id() + "/import").header("X-User-Id", a)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));   // 본문 없이도, 멱등
        mvc.perform(POST(a, "/rooms/" + r.id() + "/import", m("bookId", ba))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        assertThat(dsl.fetchOne("select count(*) as n from book_room_archive").get("n", Integer.class)).isEqualTo(1);
    }

    @Test
    void withoutABookTheSameBookRoomUsesMyCopyOrCreatesALaterBook() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol");
        long ba = book(a, ISBN, "데미안", "READING"), bc = book(c, ISBN, "데미안(내 책)", "DROPPED");
        Room r = roomWith(m("kind", "SAME", "isbn", ISBN, "bookId", ba), a, noBook(b));
        mvc.perform(POST(c, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());                         // 책을 안 고르고 입장
        mvc.perform(POST(c, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        say(a, r, "안녕", 3);
        end(a, r);
        mvc.perform(POST(c, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isCreated())                    // 같은 ISBN의 내 책(포기)에 붙는다
                .andExpect(jsonPath("$.bookId").value(bc)).andExpect(jsonPath("$.bookStatus").value("DROPPED")).andExpect(jsonPath("$.bookCreated").value(false));
        // b는 같은 ISBN 책이 없다 → 방을 연 사람의 책 정보로 "나중에 읽을 책"을 만든다
        var res = body(mvc.perform(POST(b, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.bookStatus").value("LATER")).andExpect(jsonPath("$.bookCreated").value(true)).andReturn());
        long later = res.get("bookId").asLong();
        var book = dsl.fetchOne("select user_id, isbn, title, author, status, current_page, started_at, finished_at from book where id = ?", later);
        assertThat(book.get("user_id", Long.class)).isEqualTo(b);
        assertThat(book.get("isbn", String.class)).isEqualTo(ISBN);
        assertThat(book.get("title", String.class)).isEqualTo("데미안");
        assertThat(book.get("started_at")).isNull();
        assertThat(book.get("finished_at")).isNull();
        mvc.perform(GET(b, "/books?status=LATER")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(later));
        mvc.perform(GET(b, "/books?status=DONE")).andExpect(jsonPath("$.length()").value(0));                              // 완독 수에 세지 않는다
        mvc.perform(GET(b, "/me/calendar")).andExpect(jsonPath("$.finishedCount").value(0));
        // 같은 책의 다른 방을 가져오면 만들어 둔 나중에 읽을 책에 붙는다 (새 책을 또 만들지 않는다)
        clock.advance(Duration.ofSeconds(2));
        Room r2 = roomWith(m("kind", "SAME", "isbn", ISBN, "bookId", ba), a, Map.of());
        mvc.perform(POST(b, "/rooms/join", m("code", r2.code()))).andExpect(status().isCreated());
        mvc.perform(POST(b, "/rooms/" + r2.id() + "/agree", Map.of())).andExpect(status().isOk());
        say(a, r2, "두 번째 방", null);
        end(a, r2);
        mvc.perform(POST(b, "/rooms/" + r2.id() + "/import", Map.of())).andExpect(status().isCreated()).andExpect(jsonPath("$.bookId").value(later)).andExpect(jsonPath("$.bookCreated").value(false));
        mvc.perform(GET(b, "/books/" + later + "/rooms")).andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[0].roomId").value(r2.id()));   // 최근에 가져온 것부터
    }

    @Test
    void ownBookRoomNeedsABookToAttachTo() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        long bb = book(b, "9788937460111", "싯다르타", "READING");
        long other = book(a, "9788937460222", "남의 책", "DONE");
        Room r = roomWith(m("kind", "OWN"), a, Map.of());
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        say(a, r, "각자 읽어요", null);
        end(a, r);
        mvc.perform(POST(a, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BOOK_REQUIRED"));   // 책을 안 골랐다
        mvc.perform(POST(b, "/rooms/" + r.id() + "/import", m("bookId", other))).andExpect(status().isNotFound());                                           // 남의 책
        mvc.perform(POST(b, "/rooms/" + r.id() + "/import", m("bookId", "x"))).andExpect(status().isBadRequest());
        assertThat(dsl.fetchOne("select count(*) as n from book_room_archive").get("n", Integer.class)).isZero();                                           // 실패하면 아무것도 남지 않는다
        assertThat(dsl.fetchOne("select count(*) as n from book where user_id = ?", a).get("n", Integer.class)).isEqualTo(1);
        mvc.perform(POST(b, "/rooms/" + r.id() + "/import", m("bookId", bb))).andExpect(status().isCreated()).andExpect(jsonPath("$.bookId").value(bb))
                .andExpect(jsonPath("$.kind").value("OWN"));                                                                                                  // 각자 읽기는 아무 내 책
        // 같은 책 방은 방의 책과 같은 책만
        Room same = roomWith(m("kind", "SAME", "isbn", ISBN), a, Map.of());
        say(a, same, "같은 책", null);
        end(a, same);
        mvc.perform(POST(a, "/rooms/" + same.id() + "/import", m("bookId", other))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BOOK_MISMATCH"));
    }

    @Test
    void importRules() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol");
        long ba = book(a, ISBN, "데미안", "READING");
        Room r = roomWith(m("kind", "SAME", "isbn", ISBN, "bookId", ba), a, Map.of());
        mvc.perform(POST(a, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("ROOM_NOT_CLOSED"));   // 아직 열려 있다
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());                         // 동의 전
        say(a, r, "대화", null);
        clock.set("2026-11-17T07:00:00Z");                                                                                 // 시간이 다 돼 끝남 (닫기 호출 없이)
        mvc.perform(POST(b, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("AGREE_REQUIRED"));
        mvc.perform(POST(c, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("NOT_PARTICIPANT"));
        mvc.perform(POST(a, "/rooms/9999/import", Map.of())).andExpect(status().isNotFound());
        mvc.perform(post("/rooms/" + r.id() + "/import")).andExpect(status().isUnauthorized());
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isForbidden());                  // 나간 사람
        clock.set("2026-11-24T05:59:59Z");                                                                                 // 마감(종료 06:00 + 7일) 직전까지
        mvc.perform(POST(a, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isCreated());
        // 대화가 없는 방, 마감이 지난 방
        Room empty = roomWith(m("kind", "OWN", "hours", 1, "bookId", ba), a, Map.of());
        clock.advance(Duration.ofHours(2));
        mvc.perform(POST(a, "/rooms/" + empty.id() + "/import", m("bookId", ba))).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("NOTHING_TO_IMPORT"));
        Room late = roomWith(m("kind", "OWN", "hours", 1), a, Map.of());
        say(a, late, "마지막", null);
        clock.advance(Duration.ofDays(8));
        mvc.perform(POST(a, "/rooms/" + late.id() + "/import", m("bookId", ba))).andExpect(status().isNotFound());          // 보관 7일이 지났다
    }

    @Test
    void laterBookMovesToTheSofaKeepingItsRoomRecords() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        long ba = book(a, ISBN, "데미안", "READING");
        Room r = roomWith(m("kind", "SAME", "isbn", ISBN, "bookId", ba), a, Map.of());
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        say(a, r, "읽어 보세요", 10);
        end(a, r);
        long later = body(mvc.perform(POST(b, "/rooms/" + r.id() + "/import", Map.of())).andExpect(status().isCreated()).andReturn()).get("bookId").asLong();
        mvc.perform(POST(b, "/books", m("title", "데미안", "isbn", ISBN, "totalPages", 250))).andExpect(status().isCreated())   // 소파에 올리면
                .andExpect(jsonPath("$.id").value(later)).andExpect(jsonPath("$.status").value("READING")).andExpect(jsonPath("$.totalPages").value(250))
                .andExpect(jsonPath("$.startedAt").value("2026-11-17T03:00:03Z"));
        assertThat(dsl.fetchOne("select count(*) as n from book where user_id = ?", b).get("n", Integer.class)).isEqualTo(1);   // 새 책이 아니라 같은 책
        mvc.perform(GET(b, "/books?status=LATER")).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(GET(b, "/books/" + later + "/rooms")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].messages[0].content").value("읽어 보세요"));   // 공유방 기록이 따라온다
        mvc.perform(POST(b, "/books/" + later + "/finish", m("rating", 5))).andExpect(status().isOk());                       // 다 읽으면 완독 책이 되고 기록도 그대로
        mvc.perform(GET(b, "/books/" + later + "/rooms")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].bookStatus").value("DONE"));
        // 소파에 이미 읽는 책이 있으면 나중에 읽을 책을 올릴 수 없다
        long b2 = book(b, "9788937460999", "다른 책", "READING");
        long later2 = book(b, "9788937460333", "나중에", "LATER");
        mvc.perform(POST(b, "/books", m("title", "나중에", "isbn", "9788937460333"))).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("ALREADY_READING"));
        assertThat(dsl.fetchOne("select status from book where id = ?", later2).get("status", String.class)).isEqualTo("LATER");
        assertThat(b2).isPositive();
    }

    @Test
    void bookTabIsPrivateAndEmptyWhenNothingWasImported() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        long ba = book(a, ISBN, "데미안", "READING");
        mvc.perform(GET(a, "/books/" + ba + "/rooms")).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(GET(b, "/books/" + ba + "/rooms")).andExpect(status().isNotFound());                                    // 남의 책
        mvc.perform(GET(a, "/books/9999/rooms")).andExpect(status().isNotFound());
        mvc.perform(get("/books/" + ba + "/rooms")).andExpect(status().isUnauthorized());
    }

    // ---- 같은 규칙을 DB도 지킨다 ----

    void insert(long uid, long bookId, long roomId, String title, String snapshot) {
        dsl.execute("insert into book_room_archive(user_id, book_id, room_id, room_title, opened_at, closed_at, snapshot, imported_at) "
                + "values (?, ?, ?, ?, now(), now(), ?::jsonb, now())", uid, bookId, roomId, title, snapshot);
    }

    @Test
    void databaseEnforcesUniquenessSnapshotShapeAndSurvivesRoomDeletion() throws Exception {
        long a = newUser("alice");
        long b1 = book(a, ISBN, "하나", "DONE"), b2 = book(a, "9788937460111", "둘", "DONE");
        insert(a, b1, 77, "방", "{\"messages\":[]}");
        assertThrows(Exception.class, () -> insert(a, b1, 77, "방", "{}"));                                                // (책, 방) 중복
        assertThrows(Exception.class, () -> insert(a, b2, 77, "방", "{}"));                                                // 한 사람이 같은 방을 두 번
        assertThrows(Exception.class, () -> insert(a, b2, 78, "   ", "{}"));                                               // 방 이름 비움
        assertThrows(Exception.class, () -> insert(a, b2, 78, "방", "[]"));                                                // 스냅샷은 객체
        assertThrows(Exception.class, () -> insert(a, b2, 78, "방", "\"문자열\""));
        assertThrows(Exception.class, () -> insert(a, 9999, 78, "방", "{}"));                                              // 없는 책
        assertThrows(Exception.class, () -> insert(9999, b2, 78, "방", "{}"));
        insert(a, b2, 78, "방", "{}");                                                                                      // 방이 없어도(7일 뒤 삭제) 기록은 남는다 — room_id에는 외래키가 없다
        dsl.execute("delete from book where id = ?", b1);                                                                   // 책이 지워지면 기록도 함께
        assertThat(dsl.fetchOne("select count(*) as n from book_room_archive").get("n", Integer.class)).isEqualTo(1);
    }
}
