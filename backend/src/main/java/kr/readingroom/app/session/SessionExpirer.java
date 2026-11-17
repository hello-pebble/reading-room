package kr.readingroom.app.session;

import java.time.Clock;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 3시간을 넘긴 RUNNING 세션을 NEEDS_CONFIRM으로 바꾼다 (10분 배치와 요청 시점 확인이 함께 쓴다).
 * 바꾼 결과가 뒤따르는 오류 응답(409)에 롤백되지 않도록 별도 트랜잭션으로 바로 커밋한다.
 * 같은 행을 잠그기 전에 불러야 한다 (바깥 트랜잭션이 잠근 행을 기다리게 되므로).
 */
@Component
public class SessionExpirer {
    private final DSLContext dsl;
    private final Clock clock;

    public SessionExpirer(DSLContext dsl, Clock clock) {
        this.dsl = dsl;
        this.clock = clock;
    }

    /** started_at + 3시간 < now 인 RUNNING 세션 하나를 전환한다. 전환했으면 true. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean expire(long sessionId) {
        return dsl.execute("""
                update reading_session set status = 'NEEDS_CONFIRM', needs_confirm_at = ?::timestamptz
                where id = ? and status = 'RUNNING' and started_at < ?::timestamptz""",
                clock.instant().toString(), sessionId, clock.instant().minus(SessionService.CAP).toString()) > 0;
    }
}
