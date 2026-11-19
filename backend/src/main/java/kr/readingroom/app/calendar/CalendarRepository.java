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
                    where user_id = ? and status = 'DONE' and finished_at is not null
                union
                select (left_at at time zone 'Asia/Seoul')::date from camp_stay
                    where user_id = ? and left_at is not null""", sessionUserId, bookUserId, sessionUserId);
    }

    /**
     * [from, to)와 겹치는 읽은 구간(끝난 스탠드·직접 기록, 저장된 모닥불 입장)을 그 범위로 잘라 시작 순으로 돌려준다.
     * 겹침을 합치는 일은 서비스가 한다(결정 #65).
     */
    public Result<Record> readingIntervals(long userId, String from, String to) {
        return dsl.fetch("""
                select greatest(started_at, ?::timestamptz) as s, least(ended_at, ?::timestamptz) as e from reading_session
                    where user_id = ? and status = 'DONE' and source in ('TIMER','MANUAL') and ended_at is not null
                      and ended_at > ?::timestamptz and started_at < ?::timestamptz
                union all
                select greatest(entered_at, ?::timestamptz), least(left_at, ?::timestamptz) from camp_stay
                    where user_id = ? and left_at is not null and left_at > ?::timestamptz and entered_at < ?::timestamptz
                order by s""", from, to, userId, from, to, from, to, userId, from, to);
    }

    public Record countFinished(long userId, String month) {
        return dsl.fetchOne("""
                select count(*) from book where user_id = ? and status = 'DONE' and finished_at is not null
                and to_char(finished_at at time zone 'Asia/Seoul', 'YYYY-MM') = ?""", userId, month);
    }
}
