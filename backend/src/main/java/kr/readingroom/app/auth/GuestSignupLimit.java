package kr.readingroom.app.auth;

import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 게스트 계정을 마구 만드는 것을 막는 가장 작은 장치(결정 #84): IP당 한 시간에 새 계정을 만들 수 있는 횟수를 센다.
 * 이미 있는 기기 키로 다시 들어오는 것은 세지 않는다. 메모리에만 두므로 서버를 다시 켜면 비워지고, 서버가 여러 대면 대마다 센다.
 * 프록시 뒤에서는 요청 IP가 프록시 주소로 보일 수 있어 서버의 forward-headers 설정을 같이 정해야 한다.
 */
@Component
public class GuestSignupLimit {
    private final IpWindowLimit limit;

    public GuestSignupLimit(Clock clock, @Value("${app.auth.guest-signups-per-hour-per-ip:30}") int max) {
        this.limit = new IpWindowLimit(clock, max, Duration.ofHours(1));
    }

    /** 새 계정 하나를 만들어도 되면 세고 true, 이 IP가 한 시간 안에 한도를 채웠으면 false */
    public boolean tryAcquire(String ip) {
        return limit.tryAcquire(ip);
    }
}
