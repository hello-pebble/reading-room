package kr.readingroom.app.push;

/** 웹 푸시 전송. 실제 VAPID 구현은 나중에 붙이고 지금은 로그만 남긴다 (LogPushSender). */
public interface PushSender {
    enum Result { SENT, GONE, FAILED }

    record Subscription(long id, long userId, String endpoint, String p256dh, String auth) {}

    /** type: CHECK(60분 확인) | CONFIRM(확인 필요). screen: 알림을 누르면 열 화면 (스탠드 창 = LAMP). */
    record Message(String type, String title, String body, String screen, long sessionId) {}

    /** 전송이 404·410(구독 만료)이면 GONE을 돌려주면 구독을 지운다. */
    Result send(Subscription to, Message message);
}
