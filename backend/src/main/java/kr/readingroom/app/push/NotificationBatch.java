package kr.readingroom.app.push;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 1분마다 60분 확인·확인 필요 알림을 보낸다. 공유방 개방 알림은 범위 밖. */
@Component
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class NotificationBatch {
    private static final Logger log = LoggerFactory.getLogger(NotificationBatch.class);
    private final NotificationService notifications;

    public NotificationBatch(NotificationService notifications) {
        this.notifications = notifications;
    }

    @Scheduled(fixedDelayString = "PT1M", initialDelayString = "PT30S")
    public void run() {
        try {
            var sent = notifications.dispatchDue();
            if (!sent.isEmpty()) log.info("스탠드 알림 {}건을 보냈어요", sent.size());
        } catch (RuntimeException e) {
            log.warn("알림 배치 실패: {}", e.toString());
        }
    }
}
