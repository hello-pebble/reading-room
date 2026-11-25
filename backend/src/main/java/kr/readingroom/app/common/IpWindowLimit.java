package kr.readingroom.app.common;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/**
 * IP별로 일정 시간(window) 안에 몇 번까지 허용할지 센다. 메모리에만 두므로 서버를 다시 켜면 비워지고, 서버가 여러 대면 대마다 센다.
 * 프록시 뒤에서는 요청 IP가 프록시 주소로 보일 수 있어 서버의 forward-headers 설정을 같이 정해야 한다.
 * AuthService가 게스트 계정 만들기와 이전 코드 입력에 각각 하나씩, BookSearchController가 책 검색(IP당 1분)에 쓴다.
 */
public class IpWindowLimit {
    private static final int SWEEP_AT = 5000; // 이만큼 쌓이면 지난 항목을 치운다
    private final Clock clock;
    private final int max;
    private final Duration window;
    private final Map<String, Deque<Instant>> byIp = new HashMap<>();

    public IpWindowLimit(Clock clock, int max, Duration window) {
        this.clock = clock;
        this.max = max;
        this.window = window;
    }

    /** 이번 한 번을 허용하면 세고 true, 이 IP가 window 안에 이미 max번을 채웠으면 false */
    public synchronized boolean tryAcquire(String ip) {
        Instant now = clock.instant(), since = now.minus(window);
        if (byIp.size() > SWEEP_AT) byIp.values().removeIf(q -> q.isEmpty() || !q.peekLast().isAfter(since));
        Deque<Instant> q = byIp.computeIfAbsent(ip == null ? "" : ip, k -> new ArrayDeque<>());
        while (!q.isEmpty() && !q.peekFirst().isAfter(since)) q.pollFirst();
        if (q.size() >= max) return false;
        q.addLast(now);
        return true;
    }
}
