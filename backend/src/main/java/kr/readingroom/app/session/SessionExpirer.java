package kr.readingroom.app.session;

import java.time.Clock;
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
    private final SessionRepository sessionRepository;
    private final Clock clock;

    public SessionExpirer(SessionRepository sessionRepository, Clock clock) {
        this.sessionRepository = sessionRepository;
        this.clock = clock;
    }

    /** started_at + 3시간 < now 인 RUNNING 세션 하나를 전환한다. 전환했으면 true. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean expire(long sessionId) {
        return sessionRepository.expire(clock.instant().toString(), sessionId, clock.instant().minus(SessionService.CAP).toString()) > 0;
    }

    /**
     * 10분 배치가 부른다: 켠 지 3시간을 넘긴(정확히 3시간은 아직) RUNNING 세션을 모두 NEEDS_CONFIRM으로 바꾸고
     * 전환 시각(needs_confirm_at)을 남긴다. 이미 NEEDS_CONFIRM/DONE/DISCARDED인 세션은 건드리지 않는다.
     * 전환된 세션 id를 돌려준다.
     */
    @Transactional
    public java.util.List<Long> expireOverdue() {
        return sessionRepository.expireOverdue(clock.instant().toString(), clock.instant().minus(SessionService.CAP).toString())
                .getValues(0, Long.class);
    }
}
