package kr.readingroom.app.common;

import java.time.Instant;
import java.time.OffsetDateTime;
import org.jooq.Record;

public final class Db {
    private Db() {}

    /** timestamptz 컬럼을 UTC Instant로 읽는다 (JVM·DB 세션 시간대와 상관없이 응답 형식이 같다). */
    public static Instant instant(Record r, String column) {
        OffsetDateTime o = r.get(column, OffsetDateTime.class);
        return o == null ? null : o.toInstant();
    }
}
