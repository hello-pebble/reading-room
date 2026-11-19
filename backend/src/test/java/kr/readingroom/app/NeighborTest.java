package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;

/** 이웃집 책 추천: 읽는 중·완독 책만, 집마다 확인 전 한 권, 집 주인만 확인 (기준 시각 2026-11-17T03:00:00Z) */
class NeighborTest extends ApiTestBase {
    long book(long uid, String title, String status) {
        return dsl.fetchOne("insert into book(user_id, isbn, title, author, cover_url, total_pages, current_page, status, rating, one_line_review) "
                + "values (?, '9788937460449', ?, '헤세', 'https://img/c.jpg', 200, 50, ?, 5, '인생 책') returning id", uid, title, status).get("id", Long.class);
    }

    /** 닉네임으로 그 사람의 공개 번호(UUID)를 찾는다. 없는 이름은 존재하지 않는 번호를 돌려준다. (이웃집 주소는 닉네임이 아니라 공개 번호, 결정 #69) */
    String pid(String nickname) {
        var r = dsl.fetchOne("select public_id::text as p from app_user where nickname = ? limit 1", nickname);
        return r == null ? "00000000-0000-4000-8000-000000000000" : r.get("p", String.class);
    }

    String house(String nickname) { return "/neighbors/" + pid(nickname) + "/recommendation"; }

