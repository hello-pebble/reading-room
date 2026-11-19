package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 모닥불 머문 시간 (기준 시각 2026-11-17T03:00:00Z = 한국 12:00, 결정 #65) */
class CampStayTest extends ApiTestBase {
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

    /** 지금 열리는 방에 개설자가 보관 동의까지 마친 상태 */
    Room openAndAgree(long owner, Object... kv) throws Exception {
        Room r = open(owner, m(kv));
        mvc.perform(POST(owner, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        return r;
    }

    void enter(long uid, Room r) throws Exception {
        mvc.perform(POST(uid, "/rooms/" + r.id() + "/stay", Map.of())).andExpect(status().isCreated());
    }

    com.fasterxml.jackson.databind.JsonNode leave(long uid, Room r) throws Exception {
        return body(mvc.perform(POST(uid, "/rooms/" + r.id() + "/stay/leave", Map.of())).andExpect(status().isOk()).andReturn());
    }

    long minutesOn(long uid, String date) throws Exception {
        return body(mvc.perform(GET(uid, "/me/reading-time" + (date == null ? "" : "?date=" + date))).andExpect(status().isOk()).andReturn()).get("minutes").asLong();
    }

    int stays() {
        return dsl.fetchCount(dsl.selectFrom("camp_stay"));
    }

    @Test
    void enteringNeedsAParticipantWhoAgreedAndAnOpenRoom() throws Exception {
        long a = newUser("alice"), b = newUser("bobby"), c = newUser("carol");
        Room r = open(a, m("kind", "OWN"));
        mvc.perform(post("/rooms/" + r.id() + "/stay")).andExpect(status().isUnauthorized());
        mvc.perform(POST(a, "/rooms/9999/stay", Map.of())).andExpect(status().isNotFound());
        mvc.perform(POST(a, "/rooms/" + r.id() + "/stay", Map.of())).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("AGREE_REQUIRED"));
        mvc.perform(POST(c, "/rooms/" + r.id() + "/stay", Map.of())).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("NOT_PARTICIPANT"));
        mvc.perform(POST(b, "/rooms/join", m("code", r.code()))).andExpect(status().isCreated());
        mvc.perform(POST(a, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        mvc.perform(POST(a, "/rooms/" + r.id() + "/stay", Map.of())).andExpect(status().isCreated()).andExpect(jsonPath("$.roomId").value(r.id()))
                .andExpect(jsonPath("$.enteredAt").value("2026-11-17T03:00:00Z"));
        mvc.perform(DELETE(b, "/rooms/" + r.id() + "/participants/me")).andExpect(status().isNoContent());
        mvc.perform(POST(b, "/rooms/" + r.id() + "/stay", Map.of())).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("NOT_PARTICIPANT"));

        // 아직 열리지 않은 방은 409, 끝난 방은 410
        Room later = open(a, m("kind", "OWN", "openAt", "2026-11-17T08:00:00Z", "hours", 1));
        mvc.perform(POST(a, "/rooms/" + later.id() + "/agree", Map.of())).andExpect(status().isOk());
        mvc.perform(POST(a, "/rooms/" + later.id() + "/stay", Map.of())).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("ROOM_NOT_OPEN"));
        clock.set("2026-11-17T09:00:00Z");
        mvc.perform(POST(a, "/rooms/" + later.id() + "/stay", Map.of())).andExpect(status().isGone()).andExpect(jsonPath("$.error").value("ROOM_CLOSED"));
    }

    @Test
    void leavingCreditsWholeMinutesAndDropsStaysUnderOneMinute() throws Exception {
        long a = newUser("alice");
        Room r = openAndAgree(a, "kind", "OWN");
        mvc.perform(POST(a, "/rooms/" + r.id() + "/stay/leave", Map.of())).andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NO_OPEN_STAY"));

        enter(a, r);
        clock.advance(Duration.ofSeconds(59));
        var shortStay = leave(a, r);
        assertThat(shortStay.get("credited").asBoolean()).isFalse();
        assertThat(shortStay.get("minutes").asLong()).isZero();
        assertThat(stays()).isZero();                                    // 1분 미만은 저장하지 않는다

        enter(a, r);
        clock.advance(Duration.ofSeconds(125));
        var done = leave(a, r);
        assertThat(done.get("credited").asBoolean()).isTrue();
        assertThat(done.get("minutes").asLong()).isEqualTo(2);           // 초는 내린다
        assertThat(done.get("enteredAt").asText()).isEqualTo("2026-11-17T03:00:59Z");
        assertThat(done.get("leftAt").asText()).isEqualTo("2026-11-17T03:03:04Z");
        assertThat(stays()).isEqualTo(1);
        mvc.perform(POST(a, "/rooms/" + r.id() + "/stay/leave", Map.of())).andExpect(status().isNotFound());   // 이미 닫았다
        assertThat(minutesOn(a, null)).isEqualTo(2);
    }

    @Test
    void enteringAgainDropsThePreviousOpenStayWithoutCredit() throws Exception {
        long a = newUser("alice");
        Room r1 = openAndAgree(a, "kind", "OWN");
        Room r2 = openAndAgree(a, "kind", "OWN");
        enter(a, r1);
        clock.advance(Duration.ofMinutes(10));
        enter(a, r1);                                                    // 새로고침: 앞의 10분은 인정하지 않는다
        assertThat(stays()).isEqualTo(1);
        clock.advance(Duration.ofMinutes(5));
        enter(a, r2);                                                    // 다른 방으로 이동해도 앞의 방 5분은 인정하지 않는다
        assertThat(stays()).isEqualTo(1);
        mvc.perform(POST(a, "/rooms/" + r1.id() + "/stay/leave", Map.of())).andExpect(status().isNotFound());
        clock.advance(Duration.ofMinutes(7));
        assertThat(leave(a, r2).get("minutes").asLong()).isEqualTo(7);
        assertThat(minutesOn(a, null)).isEqualTo(7);
    }

    @Test
    void theStayIsCutAtTheRoomsEndTime() throws Exception {
        long a = newUser("alice");
        Room r = openAndAgree(a, "kind", "OWN", "hours", 1);             // 03:00Z에 열려 04:00Z에 끝난다
        clock.advance(Duration.ofMinutes(10));
        enter(a, r);
        clock.advance(Duration.ofHours(3));                              // 퇴장을 한참 늦게 불러도
        var out = leave(a, r);
        assertThat(out.get("leftAt").asText()).isEqualTo("2026-11-17T04:00:00Z");
        assertThat(out.get("minutes").asLong()).isEqualTo(50);
        assertThat(minutesOn(a, null)).isEqualTo(50);
    }

    @Test
    void anEarlyClosedRoomCutsTheStayAtTheClosedTime() throws Exception {
        long a = newUser("alice");
        Room r = openAndAgree(a, "kind", "OWN", "hours", 3);
        enter(a, r);
        clock.advance(Duration.ofMinutes(20));
        mvc.perform(POST(a, "/rooms/" + r.id() + "/close", Map.of())).andExpect(status().isOk());
        clock.advance(Duration.ofMinutes(30));
        assertThat(leave(a, r).get("minutes").asLong()).isEqualTo(20);   // 일찍 끝낸 시각까지만
    }

    @Test
    void overlapWithTheLampIsCountedOnce() throws Exception {
        long a = newUser("alice");
        mvc.perform(POST(a, "/books", Map.of("title", "데미안")));
        Room r = openAndAgree(a, "kind", "OWN", "hours", 3);
        long sid = body(mvc.perform(POST(a, "/sessions/start", Map.of())).andReturn()).get("id").asLong();   // 스탠드 03:00
        clock.advance(Duration.ofMinutes(10));
        enter(a, r);                                                     // 모닥불 03:10 ~ 03:40 (30분)
        clock.advance(Duration.ofMinutes(30));
        leave(a, r);
        clock.advance(Duration.ofMinutes(20));
        mvc.perform(POST(a, "/sessions/" + sid + "/stop", Map.of())).andExpect(status().isOk());              // 스탠드 03:00 ~ 04:00 (60분)
        assertThat(minutesOn(a, null)).isEqualTo(60);                    // 90분이 아니다

        // 스탠드 밖의 구간은 더해진다: 04:30 ~ 04:50
        clock.advance(Duration.ofMinutes(30));
        enter(a, r);
        clock.advance(Duration.ofMinutes(20));
        leave(a, r);
        assertThat(minutesOn(a, null)).isEqualTo(80);
    }

    @Test
    void aStayAcrossMidnightIsSplitByKoreanDay() throws Exception {
        long a = newUser("alice");
        Room r = open(a, m("kind", "OWN", "openAt", "2026-11-17T14:00:00Z", "hours", 3));
        mvc.perform(POST(a, "/rooms/" + r.id() + "/agree", Map.of())).andExpect(status().isOk());
        clock.set("2026-11-17T14:30:00Z");                               // 한국 23:30
        enter(a, r);
        clock.set("2026-11-17T15:30:00Z");                               // 한국 다음 날 00:30
        assertThat(leave(a, r).get("minutes").asLong()).isEqualTo(60);
        assertThat(minutesOn(a, "2026-11-17")).isEqualTo(30);
        assertThat(minutesOn(a, "2026-11-18")).isEqualTo(30);
        assertThat(minutesOn(a, "2026-11-16")).isZero();
    }

    @Test
    void aSavedStayMakesTheDayAReadingDay() throws Exception {
        long a = newUser("alice");
        Room r = openAndAgree(a, "kind", "OWN");
        mvc.perform(GET(a, "/me/calendar")).andExpect(jsonPath("$.days.length()").value(0)).andExpect(jsonPath("$.streak").value(0));
        enter(a, r);
        clock.advance(Duration.ofSeconds(30));
        leave(a, r);                                                     // 1분 미만: 독서한 날이 아니다
        mvc.perform(GET(a, "/me/calendar")).andExpect(jsonPath("$.days.length()").value(0));
        enter(a, r);
        clock.advance(Duration.ofMinutes(5));
        leave(a, r);
        mvc.perform(GET(a, "/me/calendar")).andExpect(jsonPath("$.days[0]").value("2026-11-17")).andExpect(jsonPath("$.streak").value(1));
    }

    @Test
    void readingTimeChecksItsInput() throws Exception {
        long a = newUser("alice");
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/me/reading-time")).andExpect(status().isUnauthorized());
        assertThat(minutesOn(a, null)).isZero();
        mvc.perform(GET(a, "/me/reading-time?date=2026-11-17")).andExpect(jsonPath("$.date").value("2026-11-17")).andExpect(jsonPath("$.serverNow").value("2026-11-17T03:00:00Z"));
        mvc.perform(GET(a, "/me/reading-time?date=11-17")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("BAD_DATE"));
        mvc.perform(GET(a, "/me/reading-time?date=2026-11-18")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("FUTURE"));
    }
}
