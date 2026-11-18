package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Duration;
import java.util.Map;
import kr.readingroom.app.push.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class PushTest extends ApiTestBase {
    @Autowired NotificationService notifications;

    static Map<String, Object> sub(String endpoint, String p256dh) {
        return Map.of("endpoint", endpoint, "keys", Map.of("p256dh", p256dh, "auth", "auth-secret"));
    }

    long reader(String handle, String endpoint) throws Exception {
        long u = newUser(handle);
        mvc.perform(POST(u, "/me/push-subscription", sub(endpoint, "k1"))).andExpect(status().isOk());
        mvc.perform(POST(u, "/books", Map.of("title", "데미안")));
        return u;
    }

    long start(long u) throws Exception {
        return body(mvc.perform(POST(u, "/sessions/start", Map.of())).andReturn()).get("id").asLong();
    }

    // ---- 구독 ----

    @Test
    void subscriptionIsUpsertedByEndpointAndCanBeDeleted() throws Exception {
        long u = newUser("alice");
        mvc.perform(post("/me/push-subscription").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(POST(u, "/me/push-subscription", Map.of("endpoint", "http://insecure"))).andExpect(status().isBadRequest());
        mvc.perform(POST(u, "/me/push-subscription", Map.of("endpoint", "https://push.example/a"))).andExpect(status().isBadRequest());   // keys 없음
        mvc.perform(POST(u, "/me/push-subscription", sub("https://push.example/a", "old"))).andExpect(status().isOk());
        mvc.perform(POST(u, "/me/push-subscription", sub("https://push.example/a", "new"))).andExpect(status().isOk());   // 같은 endpoint → 덮어쓰기
        assertThat(dsl.fetchCount(dsl.selectFrom("push_subscription"))).isEqualTo(1);
        assertThat(dsl.fetchOne("select p256dh from push_subscription").get(0, String.class)).isEqualTo("new");
        // 평평한 모양도 받는다. 다른 기기는 다른 행
        mvc.perform(POST(u, "/me/push-subscription", Map.of("endpoint", "https://push.example/b", "p256dh", "x", "auth", "y"))).andExpect(status().isOk());
        assertThat(dsl.fetchCount(dsl.selectFrom("push_subscription"))).isEqualTo(2);
        // 다른 사람이 같은 endpoint를 등록하면 그 기기의 주인이 바뀐다 (한 기기에 한 행)
        long bob = newUser("bob");
        mvc.perform(POST(bob, "/me/push-subscription", sub("https://push.example/a", "bobkey"))).andExpect(status().isOk());
        assertThat(dsl.fetchCount(dsl.selectFrom("push_subscription"))).isEqualTo(2);
        assertThat(dsl.fetchOne("select user_id from push_subscription where endpoint = 'https://push.example/a'").get(0, Long.class)).isEqualTo(bob);
        // 해제: 남의 구독은 지워지지 않고, 내 것은 지워진다. 두 번 해도 204
        mvc.perform(as(u, delete("/me/push-subscription")).param("endpoint", "https://push.example/a")).andExpect(status().isNoContent());
        assertThat(dsl.fetchCount(dsl.selectFrom("push_subscription"))).isEqualTo(2);
        mvc.perform(as(u, delete("/me/push-subscription")).param("endpoint", "https://push.example/b")).andExpect(status().isNoContent());
        mvc.perform(as(u, delete("/me/push-subscription")).contentType(MediaType.APPLICATION_JSON).content("{\"endpoint\":\"https://push.example/b\"}")).andExpect(status().isNoContent());
        assertThat(dsl.fetchCount(dsl.selectFrom("push_subscription"))).isEqualTo(1);
        mvc.perform(as(u, delete("/me/push-subscription"))).andExpect(status().isBadRequest());
    }

    // ---- 60분 확인 ----

    @Test
    void sixtyMinuteCheckIsSentOncePerLastCheckValue() throws Exception {
        long u = reader("alice", "https://push.example/a");
        long sid = start(u);
        clock.advance(Duration.ofMinutes(60));
        assertThat(notifications.dispatchDue()).isEmpty();      // 정확히 60분은 아직 (지난 뒤부터)
        clock.advance(Duration.ofSeconds(1));
        var first = notifications.dispatchDue();
        assertThat(first).hasSize(1);
        assertThat(first.get(0).type()).isEqualTo("CHECK");
        assertThat(first.get(0).sessionId()).isEqualTo(sid);
        assertThat(pushes.sent).hasSize(1);
        var m = pushes.sent.get(0).message();
        assertThat(m.title()).isEqualTo("아직 읽고 있어요?");
        assertThat(m.body()).isEqualTo("『데미안』을 읽은 지 60분이 지났어요. 계속 읽고 있나요?");
        assertThat(m.screen()).isEqualTo("LAMP");
        // 다시 돌려도, 시간이 더 지나도 같은 last_check_at이면 다시 안 보낸다
        notifications.dispatchDue();
        clock.advance(Duration.ofMinutes(30));
        notifications.dispatchDue();
        assertThat(pushes.sent).hasSize(1);
        // [계속] → last_check_at이 바뀌면 다시 60분 뒤 한 번
        mvc.perform(POST(u, "/sessions/" + sid + "/check", Map.of()));
        clock.advance(Duration.ofMinutes(59));
        assertThat(notifications.dispatchDue()).isEmpty();
        clock.advance(Duration.ofMinutes(2));
        assertThat(notifications.dispatchDue()).hasSize(1);
        notifications.dispatchDue();
        assertThat(pushes.sent).hasSize(2);
    }

    @Test
    void checkNotSentForStoppedOrOverdueSessions() throws Exception {
        long a = reader("alice", "https://push.example/a");
        long sa = start(a);
        clock.advance(Duration.ofMinutes(61));
        mvc.perform(POST(a, "/sessions/" + sa + "/stop", Map.of()));   // 끈 세션
        long b = reader("bob", "https://push.example/b");
        start(b);
        clock.advance(Duration.ofHours(3).plusSeconds(1));               // bob 은 3시간을 넘겨 곧 확인 필요가 된다 (정확히 3시간은 아직 RUNNING)
        assertThat(notifications.claimCheckTargets()).isEmpty();
        assertThat(pushes.sent).isEmpty();
    }

    // ---- 확인 필요 ----

    @Test
    void confirmNeededIsSentOnceWhenSwitching() throws Exception {
        long u = reader("alice", "https://push.example/a");
        start(u);
        clock.advance(Duration.ofHours(3).plusSeconds(1));
        assertThat(notifications.dispatchDue()).isEmpty();   // 아직 RUNNING (60분 확인은 3시간 넘은 세션을 제외)
        assertThat(dsl.fetchOne("select count(*) from reading_session where status = 'RUNNING'").get(0, Integer.class)).isEqualTo(1);
        new kr.readingroom.app.session.SessionExpirer(new kr.readingroom.app.session.SessionRepository(dsl), clock).expireOverdue();   // 10분 배치 대신 직접
        var sent = notifications.dispatchDue();
        assertThat(sent).hasSize(1);
        assertThat(sent.get(0).type()).isEqualTo("CONFIRM");
        var m = pushes.sent.get(0).message();
        assertThat(m.title()).isEqualTo("확인이 필요해요");
        assertThat(m.body()).isEqualTo("12:00에 켠 스탠드가 아직 켜져 있어요");   // 한국 시간 HH:MM
        assertThat(m.screen()).isEqualTo("LAMP");
        for (int i = 0; i < 3; i++) {
            clock.advance(Duration.ofMinutes(1));
            notifications.dispatchDue();
        }
        assertThat(pushes.sent).hasSize(1);   // 중복 발송 없음
    }

    @Test
    void confirmPushAlsoFollowsRequestTimeSwitch() throws Exception {
        long u = reader("alice", "https://push.example/a");
        start(u);
        clock.advance(Duration.ofHours(4));
        mvc.perform(GET(u, "/sessions/current"));    // 요청 시점에 먼저 전환돼도
        assertThat(notifications.dispatchDue()).hasSize(1);
        notifications.dispatchDue();
        assertThat(pushes.sent).hasSize(1);
    }

    @Test
    void noPushIfAlreadyResolvedBeforeBatchRuns() throws Exception {
        long u = reader("alice", "https://push.example/a");
        long sid = start(u);
        clock.advance(Duration.ofHours(4));
        mvc.perform(GET(u, "/sessions/current"));
        mvc.perform(POST(u, "/sessions/" + sid + "/confirm", Map.of("discard", true)));
        assertThat(notifications.dispatchDue()).isEmpty();
    }

    // ---- 전송 ----

    @Test
    void sendsToEveryDeviceOfOwnerOnlyAndDropsGoneSubscriptions() throws Exception {
        long u = reader("alice", "https://push.example/a1");
        mvc.perform(POST(u, "/me/push-subscription", sub("https://push.example/a2", "k2")));
        long other = reader("bob", "https://push.example/b1");   // bob 은 스탠드를 켜지 않았다
        start(u);
        clock.advance(Duration.ofMinutes(61));
        pushes.goneEndpoints.add("https://push.example/a2");      // 410
        notifications.dispatchDue();
        assertThat(pushes.sent).hasSize(2);
        assertThat(pushes.sent).allMatch(s -> s.to().userId() == u);
        assertThat(dsl.fetchOne("select count(*) from push_subscription where user_id = ?", u).get(0, Integer.class)).isEqualTo(1);   // 만료된 기기는 삭제
        assertThat(dsl.fetchOne("select count(*) from push_subscription where user_id = ?", other).get(0, Integer.class)).isEqualTo(1);
    }

    @Test
    void userWithoutSubscriptionStillClaimsOnceAndSendsNothing() throws Exception {
        long u = newUser("alice");
        mvc.perform(POST(u, "/books", Map.of("title", "책")));
        start(u);
        clock.advance(Duration.ofMinutes(61));
        assertThat(notifications.dispatchDue()).hasSize(1);   // 대상은 선정되지만 보낼 기기가 없다
        assertThat(pushes.sent).isEmpty();
        mvc.perform(POST(u, "/me/push-subscription", sub("https://push.example/late", "k")));
        assertThat(notifications.dispatchDue()).isEmpty();    // 구독을 늦게 해도 지난 알림은 다시 오지 않는다
    }

    @Test
    void vapidKeysComeOnlyFromEnvironment() throws Exception {
        assertThat(new kr.readingroom.app.push.PushProperties("", "", "").configured()).isFalse();
        assertThat(new kr.readingroom.app.push.PushProperties("pub", "priv", "mailto:x@example.com").configured()).isTrue();
        // application.properties 는 ${VAPID_*:} 환경변수 자리만 가진다 (값이 박혀 있지 않다)
        String props = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/application.properties"));
        assertThat(props).contains("${VAPID_PUBLIC_KEY:}").contains("${VAPID_PRIVATE_KEY:}");
    }
}
