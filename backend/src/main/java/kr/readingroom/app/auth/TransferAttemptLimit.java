package kr.readingroom.app.auth;

import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 이전 코드를 맞춰 보는 것을 막는다(결정 #85): IP당 10분에 기본 10번까지. 맞든 틀리든 코드 모양이 맞는 시도를 센다. */
@Component
public class TransferAttemptLimit {
    private final IpWindowLimit limit;

    public TransferAttemptLimit(Clock clock, @Value("${app.auth.transfer-attempts-per-10min-per-ip:10}") int max) {
        this.limit = new IpWindowLimit(clock, max, Duration.ofMinutes(10));
    }

    /** 이번 시도를 허용하면 세고 true, 이 IP가 한도를 채웠으면 false */
    public boolean tryAcquire(String ip) {
        return limit.tryAcquire(ip);
    }
}
