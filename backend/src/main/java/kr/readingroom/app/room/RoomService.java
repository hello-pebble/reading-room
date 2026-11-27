package kr.readingroom.app.room;

import com.fasterxml.jackson.databind.JsonNode;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Set;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.ClockConfig;
import kr.readingroom.app.common.Db;
import kr.readingroom.app.common.RequestJson;
import kr.readingroom.app.room.dto.AgreeResponse;
import kr.readingroom.app.room.dto.CloseRoomResponse;
import kr.readingroom.app.room.dto.CreateRoomRequest;
import kr.readingroom.app.room.dto.InvitePreviewResponse;
import kr.readingroom.app.room.dto.JoinRoomRequest;
import kr.readingroom.app.village.BoardService;
import kr.readingroom.app.village.dto.RoomResponse;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공유방(모닥불) 개설·초대 미리보기·닫기·입장·나가기·보관 동의. 상태는 저장값이 아니라 시각으로 계산한다(BoardService.state).
 * 규칙: 진행 1~7시간, 최대 2~10명, 초대 코드로만 입장, 동시 2개·하루 3번 (결정 #32·#41·#53·#54).
 */
@Service
public class RoomService {
    static final int MAX_LIVE = 2, MAX_PER_DAY = 3, DEFAULT_MAX = 8, DEFAULT_HOURS = 3, TITLE_MAX = 100;
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // I O 0 1 제외
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Set<String> KINDS = Set.of("SAME", "OWN");
    private final RoomRepository rooms;
    private final Clock clock;

    public RoomService(RoomRepository rooms, Clock clock) {
        this.rooms = rooms;
        this.clock = clock;
    }

    @Transactional
    public RoomResponse create(long userId, CreateRoomRequest body) {
        String kind = body.kind();
        if (kind == null || !KINDS.contains(kind)) throw bad("BAD_KIND", "kind는 SAME(같은 책) 또는 OWN(각자 읽기)이어야 해요");
        String visibility = body.visibility() == null ? "INVITE" : body.visibility();   // 공개 방은 누구나 코드 없이 입장 (결정 #101)
        if (!visibility.equals("INVITE") && !visibility.equals("PUBLIC"))
            throw bad("BAD_VISIBILITY", "공개 범위는 INVITE(초대만) 또는 PUBLIC(누구나)이어야 해요");
        String isbn = body.isbn();
        if (kind.equals("SAME") && (isbn == null || isbn.isEmpty())) throw bad("ISBN_REQUIRED", "같은 책 방은 책(isbn)이 필요해요");
        if (kind.equals("OWN")) isbn = null;                          // 각자 읽기는 방에 책을 두지 않는다
        if (isbn != null && isbn.length() > 20) throw bad("BAD_ISBN", "isbn이 너무 길어요");
        if (body.title() != null && body.title().codePointCount(0, body.title().length()) > TITLE_MAX)
            throw bad("BAD_TITLE", "방 이름은 " + TITLE_MAX + "자까지예요");
        int max = intField(body.maxParticipants(), DEFAULT_MAX, 2, 10, "BAD_MAX", "최대 인원은 2~10명이에요");
        int hours = intField(body.hours(), DEFAULT_HOURS, 1, 7, "BAD_HOURS", "진행 시간은 1~7시간이에요");
        Instant now = clock.instant();
        Instant open = now;
        if (body.openAt() != null) {
            try {
                open = Instant.parse(body.openAt());
            } catch (DateTimeParseException e) {
                throw bad("BAD_OPEN_AT", "openAt은 시각(예: 2026-11-18T03:00:00Z)이어야 해요");
            }
            if (open.isBefore(now)) throw bad("OPEN_AT_PAST", "시작 시각은 지금보다 뒤여야 해요");
        }
        Long bookId = RequestJson.present(body.bookId()) ? idField(body.bookId()) : null;
        Record book = bookId == null ? null : rooms.findOwnedBook(bookId, userId);
        if (bookId != null && book == null) throw new ApiException(HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND", "내 책을 찾을 수 없어요");
        if (book != null && kind.equals("SAME") && !isbn.equals(book.get("isbn", String.class)))
            throw bad("BOOK_MISMATCH", "고른 책이 방의 책과 달라요");

        rooms.lockUser(userId);                                       // 같은 사용자의 동시 개설을 한 줄로 세운다
        if (rooms.countLive(userId, now) >= MAX_LIVE)
            throw new ApiException(HttpStatus.CONFLICT, "ROOM_LIMIT_LIVE", "동시에 열 수 있는 모닥불은 " + MAX_LIVE + "개예요");
        LocalDate today = now.atZone(ClockConfig.SEOUL).toLocalDate();
        if (rooms.countOpened(userId, today.atStartOfDay(ClockConfig.SEOUL).toInstant(), today.plusDays(1).atStartOfDay(ClockConfig.SEOUL).toInstant()) >= MAX_PER_DAY)
            throw new ApiException(HttpStatus.CONFLICT, "ROOM_LIMIT_DAILY", "하루에 " + MAX_PER_DAY + "번까지 열 수 있어요. 취소한 방도 세어요. 내일 다시 열어 주세요");

        String title = body.title() != null && !body.title().isEmpty() ? body.title()
                : autoTitle(kind, book == null ? null : book.get("title", String.class), rooms.nickname(userId));
        Instant close = open.plus(Duration.ofHours(hours));
        String status = open.isAfter(now) ? "SCHEDULED" : "OPEN";
        Long id = null;
        for (int i = 0; i < 8 && id == null; i++) id = rooms.insertRoom(userId, kind, isbn, title, visibility, max, newCode(), open, close, status, now);
        if (id == null) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "CODE_BUSY", "초대 코드를 만들지 못했어요. 다시 시도해 주세요");
        rooms.insertParticipant(id, userId, bookId, now);
        rooms.insertOpenLog(userId, id, now);
        return BoardService.view(rooms.view(id, userId), userId, now);
    }

    /** 초대 링크 미리보기. 취소돼 없어졌거나 보관 7일이 지난 방은 404, 종료된 방은 status CLOSED로 보여 준다. */
    public InvitePreviewResponse preview(String code) {
        Record r = rooms.viewByCode(normalize(code));
        RoomResponse v = r == null ? null : BoardService.view(r, 0, clock.instant());
        if (v == null) throw notFound();
        return new InvitePreviewResponse(v.title(), v.kind(), v.isbn(), v.isbn() == null ? null : rooms.bookTitle(v.id()), v.status(),
                v.ownerNickname(), v.participants(), v.maxParticipants(), v.openAt(), v.closeAt(), v.closedAt());
    }

    /** 개설자만. 예정 방은 취소(행 삭제, 개설 기록은 남아 하루 3번에 센다), 열린 방은 closed_at을 기록해 그날부터 7일 보관한다. */
    @Transactional
    public CloseRoomResponse close(long userId, long roomId) {
        Record room = rooms.lock(roomId);
        if (room == null) throw notFound();
        if (room.get("created_by", Long.class) != userId) throw new ApiException(HttpStatus.FORBIDDEN, "NOT_OWNER", "방을 연 사람만 닫을 수 있어요");
        Instant now = clock.instant();
        String state = BoardService.state(Db.instant(room, "open_at"), Db.instant(room, "close_at"), Db.instant(room, "closed_at"), now);
        if (state.equals("CLOSED")) throw new ApiException(HttpStatus.CONFLICT, "ROOM_ALREADY_CLOSED", "이미 끝난 모닥불이에요");
        if (state.equals("SCHEDULED")) {
            rooms.delete(roomId);
            return new CloseRoomResponse(roomId, "CANCELED", null);
        }
        rooms.close(roomId, now);
        return new CloseRoomResponse(roomId, "CLOSED", now);
    }

    /** 입장 결과: created가 false면 이미 참여 중이라 아무것도 바꾸지 않았다(멱등, 200) */
    public record Joined(RoomResponse room, boolean created) {}

    /** 초대 코드로 입장. 정원 409, 이미 참여 중 200(멱등), 종료된 방 410, 나갔다 다시 들어오는 것은 허용한다. */
    @Transactional
    public Joined join(long userId, JoinRoomRequest body) {
        String code = normalize(body.code());
        if (code.isEmpty()) throw bad("CODE_REQUIRED", "초대 코드가 필요해요");
        Record room = rooms.lockByCode(code);                       // 같은 방의 동시 입장을 한 줄로 세운다(정원 검사)
        if (room == null) throw notFound();
        long roomId = room.get("id", Long.class);
        Instant now = clock.instant();
        Instant closeAt = Db.instant(room, "close_at"), closedAt = Db.instant(room, "closed_at");
        if (BoardService.state(Db.instant(room, "open_at"), closeAt, closedAt, now).equals("CLOSED"))
            throw new ApiException(HttpStatus.GONE, "ROOM_CLOSED", "이미 끝난 모닥불이에요");
        Record me = rooms.participant(roomId, userId);
        boolean rejoin = me != null;
        if (rejoin && me.get("left_at") == null) return new Joined(BoardService.view(rooms.view(roomId, userId), userId, now), false);

        Long bookId = RequestJson.present(body.bookId()) ? idField(body.bookId()) : null;
        if (bookId != null) {
            Record book = rooms.findOwnedBook(bookId, userId);
            if (book == null) throw new ApiException(HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND", "내 책을 찾을 수 없어요");
            String isbn = room.get("isbn", String.class);
            if (room.get("kind", String.class).equals("SAME") && !isbn.equals(book.get("isbn", String.class)))
                throw bad("BOOK_MISMATCH", "고른 책이 방의 책과 달라요");
        }
        if (rooms.countParticipants(roomId) >= room.get("max_participants", Integer.class))
            throw new ApiException(HttpStatus.CONFLICT, "ROOM_FULL", "정원이 찼어요");
        if (rejoin) rooms.rejoin(roomId, userId, bookId, now);
        else rooms.insertParticipant(roomId, userId, bookId, now);
        return new Joined(BoardService.view(rooms.view(roomId, userId), userId, now), true);
    }

    /** 방 나가기. 개설자는 나갈 수 없다(닫기를 쓴다). 내 글은 남는다(결정 #38). */
    @Transactional
    public void leave(long userId, long roomId) {
        Record room = rooms.lock(roomId);
        if (room == null) throw notFound();
        if (room.get("created_by", Long.class) == userId)
            throw new ApiException(HttpStatus.CONFLICT, "OWNER_CANNOT_LEAVE", "방을 연 사람은 나갈 수 없어요. 모닥불을 닫아 주세요");
        if (rooms.leave(roomId, userId, clock.instant()) == 0) throw new ApiException(HttpStatus.NOT_FOUND, "NOT_PARTICIPANT", "참여 중인 모닥불이 아니에요");
        rooms.deleteAlarm(userId, roomId);                          // 나간 사람에게는 개방 알림을 보내지 않는다
    }

    /**
     * 예정 방의 개방 알림 켜기(창문·마을 게시판 [알림 받기]). 참여 중인 사람만, 아직 열리지 않은(SCHEDULED) 방만.
     * 새로 켜면 true, 이미 켜져 있으면 false(멱등). 실제 푸시는 개방 배치가 보낸다(아직 없음).
     */
    @Transactional
    public boolean alarmOn(long userId, long roomId) {
        Instant now = clock.instant();
        Record room = rooms.lock(roomId);
        if (room == null || BoardService.view(rooms.view(roomId, userId), userId, now) == null) throw notFound();
        Record me = rooms.participant(roomId, userId);
        if (me == null || me.get("left_at") != null) throw new ApiException(HttpStatus.FORBIDDEN, "NOT_PARTICIPANT", "참여 중인 모닥불이 아니에요");
        String state = BoardService.state(Db.instant(room, "open_at"), Db.instant(room, "close_at"), Db.instant(room, "closed_at"), now);
        if (state.equals("CLOSED")) throw new ApiException(HttpStatus.GONE, "ROOM_CLOSED", "이미 끝난 모닥불이에요");
        if (state.equals("OPEN")) throw new ApiException(HttpStatus.CONFLICT, "ROOM_ALREADY_OPEN", "이미 열린 모닥불이에요");
        return rooms.insertAlarm(userId, roomId, now);
    }

    /** 개방 알림 끄기. 켜 둔 적이 없어도 204(멱등). 방이 없으면 404 */
    @Transactional
    public void alarmOff(long userId, long roomId) {
        if (rooms.find(roomId) == null) throw notFound();
        rooms.deleteAlarm(userId, roomId);
    }

    /** 보관 동의 기록. 참여 중인 사람만(403). 이미 동의했으면 처음 시각을 그대로 돌려준다. */
    @Transactional
    public AgreeResponse agree(long userId, long roomId) {
        if (rooms.lock(roomId) == null) throw notFound();
        Instant at = rooms.agree(roomId, userId, clock.instant());
        if (at == null) throw new ApiException(HttpStatus.FORBIDDEN, "NOT_PARTICIPANT", "참여 중인 사람만 동의할 수 있어요");
        return new AgreeResponse(roomId, at);
    }

    static String normalize(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }

    static String newCode() {
        char[] c = new char[8];
        for (int i = 0; i < c.length; i++) c[i] = CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length()));
        return new String(c);
    }

    /** 이름을 비우면 자동: 같은 책 『책』 같이 읽기, 각자 읽기 ○○의 모닥불 */
    static String autoTitle(String kind, String bookTitle, String nickname) {
        if (kind.equals("OWN")) return nickname + "의 모닥불";
        if (bookTitle == null || bookTitle.isBlank()) return "같이 읽기";
        String t = bookTitle.codePointCount(0, bookTitle.length()) > 90 ? bookTitle.substring(0, bookTitle.offsetByCodePoints(0, 89)) + "…" : bookTitle;
        return "『" + t + "』 같이 읽기";
    }

    private static int intField(JsonNode v, int fallback, int min, int max, String code, String message) {
        if (!RequestJson.present(v)) return fallback;
        if (!v.isIntegralNumber() || !v.canConvertToInt() || v.asInt() < min || v.asInt() > max) throw bad(code, message);
        return v.asInt();
    }

    private static long idField(JsonNode v) {
        if (!v.isIntegralNumber() || !v.canConvertToLong() || v.asLong() <= 0) throw bad("BAD_BOOK_ID", "bookId가 올바르지 않아요");
        return v.asLong();
    }

    private static ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND", "모닥불을 찾을 수 없어요");
    }
}
