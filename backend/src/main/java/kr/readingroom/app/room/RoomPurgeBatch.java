package kr.readingroom.app.room;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 매일 새벽 4시(한국 시간)에 끝난 지 7일이 지난 공유방을 지운다. 테스트는 app.scheduling.enabled=false로 끄고 서비스를 직접 부른다. */
@Component
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class RoomPurgeBatch {
    private static final Logger log = LoggerFactory.getLogger(RoomPurgeBatch.class);
    private final RoomPurgeService purge;

    public RoomPurgeBatch(RoomPurgeService purge) {
        this.purge = purge;
    }

    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    public void run() {
        try {
            int n = purge.purgeExpired();
            if (n > 0) log.info("끝난 지 7일이 지난 공유방 {}개를 지웠어요", n);
        } catch (RuntimeException e) {
            log.warn("공유방 삭제 배치 실패: {}", e.toString());
        }
    }
}
