package kr.readingroom.app.session;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 검증·기능 규칙·트랜잭션 경계는 서비스에서 관리한다. */
@Repository
public class SessionRepository {
    private final DSLContext dsl;

    public SessionRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Result<Record> expireOverdue(String now, String startedBefore) {
        return dsl.fetch("""
                update reading_session set status = 'NEEDS_CONFIRM', needs_confirm_at = ?::timestamptz
                where status = 'RUNNING' and started_at < ?::timestamptz returning id""", now, startedBefore);
    }

    public int expire(String now, long sessionId, String startedBefore) {
        return dsl.execute("""
                update reading_session set status = 'NEEDS_CONFIRM', needs_confirm_at = ?::timestamptz
                where id = ? and status = 'RUNNING' and started_at < ?::timestamptz""", now, sessionId, startedBefore);
    }

    public Record updateDetails(Integer endPage, String memo, long id) {
        return dsl.fetchOne("update reading_session set end_page = ?, memo = ? where id = ? returning *", endPage, memo, id);
    }

    public Record close(String status, String endedAt, String endedBy, long id) {
        return dsl.fetchOne("update reading_session set status = ?, ended_at = ?::timestamptz, ended_by = ? where id = ? returning *", status, endedAt, endedBy, id);
    }

    public Record insertManual(long userId, long bookId, String startedAt, String endedAt, String lastCheckAt, Integer startPage) {
        return dsl.fetchOne("""
                insert into reading_session(user_id, book_id, started_at, ended_at, last_check_at, status, source, ended_by, start_page)
                values (?, ?, ?::timestamptz, ?::timestamptz, ?::timestamptz, 'DONE', 'MANUAL', 'MANUAL', ?) returning *""", userId, bookId, startedAt, endedAt, lastCheckAt, startPage);
    }

    public Record discard(String now, long id) {
        return dsl.fetchOne("update reading_session set status = 'DISCARDED', ended_at = ?::timestamptz, ended_by = 'CONFIRM' where id = ? returning *", now, id);
    }

    public Record check(String now, long id) {
        return dsl.fetchOne("update reading_session set last_check_at = ?::timestamptz where id = ? returning *", now, id);
    }

    public Record lock(long id) {
        return dsl.fetchOne("select * from reading_session where id = ? for update", id);
    }

    public Record findOwned(long id, long userId) {
        return dsl.fetchOne("select * from reading_session where id = ? and user_id = ?", id, userId);
    }

    public Record findById(long id) {
        return dsl.fetchOne("select * from reading_session where id = ?", id);
    }

    public Record findActive(long userId) {
        return dsl.fetchOne("select * from reading_session where user_id = ? and status in ('RUNNING','NEEDS_CONFIRM')", userId);
    }

    public Record start(long userId, long bookId, String startedAt, String lastCheckAt, Integer startPage) {
        return dsl.fetchOne("""
                    insert into reading_session(user_id, book_id, started_at, last_check_at, status, source, start_page)
                    values (?, ?, ?::timestamptz, ?::timestamptz, 'RUNNING', 'TIMER', ?) returning *""", userId, bookId, startedAt, lastCheckAt, startPage);
    }
}
