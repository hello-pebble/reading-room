package kr.readingroom.app.calendar;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 검증·기능 규칙·트랜잭션 경계는 서비스에서 관리한다. */
@Repository
public class CalendarRepository {
    private final DSLContext dsl;

    public CalendarRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Result<Record> readingDays(long sessionUserId, long bookUserId) {
        return dsl.fetch("""
                select (ended_at at time zone 'Asia/Seoul')::date as d from reading_session
                    where user_id = ? and status = 'DONE' and source in ('TIMER','MANUAL') and ended_at is not null
                union
                select (finished_at at time zone 'Asia/Seoul')::date from book
                    where user_id = ? and status = 'DONE' and finished_at is not null""", sessionUserId, bookUserId);
    }

    public Record countFinished(long userId, String month) {
        return dsl.fetchOne("""
                select count(*) from book where user_id = ? and status = 'DONE' and finished_at is not null
                and to_char(finished_at at time zone 'Asia/Seoul', 'YYYY-MM') = ?""", userId, month);
    }
}
