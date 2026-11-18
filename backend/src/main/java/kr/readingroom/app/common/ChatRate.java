package kr.readingroom.app.common;

import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpStatus;

/**
 * 채팅 도배 방지 규칙 (결정 #61). 광장과 공유방 대화가 같이 쓴다.
 * ① 사용자당 3초 안에 3건까지: 3초 전보다 뒤에 보낸 글이 이미 3건이면 4번째는 429 TOO_FAST.
 * ② 내 직전 글과 같은 글(앞뒤 공백 무시)을 30초 안에 다시 보내면 409 DUPLICATE_MESSAGE.
 * 짧게 빠르게 치는 사람은 막지 않고 연타·붙여넣기 도배만 막는다. 막힌 요청은 글로 세지 않는다.
 */
public final class ChatRate {
    public static final Duration WINDOW = Duration.ofSeconds(3), DUPLICATE = Duration.ofSeconds(30);
    public static final int MAX_IN_WINDOW = 3;

    private ChatRate() {}

    /** sentInWindow는 now - WINDOW 보다 뒤에 보낸 내 글 수, lastContent·lastAt은 내 직전 글(없으면 null) */
    public static void check(Instant now, int sentInWindow, String lastContent, Instant lastAt, String content) {
        if (sentInWindow >= MAX_IN_WINDOW) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_FAST", "조금 뒤에 보내 주세요");
        if (lastContent != null && lastAt != null && lastAt.plus(DUPLICATE).isAfter(now) && lastContent.strip().equals(content.strip()))
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_MESSAGE", "같은 말을 연달아 보낼 수 없어요");
    }
}
