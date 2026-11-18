package kr.readingroom.app.push;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 검증·기능 규칙·트랜잭션 경계는 서비스에서 관리한다. */
@Repository
public class NotificationRepository {
    private final DSLContext dsl;

    public NotificationRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Result<Record> claimConfirm(String now) {
        return dsl.fetch("""
                update reading_session s set confirm_notified_at = ?::timestamptz
                from book b
                where b.id = s.book_id and s.status = 'NEEDS_CONFIRM' and s.needs_confirm_at is not null and s.confirm_notified_at is null
                returning s.id, s.user_id, s.started_at, b.title""", now);
    }

    public Result<Record> claimCheck(String lastCheckBefore, String startedAfter) {
        return dsl.fetch("""
                update reading_session s set check_notified_for = s.last_check_at
                from book b
                where b.id = s.book_id and s.status = 'RUNNING'
                  and s.last_check_at < ?::timestamptz
                  and s.started_at >= ?::timestamptz
                  and s.check_notified_for is distinct from s.last_check_at
                returning s.id, s.user_id, s.started_at, b.title""", lastCheckBefore, startedAfter);
    }
}
