package kr.readingroom.app.session;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import kr.readingroom.app.book.BookService;
import kr.readingroom.app.common.ApiException;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionService {
    private final DSLContext dsl;
    private final Clock clock;

    public SessionService(DSLContext dsl, Clock clock) {
        this.dsl = dsl;
        this.clock = clock;
    }

    /** 서버 시각. 클라이언트가 보낸 경과 시간은 받지 않는다. */
    public String now() {
        return clock.instant().toString();
    }

    @Transactional
    public Map<String, Object> start(long userId) {
        Record book = dsl.fetchOne("select id, current_page from book where user_id = ? and status = 'READING'", userId);
        if (book == null)
            throw new ApiException(HttpStatus.BAD_REQUEST, "NO_READING_BOOK", "소파에 책을 먼저 올려 주세요");
        Record existing = active(userId);
        if (existing != null) throw alreadyRunning(existing);
        try {
            Record r = dsl.fetchOne("""
                    insert into reading_session(user_id, book_id, started_at, last_check_at, status, source, start_page)
                    values (?, ?, ?::timestamptz, ?::timestamptz, 'RUNNING', 'TIMER', ?) returning *""",
                    userId, book.get("id", Long.class), now(), now(), book.get("current_page", Integer.class));
            return view(r);
        } catch (DuplicateKeyException e) {
            throw alreadyRunning(active(userId));
        }
    }

    /** 켜져 있는 세션(RUNNING 또는 NEEDS_CONFIRM)과 서버 시각. 클라이언트가 시계 차이를 보정한다. */
    public Map<String, Object> current(long userId) {
        Record r = active(userId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("session", r == null ? null : view(r));
        m.put("serverNow", clock.instant());
        return m;
    }

    Record active(long userId) {
        return dsl.fetchOne("select * from reading_session where user_id = ? and status in ('RUNNING','NEEDS_CONFIRM')", userId);
    }

    private ApiException alreadyRunning(Record existing) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "ALREADY_RUNNING");
        body.put("message", "이미 스탠드가 켜져 있어요");
        body.put("session", view(existing));
        body.put("serverNow", clock.instant());
        return new ApiException(HttpStatus.CONFLICT, body);
    }

    public Map<String, Object> view(Record r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.get("id", Long.class));
        m.put("bookId", r.get("book_id", Long.class));
        m.put("status", r.get("status", String.class));
        m.put("source", r.get("source", String.class));
        m.put("startedAt", r.get("started_at", OffsetDateTime.class));
        m.put("endedAt", r.get("ended_at", OffsetDateTime.class));
        m.put("lastCheckAt", r.get("last_check_at", OffsetDateTime.class));
        m.put("endedBy", r.get("ended_by", String.class));
        m.put("startPage", r.get("start_page", Integer.class));
        m.put("endPage", r.get("end_page", Integer.class));
        m.put("memo", r.get("memo", String.class));
        OffsetDateTime s = r.get("started_at", OffsetDateTime.class), e = r.get("ended_at", OffsetDateTime.class);
        m.put("minutes", e == null ? null : java.time.Duration.between(s, e).toMinutes());
        return m;
    }
}
