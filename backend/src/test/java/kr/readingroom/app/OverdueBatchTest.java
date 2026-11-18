package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Map;
import kr.readingroom.app.session.SessionExpirer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class OverdueBatchTest extends ApiTestBase {
    @Autowired SessionExpirer batch;

    long start(String handle) throws Exception {
        long u = newUser(handle);
        mvc.perform(POST(u, "/books", Map.of("title", "책")));
        return body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
    }

    String status(long id) {
        return dsl.fetchOne("select status from reading_session where id = ?", id).get(0, String.class);
    }

    @Test
    void exactlyThreeHoursStaysRunningThreeHoursOneSecondFlips() throws Exception {
        long id = start("alice");
        clock.advance(Duration.ofHours(3));
        assertThat(batch.expireOverdue()).isEmpty();
        assertThat(status(id)).isEqualTo("RUNNING");
        clock.advance(Duration.ofSeconds(1));
        assertThat(batch.expireOverdue()).containsExactly(id);
        assertThat(status(id)).isEqualTo("NEEDS_CONFIRM");
        assertThat(dsl.fetchOne("select needs_confirm_at is not null and needs_confirm_at = ?::timestamptz from reading_session where id = ?",
                "2026-11-17T06:00:01Z", id).get(0, Boolean.class)).isTrue();   // 전환 시각 기록
    }

    @Test
    void leavesFinishedAndAlreadyFlaggedSessionsAlone() throws Exception {
        long running = start("alice");
        long stopped = start("bob");
        clock.advance(Duration.ofMinutes(20));
        mvc.perform(POST(dsl.fetchOne("select user_id from reading_session where id = ?", stopped).get(0, Long.class), "/sessions/" + stopped + "/stop", Map.of()));
        long flagged = start("carol");
        clock.advance(Duration.ofHours(3).plusMinutes(1));
        assertThat(batch.expireOverdue()).containsExactlyInAnyOrder(running, flagged);
        String firstAt = dsl.fetchOne("select needs_confirm_at::text from reading_session where id = ?", flagged).get(0, String.class);
        clock.advance(Duration.ofHours(1));
        // 두 번째 실행: 이미 NEEDS_CONFIRM인 세션은 건드리지 않아 전환 시각이 그대로다 (푸시 중복 방지의 근거)
        assertThat(batch.expireOverdue()).isEmpty();
        assertThat(dsl.fetchOne("select needs_confirm_at::text from reading_session where id = ?", flagged).get(0, String.class)).isEqualTo(firstAt);
        assertThat(status(stopped)).isEqualTo("DONE");
        assertThat(dsl.fetchOne("select needs_confirm_at from reading_session where id = ?", stopped).get(0)).isNull();
    }

    @Test
    void doesNotRecordTimeBeyondLastCheckAndKeepsStartedAt() throws Exception {
        long id = start("alice");
        long u = dsl.fetchOne("select user_id from reading_session where id = ?", id).get(0, Long.class);
        clock.advance(Duration.ofMinutes(70));
        mvc.perform(POST(u, "/sessions/" + id + "/check", Map.of()));
        clock.advance(Duration.ofHours(4));
        batch.expireOverdue();
        var r = dsl.fetchOne("select started_at::text s, last_check_at::text l, ended_at from reading_session where id = ?", id);
        assertThat(r.get("ended_at")).isNull();   // 자동 종료하지 않는다
        mvc.perform(POST(u, "/sessions/" + id + "/confirm", Map.of("until", "LAST_CHECK"))).andReturn();
        assertThat(dsl.fetchOne("select extract(epoch from ended_at - started_at)::int from reading_session where id = ?", id).get(0, Integer.class)).isEqualTo(70 * 60);
    }
}
