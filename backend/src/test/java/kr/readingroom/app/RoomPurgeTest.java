package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import kr.readingroom.app.room.RoomPurgeService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** 종료 7일이 지난 공유방 삭제 배치 (기준 시각 2026-11-17T03:00:00Z) */
class RoomPurgeTest extends ApiTestBase {
    @Autowired RoomPurgeService purge;

    Map<String, Object> m(Object... kv) {
        Map<String, Object> b = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) b.put((String) kv[i], kv[i + 1]);
        return b;
    }

    /** 지금 열리는 방. 개설자가 보관 동의를 하고 글을 한 줄 남긴다. */
    long roomWithContent(long owner, Object... kv) throws Exception {
        long id = body(mvc.perform(POST(owner, "/rooms", m(kv))).andExpect(status().isCreated()).andReturn()).get("id").asLong();
        mvc.perform(POST(owner, "/rooms/" + id + "/agree", Map.of())).andExpect(status().isOk());
        mvc.perform(POST(owner, "/rooms/" + id + "/messages", m("content", "안녕"))).andExpect(status().isCreated());
        return id;
    }

    int count(String table, long roomId) {
        return dsl.fetchOne("select count(*) as n from " + table + " where room_id = ?", roomId).get("n", Integer.class);
    }

    int rooms() {
        return dsl.fetchCount(dsl.selectFrom("shared_room"));
    }

    @Test
    void roomsAreDeletedSevenDaysAfterTheyEndWithTheirMessagesAndParticipants() throws Exception {
        long a = newUser("alice");
        long id = roomWithContent(a, "kind", "OWN", "hours", 1);            // 03:00Z에 열려 04:00Z에 끝난다
        assertThat(purge.purgeExpired()).isZero();                          // 열려 있는 방은 그대로

        clock.set("2026-11-24T03:59:59Z");                                  // 끝난 지 6일 23시간 59분 59초
        assertThat(purge.purgeExpired()).isZero();
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$[0].status").value("CLOSED"));   // 아직 지난 방으로 보인다
        assertThat(rooms()).isEqualTo(1);

        clock.set("2026-11-24T04:00:00Z");                                  // 정확히 7일 (게시판에서 사라지는 시각과 같다)
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$.length()").value(0));
        assertThat(purge.purgeExpired()).isEqualTo(1);
        assertThat(rooms()).isZero();
        assertThat(count("room_message", id)).isZero();                     // 글·참여자는 방과 함께 지워진다
        assertThat(count("room_participant", id)).isZero();
        assertThat(purge.purgeExpired()).isZero();                          // 다시 돌려도 더 지울 것이 없다
    }

    @Test
    void anEarlyEndedRoomIsCountedFromTheMomentItWasEnded() throws Exception {
        long a = newUser("alice");
        long id = roomWithContent(a, "kind", "OWN", "hours", 5);            // 원래는 08:00Z에 끝날 방
        clock.advance(Duration.ofMinutes(30));                              // 03:30Z에 일찍 끝낸다
        mvc.perform(POST(a, "/rooms/" + id + "/close", Map.of())).andExpect(status().isOk());

        clock.set("2026-11-24T03:29:59Z");
        assertThat(purge.purgeExpired()).isZero();
        clock.set("2026-11-24T03:30:00Z");                                  // 일찍 끝낸 날부터 7일 (예정 종료일 기준이 아니다)
        assertThat(purge.purgeExpired()).isEqualTo(1);
        assertThat(rooms()).isZero();
    }

    @Test
    void onlyExpiredRoomsAreDeletedAndRecordsThatMustSurviveStay() throws Exception {
        long a = newUser("alice");
        long old = roomWithContent(a, "kind", "OWN", "hours", 1);
        mvc.perform(POST(a, "/rooms/" + old + "/stay", Map.of())).andExpect(status().isCreated());
        clock.advance(Duration.ofMinutes(30));
        mvc.perform(POST(a, "/rooms/" + old + "/stay/leave", Map.of())).andExpect(status().isOk());   // 머문 시간 30분이 남는다

        clock.set("2026-11-24T05:00:00Z");
        long fresh = roomWithContent(a, "kind", "OWN", "hours", 3);          // 새로 연 방은 남는다
        assertThat(purge.purgeExpired()).isEqualTo(1);
        assertThat(rooms()).isEqualTo(1);
        assertThat(count("room_message", fresh)).isEqualTo(1);
        assertThat(dsl.fetchCount(dsl.selectFrom("room_open_log"))).isEqualTo(2);   // 하루 3번 한도 기록은 방이 지워져도 남는다
        assertThat(count("camp_stay", old)).isEqualTo(1);                   // 머문 시간(읽은 시간)도 남는다
        mvc.perform(GET(a, "/me/reading-time?date=2026-11-17")).andExpect(jsonPath("$.minutes").value(30));
    }
}
