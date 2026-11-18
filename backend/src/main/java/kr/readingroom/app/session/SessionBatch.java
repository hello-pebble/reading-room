package kr.readingroom.app.session;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 10분마다 3시간을 넘긴 스탠드를 '확인 필요'로 바꾼다 (DATA_API 배치 작업). 테스트는 app.scheduling.enabled=false로 끄고 서비스 메서드를 직접 부른다. */
@Component
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class SessionBatch {
    private static final Logger log = LoggerFactory.getLogger(SessionBatch.class);
    private final SessionExpirer expirer;

    public SessionBatch(SessionExpirer expirer) {
        this.expirer = expirer;
    }

    @Scheduled(fixedDelayString = "PT10M", initialDelayString = "PT1M")
    public void flagOverdue() {
        var ids = expirer.expireOverdue();
        if (!ids.isEmpty()) log.info("3시간 초과 스탠드 {}개를 확인 필요로 바꿨어요", ids.size());
    }
}