    @Test
    void recommendCopiesOnlyBookInfoAndShowsTheSenderNickname() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        long bk = book(a, "데미안", "DONE");
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", bk))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.book.title").value("데미안")).andExpect(jsonPath("$.book.author").value("헤세"))
                .andExpect(jsonPath("$.book.isbn").value("9788937460449")).andExpect(jsonPath("$.book.coverUrl").value("https://img/c.jpg"))
                .andExpect(jsonPath("$.createdAt").value("2026-11-17T03:00:00Z"))
                .andExpect(jsonPath("$.book.rating").doesNotExist()).andExpect(jsonPath("$.book.currentPage").doesNotExist())
                .andExpect(jsonPath("$.book.oneLineReview").doesNotExist()).andExpect(jsonPath("$.fromNickname").value("alice"));
        mvc.perform(GET(b, "/me/recommendation")).andExpect(status().isOk()).andExpect(jsonPath("$.book.title").value("데미안"))
                .andExpect(jsonPath("$.fromNickname").value("alice"))                     // 보낸 사람은 닉네임으로 밝힌다
                .andExpect(jsonPath("$.from").doesNotExist()).andExpect(jsonPath("$.fromUser").doesNotExist()).andExpect(jsonPath("$.fromHandle").doesNotExist());   // 핸들·id는 내려주지 않는다
        // 원본 책은 그대로
        var r = dsl.fetchOne("select status, current_page, rating from book where id = ?", bk);
        assertThat(r.get("status", String.class)).isEqualTo("DONE");
        assertThat(r.get("current_page", Integer.class)).isEqualTo(50);
        assertThat(dsl.fetchOne("select count(*) as n from book").get("n", Integer.class)).isEqualTo(1);       // 받는 사람 책장에 책이 생기지 않는다
    }

    @Test
    void onlyReadingOrFinishedBooksAndOnlyMyOwn() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        long reading = book(a, "읽는 중", "READING"), done = book(a, "완독", "DONE"), dropped = book(a, "포기", "DROPPED"), later = book(a, "나중에", "LATER");
        long bobs = book(b, "밥의 책", "DONE");
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", dropped))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BOOK_NOT_ELIGIBLE"));
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", later))).andExpect(status().isBadRequest());
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", bobs))).andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("BOOK_NOT_FOUND"));   // 남의 책
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", 9999))).andExpect(status().isNotFound());
        mvc.perform(GET(b, "/me/recommendation")).andExpect(status().isNoContent());                              // 실패한 시도는 아무것도 꽂지 않는다
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", reading))).andExpect(status().isCreated());          // 읽는 중
        mvc.perform(POST(b, house("alice"), Map.of("bookId", bobs))).andExpect(status().isCreated());             // 완독
        assertThat(done).isPositive();
    }

    @Test
    void eligibilityIsCheckedAgainAtTheMomentOfPutting() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        long bk = book(a, "데미안", "READING");
        dsl.execute("update book set status = 'DROPPED' where id = ?", bk);                                       // 그사이 포기했다
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", bk))).andExpect(status().isBadRequest());
        assertThat(dsl.fetchOne("select count(*) as n from neighbor_recommendation").get("n", Integer.class)).isZero();
    }

    @Test
    void oneUnconfirmedBookPerHouseAndOtherHousesAreSeparate() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol"), d = newUser("dave");
        long ba = book(a, "앨리스 책", "DONE"), bc = book(c, "캐롤 책", "DONE");
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", ba))).andExpect(status().isCreated());
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", ba))).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("HOUSE_OCCUPIED"));   // 같은 사람도
        mvc.perform(POST(c, house("bobby"), Map.of("bookId", bc))).andExpect(status().isConflict());              // 다른 사람이 덮어쓰지 못한다
        mvc.perform(GET(b, "/me/recommendation")).andExpect(jsonPath("$.book.title").value("앨리스 책"));
        mvc.perform(POST(a, house("carol"), Map.of("bookId", ba))).andExpect(status().isCreated());               // 다른 집은 따로
        mvc.perform(POST(a, house("dave"), Map.of("bookId", ba))).andExpect(status().isCreated());                // 같은 책을 여러 집에도 가능
        assertThat(d).isPositive();
    }

    @Test
    void ownerConfirmEmptiesTheHouseSoItCanBeRecommendedAgain() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol");
        long ba = book(a, "앨리스 책", "DONE"), bc = book(c, "캐롤 책", "DONE");
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", ba))).andExpect(status().isCreated());
        mvc.perform(POST(a, "/me/recommendation/confirm", Map.of())).andExpect(status().isNotFound());           // 방문자는 확인할 수 없다 (자기 집에 도착한 게 없음)
        mvc.perform(GET(b, "/me/recommendation")).andExpect(status().isOk());                                    // 추천은 그대로
        clock.advance(java.time.Duration.ofHours(1));
        mvc.perform(POST(b, "/me/recommendation/confirm", Map.of())).andExpect(status().isNoContent());
        mvc.perform(GET(b, "/me/recommendation")).andExpect(status().isNoContent());
        mvc.perform(POST(b, "/me/recommendation/confirm", Map.of())).andExpect(status().isNotFound());           // 이미 확인함
        assertThat(dsl.fetchOne("select count(*) as n from book where user_id = ?", b).get("n", Integer.class)).isZero();   // 확인만으로 책이 담기지 않는다
        mvc.perform(POST(c, house("bobby"), Map.of("bookId", bc))).andExpect(status().isCreated());               // 칸이 비어 다시 추천
        mvc.perform(GET(b, "/me/recommendation")).andExpect(jsonPath("$.book.title").value("캐롤 책")).andExpect(jsonPath("$.fromNickname").value("carol"));   // 다시 꽂은 사람의 닉네임
        assertThat(dsl.fetchOne("select count(*) as n from neighbor_recommendation where to_user = ?", b).get("n", Integer.class)).isEqualTo(2);   // 확인한 행은 남는다
        assertThat(dsl.fetchOne("select confirmed_at from neighbor_recommendation where from_user = ?", a).get("confirmed_at")).isNotNull();
    }

    @Test
    void nicknameShownIsTheSendersCurrentOne() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        long bk = book(a, "데미안", "DONE");
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", bk))).andExpect(status().isCreated());
        dsl.execute("update app_user set nickname = '앨리' where id = ?", a);
        mvc.perform(GET(b, "/me/recommendation")).andExpect(jsonPath("$.fromNickname").value("앨리"));
    }

    @Test
    void visitShowsOccupiedButOnlyRevealsMyOwnBook() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol");
        long ba = book(a, "앨리스 책", "DONE");
        mvc.perform(GET(a, "/neighbors/" + pid("bobby"))).andExpect(status().isOk()).andExpect(jsonPath("$.publicId").value(pid("bobby"))).andExpect(jsonPath("$.handle").doesNotExist())
                .andExpect(jsonPath("$.nickname").value("bobby")).andExpect(jsonPath("$.occupied").value(false)).andExpect(jsonPath("$.mine").value(false))
                .andExpect(jsonPath("$.book").doesNotExist());
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", ba))).andExpect(status().isCreated());
        mvc.perform(GET(a, "/neighbors/" + pid("bobby"))).andExpect(jsonPath("$.occupied").value(true)).andExpect(jsonPath("$.mine").value(true))
                .andExpect(jsonPath("$.book.title").value("앨리스 책"));                                            // 내가 꽂은 책은 보인다
        mvc.perform(GET(c, "/neighbors/" + pid("bobby"))).andExpect(jsonPath("$.occupied").value(true)).andExpect(jsonPath("$.mine").value(false))
                .andExpect(jsonPath("$.book").doesNotExist());                                                    // 남이 꽂은 책은 숨긴다
        mvc.perform(GET(a, "/neighbors/" + pid("bobby").toUpperCase())).andExpect(status().isOk());              // 번호는 대소문자를 가리지 않는다
    }

    @Test
    void invalidRequests() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        long bk = book(a, "데미안", "DONE");
        mvc.perform(POST(a, house("nobody"), Map.of("bookId", bk))).andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("HOUSE_NOT_FOUND"));
        mvc.perform(GET(a, "/neighbors/" + pid("nobody"))).andExpect(status().isNotFound());                     // 없는 번호
        for (String malformed : new String[] {"nobody", "bobby", "123", "not-a-uuid", "1-1-1-1-1", "00000000-0000-4000-8000-00000000000g"})
            mvc.perform(GET(a, "/neighbors/" + malformed)).andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("HOUSE_NOT_FOUND"));   // 번호 모양이 아니어도 500이 아니라 404
        mvc.perform(POST(a, house("alice"), Map.of("bookId", bk))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("OWN_HOUSE"));
        mvc.perform(GET(a, "/neighbors/" + pid("alice"))).andExpect(status().isBadRequest());
        for (Object bad : new Object[]{"x", "5", 0, -1, 1.5})
            mvc.perform(POST(a, house("bobby"), Map.of("bookId", bad))).andExpect(status().isBadRequest());
        mvc.perform(POST(a, house("bobby"), Map.of())).andExpect(status().isBadRequest());
        mvc.perform(post(house("bobby")).header("X-User-Id", a).contentType("application/json").content("{")).andExpect(status().isBadRequest());
        mvc.perform(post(house("bobby")).contentType("application/json").content("{\"bookId\":1}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/neighbors/" + pid("bobby"))).andExpect(status().isUnauthorized());
        mvc.perform(get("/me/recommendation")).andExpect(status().isUnauthorized());
        mvc.perform(post("/me/recommendation/confirm")).andExpect(status().isUnauthorized());
        assertThat(b).isPositive();
        assertThat(dsl.fetchOne("select count(*) as n from neighbor_recommendation").get("n", Integer.class)).isZero();
    }

    @Test
    void concurrentRecommendationsToOneHouseLetExactlyOneIn() throws Exception {
        long target = newUser("bobby");
        List<Long> senders = new ArrayList<>(), books = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            long u = newUser("sender" + i);
            senders.add(u);
            books.add(book(u, "책" + i, "DONE"));
        }
        var pool = Executors.newFixedThreadPool(8);
        List<Callable<Integer>> calls = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            long u = senders.get(i), bk = books.get(i);
            calls.add(() -> mvc.perform(POST(u, house("bobby"), Map.of("bookId", bk))).andReturn().getResponse().getStatus());
        }
        int created = 0, occupied = 0;
        for (var f : pool.invokeAll(calls)) {
            int st = f.get();
            if (st == 201) created++; else if (st == 409) occupied++;
        }
        pool.shutdown();
        assertThat(created).isEqualTo(1);
        assertThat(occupied).isEqualTo(7);
        assertThat(dsl.fetchOne("select count(*) as n from neighbor_recommendation where to_user = ? and confirmed_at is null", target).get("n", Integer.class)).isEqualTo(1);
    }

    // ---- 같은 규칙을 DB도 지킨다 ----

    void insert(long to, long from, String title, String at, String confirmed) {
        dsl.execute("insert into neighbor_recommendation(to_user, from_user, title, created_at, confirmed_at) values (?, ?, ?, ?::timestamptz, ?::timestamptz)", to, from, title, at, confirmed);
    }

    @Test
    void databaseEnforcesOneOpenPerHouseNoSelfAndNonBlankTitle() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol");
        String t = "2026-11-17T03:00:00Z";
        insert(b, a, "하나", t, null);
        assertThrows(Exception.class, () -> insert(b, c, "둘", t, null));                                         // 같은 집에 확인 전 두 권
        insert(c, a, "다른 집", t, null);
        insert(b, a, "확인된 옛 추천", t, "2026-11-17T04:00:00Z");                                                 // 확인된 행은 여러 개여도 된다
        insert(b, c, "확인된 또 하나", t, "2026-11-17T04:00:00Z");
        assertThrows(Exception.class, () -> insert(a, a, "내 집에", t, null));                                      // 자기 집
        assertThrows(Exception.class, () -> insert(c, b, "   ", t, null));                                        // 제목 비움
        assertThrows(Exception.class, () -> insert(a, b, "시각 역전", "2026-11-17T04:00:00Z", "2026-11-17T03:00:00Z"));   // 확인이 만든 시각보다 앞
        assertThrows(Exception.class, () -> insert(9999, a, "없는 집", t, null));
        assertThrows(Exception.class, () -> insert(a, 9999, "없는 사람", t, null));
        assertThrows(Exception.class, () -> dsl.execute("insert into neighbor_recommendation(to_user, from_user, title) values (?, ?, 'x')", a, b));   // 시각은 필수
    }

    @Test
    void recommendationSurvivesSenderBookDeletionAndGoesWithUser() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        long bk = book(a, "데미안", "DONE");
        mvc.perform(POST(a, house("bobby"), Map.of("bookId", bk))).andExpect(status().isCreated());
        dsl.execute("delete from book where id = ?", bk);                                                          // 원본을 지워도 복사본은 남는다
        mvc.perform(GET(b, "/me/recommendation")).andExpect(status().isOk()).andExpect(jsonPath("$.book.title").value("데미안"));
        dsl.execute("delete from app_user where id = ?", a);                                                       // 보낸 사람이 없어지면 추천도 함께
        mvc.perform(GET(b, "/me/recommendation")).andExpect(status().isNoContent());
    }
}
