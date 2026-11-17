package kr.readingroom.app.push;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 전송 대신 로그만 남기는 구현. VAPID 키는 환경변수(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)로만 받고
 * 코드·저장소에 넣지 않는다. 키 값은 로그에도 찍지 않는다.
 */
@Component
public class LogPushSender implements PushSender {
    private static final Logger log = LoggerFactory.getLogger(LogPushSender.class);
    private final PushProperties props;

    public LogPushSender(PushProperties props) {
        this.props = props;
    }

    @Override
    public Result send(Subscription to, Message m) {
        log.info("[푸시 대신 로그] user={} type={} title='{}' body='{}' screen={} (VAPID 키 {})",
                to.userId(), m.type(), m.title(), m.body(), m.screen(), props.configured() ? "설정됨" : "없음");
        return Result.SENT;
    }
}
