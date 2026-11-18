package kr.readingroom.app.village;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 1시간마다 24시간이 지난 광장 글을 지운다 (DATA_API 배치 작업). 테스트는 app.scheduling.enabled=false로 끄고 서비스를 직접 부른다. */
@Component
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class PlazaBatch {
    private static final Logger log = LoggerFactory.getLogger(PlazaBatch.class);
    private final PlazaService plaza;

    public PlazaBatch(PlazaService plaza) {
        this.plaza = plaza;
    }

    @Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT2M")
    public void purge() {
        int n = plaza.purgeExpired();
        if (n > 0) log.info("24시간이 지난 광장 글 {}개를 지웠어요", n);
    }
}
