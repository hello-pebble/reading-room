package kr.readingroom.app.room;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 1분마다 공유방 개방·종료를 처리한다 (DATA_API 배치 작업). 테스트는 app.scheduling.enabled=false로 끄고 서비스를 직접 부른다. */
@Component
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class RoomOpenBatch {
    private static final Logger log = LoggerFactory.getLogger(RoomOpenBatch.class);
    private final RoomOpenService openings;

    public RoomOpenBatch(RoomOpenService openings) {
        this.openings = openings;
    }

    @Scheduled(fixedDelayString = "PT1M", initialDelayString = "PT40S")
    public void run() {
        try {
            var targets = openings.dispatchDue();
            // 실제 푸시는 다음 단계(메시지 일반화·VAPID 전송)에서 붙는다. 지금은 알릴 대상만 로그로 남긴다.
            if (!targets.isEmpty()) log.info("공유방 개방 알림 대상 {}명", targets.size());
        } catch (RuntimeException e) {
            log.warn("공유방 개방 배치 실패: {}", e.toString());
        }
    }
}
