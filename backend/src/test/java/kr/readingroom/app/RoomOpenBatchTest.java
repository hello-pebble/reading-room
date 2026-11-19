package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.room.RoomOpenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** 공유방 개방·종료 배치 (기준 시각 2026-11-17T03:00:00Z). 방은 08:00Z에 열려 몇 시간 뒤 닫힌다. */
class RoomOpenBatchTest extends ApiTestBase {
    @Autowired RoomOpenService openings;

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

    /** 08:00Z에 열리고 3시간짜리인 예정 방. guests는 참여만 한다(알림은 따로 켠다). */
    Room scheduled(long owner, long... guests) throws Exception {
        Room r = open(owner, m("kind", "OWN", "openAt", "2026-11-17T08:00:00Z", "hours", 3));
        for (long g : guests) mvc.perform(POST(g, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        return r;
    }

    void alarm(long uid, Room r) throws Exception {
        mvc.perform(PUT(uid, "/rooms/" + r.id() + "/alarm", Map.of())).andExpect(status().is2xxSuccessful());
    }

    String roomStatus(Room r) {
        return dsl.fetchOne("select status from shared_room where id = ?", r.id()).get(0, String.class);
    }

    Object notifiedAt(Room r) {
        return dsl.fetchOne("select open_notified_at from shared_room where id = ?", r.id()).get(0);
    }

    @Test
    void claimsOnceAtOpenTimeForAlarmUsersAndTheOwner() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol"), d = newUser("daisy");
        Room r = scheduled(a, b, c, d);
        alarm(b, r);
        alarm(c, r);
        alarm(a, r);                                                  // 개설자가 알림도 켠 경우: 한 번만 나와야 한다
        clock.set("2026-11-17T07:59:59Z");
        assertThat(openings.dispatchDue()).isEmpty();                 // 열리기 전에는 아무것도 안 바뀐다
        assertThat(roomStatus(r)).isEqualTo("SCHEDULED");
        assertThat(notifiedAt(r)).isNull();

        clock.set("2026-11-17T08:00:00Z");
        List<RoomOpenService.OpenTarget> sent = openings.dispatchDue();
        assertThat(sent).extracting(RoomOpenService.OpenTarget::userId).containsExactlyInAnyOrder(a, b, c);   // d는 알림을 안 켰다
        assertThat(sent).allSatisfy(t -> assertThat(t.roomId()).isEqualTo(r.id()));
        assertThat(roomStatus(r)).isEqualTo("OPEN");
        assertThat(notifiedAt(r)).isNotNull();

        assertThat(openings.dispatchDue()).isEmpty();                 // 다시 돌려도 두 번 보내지 않는다
    }

    @Test
    void ownerGetsItEvenWithoutAnAlarmRowAndLeftUsersDoNot() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        Room r = scheduled(a, b);
        alarm(b, r);
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());   // 나가면 알림도 꺼진다
        clock.set("2026-11-17T08:00:00Z");
        assertThat(openings.dispatchDue()).extracting(RoomOpenService.OpenTarget::userId).containsExactly(a);
    }

    @Test
    void roomsOpenedImmediatelyAreNeverAnnounced() throws Exception {
        long a = newUser("alice");
        Room r = open(a, m("kind", "OWN"));                           // openAt 생략 = 지금 열림
        assertThat(roomStatus(r)).isEqualTo("OPEN");
        assertThat(notifiedAt(r)).isNotNull();                        // 개설 때 이미 표시한다
        clock.set("2026-11-17T03:05:00Z");
        assertThat(openings.dispatchDue()).isEmpty();
    }

    @Test
    void staleRoomsAfterAnOutageAreMarkedButNotAnnounced() throws Exception {
        long a = newUser("alice"), b = newUser("bobby");
        Room r = scheduled(a, b);
        alarm(b, r);
        clock.set("2026-11-17T08:29:59Z");                            // 서버가 막 켜졌다: 30분 안(정확히 30분은 이미 지난 것)이면 아직 보낸다
        assertThat(openings.dispatchDue()).hasSize(2);

        Room old = open(a, m("kind", "OWN", "openAt", "2026-11-17T08:40:00Z", "hours", 5));
        mvc.perform(POST(b, "/rooms/join", m("code", old.code()))).andExpect(status().isCreated());
        alarm(b, old);
        clock.set("2026-11-17T09:11:00Z");                            // 열린 지 31분
        assertThat(openings.dispatchDue()).isEmpty();
        assertThat(roomStatus(old)).isEqualTo("OPEN");                    // 푸시는 없어도 상태는 맞춘다
        assertThat(notifiedAt(old)).isNotNull();                      // 표시해 두어 매분 다시 검사하지 않는다
        assertThat(openings.dispatchDue()).isEmpty();
    }

    @Test
    void roomsAlreadyEndedByTheOwnerAreMarkedButNotAnnounced() throws Exception {
        long a = newUser("alice");
        Room r = scheduled(a);
        clock.set("2026-11-17T08:00:00Z");
        mvc.perform(POST(a, "/rooms/" + r.id() + "/close", Map.of())).andExpect(status().isOk());   // 배치가 오기 전에 개설자가 닫았다
        assertThat(roomStatus(r)).isEqualTo("CLOSED");
        assertThat(openings.dispatchDue()).isEmpty();
        assertThat(roomStatus(r)).isEqualTo("CLOSED");                    // 닫힌 방이 OPEN으로 되돌아가면 안 된다
        assertThat(notifiedAt(r)).isNotNull();
    }

    @Test
    void roomsPastTheirCloseTimeBecomeClosedWithoutTouchingClosedAt() throws Exception {
        long a = newUser("alice");
        Room r = scheduled(a);
        Room skipped = scheduled(a);                                  // 배치가 한 번도 못 돈 채 통째로 지나갈 방
        clock.set("2026-11-17T08:00:00Z");
        openings.dispatchDue();
        assertThat(roomStatus(r)).isEqualTo("OPEN");
        clock.set("2026-11-17T11:00:00Z");                            // 3시간 뒤 = 종료 시각
        openings.dispatchDue();
        assertThat(roomStatus(r)).isEqualTo("CLOSED");
        assertThat(dsl.fetchOne("select closed_at from shared_room where id = ?", r.id()).get(0)).isNull();   // 보관 7일은 close_at 기준
        mvc.perform(GET(a, "/rooms")).andExpect(jsonPath("$[?(@.id==" + r.id() + ")].status").value("CLOSED"));
        assertThat(roomStatus(skipped)).isEqualTo("CLOSED");

        // 배치가 아예 안 돌다가 종료 뒤에 처음 도는 경우: 푸시는 없고 상태만 CLOSED
        Room late = open(a, m("kind", "OWN", "openAt", "2026-11-17T11:30:00Z", "hours", 1));
        clock.set("2026-11-17T20:00:00Z");
        assertThat(openings.dispatchDue()).isEmpty();
        assertThat(roomStatus(late)).isEqualTo("CLOSED");
    }
}
