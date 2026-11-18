package kr.readingroom.app.session;

import kr.readingroom.app.session.dto.*;
import kr.readingroom.app.book.NoteRepository;
import kr.readingroom.app.book.BookRepository;
import kr.readingroom.app.common.RequestJson;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import kr.readingroom.app.book.BookService;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.Db;
import kr.readingroom.app.common.ClockConfig;
import org.jooq.Record;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionService {
    /** 켠 지 이만큼이 넘으면 자동으로 끄지 않고 확인을 요구한다 (SPEC 3시간 규칙). */
    public static final Duration CAP = Duration.ofHours(3);
    private static final List<String> CLIENT_END_BY = List.of("LAMP", "PIP", "NOTIFICATION");

    private final BookRepository bookRepository;
    private final NoteRepository noteRepository;
    private final SessionRepository sessionRepository;
    private final Clock clock;
    private final BookService books;
    private final SessionExpirer expirer;

    public SessionService(BookRepository bookRepository, NoteRepository noteRepository, SessionRepository sessionRepository, Clock clock, BookService books, SessionExpirer expirer) {
        this.bookRepository = bookRepository;
        this.noteRepository = noteRepository;
        this.sessionRepository = sessionRepository;
        this.clock = clock;
        this.books = books;
        this.expirer = expirer;
    }

    /** 서버 시각. 클라이언트가 보낸 경과 시간은 받지 않는다. */
    public String now() {
        return clock.instant().toString();
    }

    @Transactional
    public SessionResponse start(long userId) {
        Record book = bookRepository.findReading(userId);
        if (book == null)
            throw new ApiException(HttpStatus.BAD_REQUEST, "NO_READING_BOOK", "소파에 책을 먼저 올려 주세요");
        Record existing = active(userId);
        if (existing != null) throw alreadyRunning(expireIfOver(existing));
        try {
            Record r = sessionRepository.start(userId, book.get("id", Long.class), now(), now(), book.get("current_page", Integer.class));
            return view(r);
        } catch (DuplicateKeyException e) {
            throw alreadyRunning(expireIfOver(active(userId)));
        }
    }

    /** 켜져 있는 세션(RUNNING 또는 NEEDS_CONFIRM)과 서버 시각. 클라이언트가 시계 차이를 보정한다. */
    @Transactional
    public CurrentSessionResponse current(long userId) {
        Record r = active(userId);
        if (r != null) r = expireIfOver(r);
        return new CurrentSessionResponse(r == null ? null : view(r), clock.instant());
    }

    Record active(long userId) {
        return sessionRepository.findActive(userId);
    }

    /** 3시간을 넘긴 RUNNING 세션이면 NEEDS_CONFIRM으로 바꾸고 다시 읽는다 (10분 배치가 오기 전에 요청이 먼저 와도 우회되지 않게). 행을 잠그기 전에 불러야 한다. */
    Record expireIfOver(Record r) {
        if (!"RUNNING".equals(r.get("status", String.class))) return r;
        if (!expirer.expire(r.get("id", Long.class))) return r;
        return sessionRepository.findById(r.get("id", Long.class));
    }

    /** 내 세션을 찾아(남의 것은 404) 3시간 넘은 것은 먼저 전환하고, 행을 잠가 읽는다. */
    private Record lock(long userId, long id) {
        Record r = sessionRepository.findOwned(id, userId);
        if (r == null) throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "기록을 찾을 수 없어요");
        expirer.expire(id);
        return sessionRepository.lock(id);
    }

    private static boolean finished(Record r) {
        String st = r.get("status", String.class);
        return st.equals("DONE") || st.equals("DISCARDED");
    }

    /** 스탠드 끄기. 이미 끝난 세션이면 그대로 200 (멱등). */
    @Transactional
    public SessionResponse stop(long userId, long id, SessionRequest b) {
        Record r = lock(userId, id);
        if (finished(r)) return view(r);
        String by = (b == null ? null : b.endedBy());
        if (by == null) by = "LAMP";
        if (!CLIENT_END_BY.contains(by)) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_ENDED_BY", "endedBy는 LAMP/PIP/NOTIFICATION 중 하나예요");
        // 확인(NEEDS_CONFIRM) 없이 끄는 길로는 마지막으로 확인한 시각까지만 기록한다
        Instant end = "NEEDS_CONFIRM".equals(r.get("status", String.class)) ? r.get("last_check_at", OffsetDateTime.class).toInstant() : clock.instant();
        return close(r, end, by, b);
    }

    @Transactional
    public SessionResponse check(long userId, long id) {
        Record r = lock(userId, id);
        if (!"RUNNING".equals(r.get("status", String.class)))
            throw new ApiException(HttpStatus.CONFLICT, "NOT_RUNNING", "켜져 있는 스탠드에서만 [계속]을 누를 수 있어요");
        return view(sessionRepository.check(now(), id));
    }

    /** 3시간을 넘겨 확인이 필요한 세션을 푼다: until=LAST_CHECK | MINUTES(+minutes) 또는 discard=true. */
    @Transactional
    public SessionResponse confirm(long userId, long id, SessionRequest b) {
        Record r = lock(userId, id);
        if (!"NEEDS_CONFIRM".equals(r.get("status", String.class)))
            throw new ApiException(HttpStatus.CONFLICT, "NOT_NEEDS_CONFIRM", "확인이 필요한 스탠드가 아니에요");
        Instant started = r.get("started_at", OffsetDateTime.class).toInstant();
        if (b != null && RequestJson.node(b.discard()).asBoolean(false)) {
            return view(sessionRepository.discard(now(), id));
        }
        String until = (b == null ? null : b.until());
        Instant end;
        if ("LAST_CHECK".equals(until)) {
            Instant last = r.get("last_check_at", OffsetDateTime.class).toInstant();
            // '계속'을 누른 적이 없으면(마지막 확인이 켠 지 1분 미만) 1시간 읽은 걸로 본다
            end = Duration.between(started, last).toSeconds() >= 60 ? last : started.plus(Duration.ofHours(1));
        } else if ("MINUTES".equals(until)) {
            long m = RequestJson.node(b.minutes()).isNumber() ? b.minutes().asLong() : 0;
            if (m < 1 || m > 600 || started.plus(Duration.ofMinutes(m)).isAfter(clock.instant()))
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_MINUTES", "1~600분 사이, 켠 뒤 지난 시간 안으로 입력해 주세요");
            end = started.plus(Duration.ofMinutes(m));
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_UNTIL", "until은 LAST_CHECK 또는 MINUTES, 아니면 discard:true를 보내 주세요");
        }
        return close(r, end, "CONFIRM", b);
    }

    /** 완독·포기가 켜진 스탠드를 같이 끌 때 쓴다. RUNNING이면 지금까지 기록하고, 확인 필요 상태면 호출한 쪽이 먼저 막아야 한다. */
    public void stopForBookEnd(long userId) {
        Record r = active(userId);
        if (r == null) return;
        r = lock(userId, r.get("id", Long.class));
        if ("NEEDS_CONFIRM".equals(r.get("status", String.class))) throw needsConfirm();
        close(r, clock.instant(), "FINISH", null);
    }

    /** 켜진 세션이 확인 필요 상태인지 (완독·포기를 막는 데 쓴다). 3시간을 막 넘긴 RUNNING도 여기서 확인 필요로 바꾼다. */
    public boolean needsConfirm(long userId) {
        Record r = active(userId);
        return r != null && "NEEDS_CONFIRM".equals(expireIfOver(r).get("status", String.class));
    }

    public static ApiException needsConfirm() {
        return new ApiException(HttpStatus.CONFLICT, "NEEDS_CONFIRM", "먼저 스탠드 시간을 확인해 주세요");
    }

    /** 직접 기록: 오늘/어제(daysAgo 0|1) 또는 date(YYYY-MM-DD, 한국 날짜, 오늘 이전)의 정오에 minutes(1~600)분. */
    @Transactional
    public SessionResponse manual(long userId, SessionRequest b) {
        long m = RequestJson.node(b.minutes()).isNumber() ? Math.round(b.minutes().asDouble()) : 0;
        if (m < 1 || m > 600) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_MINUTES", "1~600분 사이로 입력해 주세요");
        LocalDate today = LocalDate.ofInstant(clock.instant(), ClockConfig.SEOUL);
        LocalDate day;
        try {
            if ((b == null ? null : b.date()) != null) day = LocalDate.parse((b == null ? null : b.date()));
            else if (RequestJson.present(b.daysAgo())) day = today.minusDays(b.daysAgo().asLong());
            else day = today;
        } catch (java.time.format.DateTimeParseException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_DATE", "날짜는 YYYY-MM-DD 형식이에요");
        }
        if (day.isAfter(today)) throw new ApiException(HttpStatus.BAD_REQUEST, "FUTURE", "미래 날짜는 기록할 수 없어요");
        Record book = bookRepository.findReading(userId);
        if (book == null) throw new ApiException(HttpStatus.BAD_REQUEST, "NO_READING_BOOK", "소파에 책을 먼저 올려 주세요");
        Instant start = day.atTime(LocalTime.NOON).atZone(ClockConfig.SEOUL).toInstant();   // 날짜는 선택한 날 정오로 저장 (LP-06)
        Instant end = start.plus(Duration.ofMinutes(m));
        Record r = sessionRepository.insertManual(userId, book.get("id", Long.class), start.toString(), end.toString(), end.toString(), book.get("current_page", Integer.class));
        return view(applyPageAndMemo(r, b));
    }

    /** 세션을 닫는다. 1분 미만(초는 내림)은 DISCARDED, 아니면 DONE. */
    private SessionResponse close(Record r, Instant end, String endedBy, SessionRequest b) {
        Instant started = r.get("started_at", OffsetDateTime.class).toInstant();
        boolean tooShort = Duration.between(started, end).toSeconds() < 60;
        Record done = sessionRepository.close(tooShort ? "DISCARDED" : "DONE", end.toString(), endedBy, r.get("id", Long.class));
        return view(applyPageAndMemo(done, b));
    }

    /** 끄는 화면의 현재 쪽·전체 쪽·한 줄 메모. 현재 쪽은 줄지 않고, 메모는 책의 메모로 남는다 (프로토타입 stopSave). */
    private Record applyPageAndMemo(Record session, SessionRequest b) {
        if (b == null) return session;
        long bookId = session.get("book_id", Long.class);
        if (RequestJson.present(b.totalPages())) {   // 전체 쪽수를 모르던 책만 여기서 채운다
            Integer total = BookService.normTotal(b.totalPages());
            if (total != null) bookRepository.fillTotalPages(total, bookId);
        }
        Integer endPage = null;
        if (RequestJson.present(b.endPage())) {
            if (!b.endPage().isNumber()) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_PAGE", "쪽수는 숫자예요");
            endPage = (int) Math.max(0, Math.min(BookService.MAX_PAGES, Math.round(b.endPage().asDouble())));
            books.raisePage(bookId, endPage);
        }
        String memo = (b == null ? null : b.memo());
        if (memo != null && memo.length() > 500) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_MEMO", "메모는 500자까지예요");
        if (memo != null && memo.isEmpty()) memo = null;
        if (memo != null)
            noteRepository.insertMemo(bookId, memo, now());
        return sessionRepository.updateDetails(endPage, memo, session.get("id", Long.class));
    }


    private ApiException alreadyRunning(Record existing) {
        return new ApiException(HttpStatus.CONFLICT,
                new AlreadyRunningResponse("ALREADY_RUNNING", "이미 스탠드가 켜져 있어요", view(existing), clock.instant()));
    }

    public SessionResponse view(Record r) {
        OffsetDateTime start = r.get("started_at", OffsetDateTime.class), end = r.get("ended_at", OffsetDateTime.class);
        return new SessionResponse(r.get("id", Long.class), r.get("book_id", Long.class), r.get("status", String.class),
                r.get("source", String.class), Db.instant(r, "started_at"), Db.instant(r, "ended_at"), Db.instant(r, "last_check_at"),
                r.get("ended_by", String.class), r.get("start_page", Integer.class), r.get("end_page", Integer.class),
                r.get("memo", String.class), end == null ? null : Duration.between(start, end).toMinutes());
    }
}
