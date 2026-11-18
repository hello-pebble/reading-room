package kr.readingroom.app;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** 테스트에서 시각을 고정·이동할 수 있는 Clock. */
public class TestClock extends Clock {
    private volatile Instant now = Instant.parse("2026-11-17T03:00:00Z"); // 한국 시간 12:00

    public void set(String iso) { now = Instant.parse(iso); }
    public void advance(Duration d) { now = now.plus(d); }

    @Override public ZoneId getZone() { return ZoneOffset.UTC; }
    @Override public Clock withZone(ZoneId zone) { return this; }
    @Override public Instant instant() { return now; }
}
