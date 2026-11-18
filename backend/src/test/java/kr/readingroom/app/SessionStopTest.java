package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SessionStopTest extends ApiTestBase {
    long u, book;

    long begin(int total, int cur) throws Exception {
        u = newUser("alice");
        book = body(mvc.perform(POST(u, "/books", Map.of("title", "책", "totalPages", total))).andReturn()).get("id").asLong();
        if (cur > 0) mvc.perform(PATCH(u, "/books/" + book, Map.of("currentPage", cur)));
        return body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
    }

    JsonNode bookNow() throws Exception {
        return body(mvc.perform(GET(u, "/books/" + book)).andReturn());
    }

    @Test
    void stopRecordsMinutesPageAndMemo() throws Exception {
        long id = begin(300, 20);
        clock.advance(Duration.ofMinutes(25).plusSeconds(40));
        mvc.perform(POST(u, "/sessions/" + id + "/stop", Map.of("endPage", 75, "memo", "좋았다")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"))
                .andExpect(jsonPath("$.endedAt").value("2026-11-17T03:25:40Z"))
                .andExpect(jsonPath("$.minutes").value(25))
                .andExpect(jsonPath("$.endedBy").value("LAMP"))
                .andExpect(jsonPath("$.endPage").value(75))
                .andExpect(jsonPath("$.startPage").value(20));
        assertThat(bookNow().get("currentPage").asInt()).isEqualTo(75);
        assertThat(body(mvc.perform(GET(u, "/books/" + book + "/notes")).andReturn()).get(0).get("content").asText()).isEqualTo("좋았다");
        mvc.perform(GET(u, "/sessions/current")).andExpect(jsonPath("$.session").value((Object) null));
    }

    @Test
    void stopTwiceIsIdempotent() throws Exception {
        long id = begin(300, 0);
        clock.advance(Duration.ofMinutes(10));
        var first = mvc.perform(POST(u, "/sessions/" + id + "/stop", Map.of("endPage", 50))).andExpect(status().isOk()).andReturn();
        clock.advance(Duration.ofMinutes(10));
        var second = mvc.perform(POST(u, "/sessions/" + id + "/stop", Map.of("endPage", 99))).andExpect(status().isOk()).andReturn();
        assertThat(body(second)).isEqualTo(body(first));
        assertThat(bookNow().get("currentPage").asInt()).isEqualTo(50);   // 두 번째 요청은 아무것도 바꾸지 않는다
        // 멱등키로 다시 보내도 같다
        long carol = newUser("carol");
        long cb = body(mvc.perform(POST(carol, "/books", Map.of("title", "책"))).andReturn()).get("id").asLong();
        long b = body(mvc.perform(POST(carol, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        u = carol;
        clock.advance(Duration.ofMinutes(5));
        var k1 = mvc.perform(POST(u, "/sessions/" + b + "/stop", Map.of()).header("Idempotency-Key", "s1")).andReturn();
        var k2 = mvc.perform(POST(u, "/sessions/" + b + "/stop", Map.of()).header("Idempotency-Key", "s1")).andReturn();
        assertThat(body(k2)).isEqualTo(body(k1));
    }

    @Test
    void underOneMinuteIsDiscarded() throws Exception {
        long id = begin(300, 0);
        clock.advance(Duration.ofSeconds(59));
        mvc.perform(POST(u, "/sessions/" + id + "/stop", Map.of())).andExpect(jsonPath("$.status").value("DISCARDED"));
        long id2 = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofSeconds(60));
        mvc.perform(POST(u, "/sessions/" + id2 + "/stop", Map.of())).andExpect(jsonPath("$.status").value("DONE")).andExpect(jsonPath("$.minutes").value(1));
    }

    @Test
    void endPageNeverLowersAndNeverExceedsTotal() throws Exception {
        long id = begin(200, 120);
        clock.advance(Duration.ofMinutes(5));
        mvc.perform(POST(u, "/sessions/" + id + "/stop", Map.of("endPage", 40))).andExpect(status().isOk());
        assertThat(bookNow().get("currentPage").asInt()).isEqualTo(120);
        long id2 = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofMinutes(5));
        mvc.perform(POST(u, "/sessions/" + id2 + "/stop", Map.of("endPage", 900))).andExpect(status().isOk());
        assertThat(bookNow().get("currentPage").asInt()).isEqualTo(200);
        assertThat(bookNow().get("percent").asInt()).isEqualTo(100);
    }

    @Test
    void stopCanFillTotalPagesOnlyWhenUnknown() throws Exception {
        u = newUser("alice");
        book = body(mvc.perform(POST(u, "/books", Map.of("title", "책"))).andReturn()).get("id").asLong();
        long id = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofMinutes(3));
        mvc.perform(POST(u, "/sessions/" + id + "/stop", Map.of("endPage", 50, "totalPages", 100))).andExpect(status().isOk());
        assertThat(bookNow().get("totalPages").asInt()).isEqualTo(100);
        assertThat(bookNow().get("percent").asInt()).isEqualTo(50);
    }

    @Test
    void checkUpdatesLastCheckOnlyWhileRunning() throws Exception {
        long id = begin(300, 0);
        clock.advance(Duration.ofMinutes(61));
        mvc.perform(POST(u, "/sessions/" + id + "/check", Map.of()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.lastCheckAt").value("2026-11-17T04:01:00Z"))
                .andExpect(jsonPath("$.startedAt").value("2026-11-17T03:00:00Z"));
        mvc.perform(POST(u, "/sessions/" + id + "/stop", Map.of()));
        mvc.perform(POST(u, "/sessions/" + id + "/check", Map.of())).andExpect(status().isConflict());
        mvc.perform(POST(newUser("bob"), "/sessions/" + id + "/check", Map.of())).andExpect(status().isNotFound());
    }

    /** 3시간을 넘긴 세션: 확인 전에는 마지막 확인 시각까지만 기록된다. */
    @Test
    void confirmLastCheckRecordsUntilLastContinue() throws Exception {
        long id = begin(300, 0);
        clock.advance(Duration.ofMinutes(70));
        mvc.perform(POST(u, "/sessions/" + id + "/check", Map.of()));
        clock.advance(Duration.ofHours(3));
        mvc.perform(GET(u, "/sessions/current")).andExpect(jsonPath("$.session.status").value("NEEDS_CONFIRM"));
        mvc.perform(POST(u, "/sessions/" + id + "/confirm", Map.of("until", "LAST_CHECK", "endPage", 60)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DONE"))
                .andExpect(jsonPath("$.endedAt").value("2026-11-17T04:10:00Z")).andExpect(jsonPath("$.minutes").value(70))
                .andExpect(jsonPath("$.endedBy").value("CONFIRM"));
        assertThat(bookNow().get("currentPage").asInt()).isEqualTo(60);
        mvc.perform(POST(u, "/sessions/" + id + "/confirm", Map.of("until", "LAST_CHECK"))).andExpect(status().isConflict());
    }

    @Test
    void confirmLastCheckWithoutContinueRecordsOneHour() throws Exception {
        long id = begin(300, 0);
        clock.advance(Duration.ofHours(4));
        mvc.perform(POST(u, "/sessions/" + id + "/confirm", Map.of("until", "LAST_CHECK")))
                .andExpect(jsonPath("$.status").value("DONE")).andExpect(jsonPath("$.minutes").value(60));
    }

    @Test
    void confirmMinutesAndDiscard() throws Exception {
        long id = begin(300, 0);
        clock.advance(Duration.ofMinutes(190));
        mvc.perform(POST(u, "/sessions/" + id + "/confirm", Map.of("until", "MINUTES", "minutes", 191))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/sessions/" + id + "/confirm", Map.of("until", "MINUTES", "minutes", 0))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/sessions/" + id + "/confirm", Map.of("until", "NEVER"))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/sessions/" + id + "/confirm", Map.of("until", "MINUTES", "minutes", 150)))
                .andExpect(jsonPath("$.status").value("DONE")).andExpect(jsonPath("$.minutes").value(150));
        long id2 = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofHours(5));
        mvc.perform(POST(u, "/sessions/" + id2 + "/confirm", Map.of("discard", true)))
                .andExpect(jsonPath("$.status").value("DISCARDED")).andExpect(jsonPath("$.endedBy").value("CONFIRM"));
        mvc.perform(GET(u, "/sessions/current")).andExpect(jsonPath("$.session").value((Object) null));
    }

    @Test
    void confirmOnFreshSessionIs409() throws Exception {
        long id = begin(300, 0);
        clock.advance(Duration.ofMinutes(30));
        mvc.perform(POST(u, "/sessions/" + id + "/confirm", Map.of("until", "LAST_CHECK"))).andExpect(status().isConflict());
    }

    /** 프로토타입에서 막았던 3시간 확인 우회: 확인 없이 stop/check로 시간을 늘릴 수 없다. */
    @Test
    void cannotBypassThreeHourConfirmationByStopOrCheck() throws Exception {
        long id = begin(300, 0);
        clock.advance(Duration.ofMinutes(80));
        mvc.perform(POST(u, "/sessions/" + id + "/check", Map.of()));       // 마지막 확인: +80분
        clock.advance(Duration.ofHours(4));                                 // 배치가 아직 안 돌았다 (상태는 아직 RUNNING)
        assertThat(dsl.fetchOne("select status from reading_session where id = ?", id).get(0, String.class)).isEqualTo("RUNNING");
        // check로 3시간 넘은 세션을 되살릴 수 없다
        mvc.perform(POST(u, "/sessions/" + id + "/check", Map.of())).andExpect(status().isConflict());
        assertThat(dsl.fetchOne("select status from reading_session where id = ?", id).get(0, String.class)).isEqualTo("NEEDS_CONFIRM");
        // stop은 마지막 확인(+80분)까지만 기록한다
        mvc.perform(POST(u, "/sessions/" + id + "/stop", Map.of("endPage", 33)))
                .andExpect(jsonPath("$.status").value("DONE")).andExpect(jsonPath("$.minutes").value(80))
                .andExpect(jsonPath("$.endedAt").value("2026-11-17T04:20:00Z"));
        // 이미 NEEDS_CONFIRM이 된 뒤에 stop해도 같다
        long id2 = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofMinutes(100));
        mvc.perform(POST(u, "/sessions/" + id2 + "/check", Map.of()));
        clock.advance(Duration.ofHours(3).plusSeconds(1));
        mvc.perform(GET(u, "/sessions/current")).andExpect(jsonPath("$.session.status").value("NEEDS_CONFIRM"));
        mvc.perform(POST(u, "/sessions/" + id2 + "/stop", Map.of()))
                .andExpect(jsonPath("$.minutes").value(100)).andExpect(jsonPath("$.status").value("DONE"));
        // 한 번도 계속을 누르지 않은 채 3시간을 넘기고 stop하면 기록할 시간이 없어 버려진다
        long id3 = body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
        clock.advance(Duration.ofHours(5));
        mvc.perform(POST(u, "/sessions/" + id3 + "/stop", Map.of())).andExpect(jsonPath("$.status").value("DISCARDED"));
    }

    @Test
    void newSessionCannotStartWhileNeedsConfirm() throws Exception {
        begin(300, 0);
        clock.advance(Duration.ofHours(4));
        mvc.perform(POST(u, "/sessions/start", Map.of())).andExpect(status().isConflict())
                .andExpect(jsonPath("$.session.status").value("NEEDS_CONFIRM"));
    }
}
