package kr.readingroom.app.room;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.Db;
import kr.readingroom.app.common.RequestJson;
import kr.readingroom.app.room.dto.ArchiveResponse;
import kr.readingroom.app.room.dto.ImportRoomRequest;
import kr.readingroom.app.village.BoardService;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 서재로 가져오기 (결정 #36·#63): 종료된 방의 대화를 스냅샷으로 복사해 내 책의 [공유방] 탭에 붙인다.
 * 참여 중이고 보관 동의한 사람만, 방이 끝난 뒤 보관 7일 안에만 할 수 있고, 같은 방은 한 번만 가져온다(다시 요청하면 이미 가져온 것을 돌려준다).
 */
@Service
public class RoomArchiveService {
    private final RoomRepository rooms;
    private final RoomArchiveRepository archives;
    private final Clock clock;
    private final ObjectMapper json = new ObjectMapper();

    public RoomArchiveService(RoomRepository rooms, RoomArchiveRepository archives, Clock clock) {
        this.rooms = rooms;
        this.archives = archives;
        this.clock = clock;
    }

    /** 가져오기. 새로 가져오면 created=true(201), 이미 가져왔으면 false(200) */
    public record Imported(ArchiveResponse archive, boolean created) {}

    @Transactional
    public Imported importRoom(long userId, long roomId, ImportRoomRequest body) {
        Instant now = clock.instant();
        Record room = rooms.lock(roomId);
        if (room == null || BoardService.view(rooms.view(roomId, userId), userId, now) == null)       // 없거나 보관 7일이 지났다
            throw new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND", "모닥불을 찾을 수 없어요");
        Record me = rooms.participant(roomId, userId);
        if (me == null || me.get("left_at") != null) throw new ApiException(HttpStatus.FORBIDDEN, "NOT_PARTICIPANT", "참여 중인 모닥불이 아니에요");
        if (me.get("agreed_at") == null) throw new ApiException(HttpStatus.FORBIDDEN, "AGREE_REQUIRED", "보관 동의를 한 뒤에 가져올 수 있어요");
        Instant open = Db.instant(room, "open_at"), close = Db.instant(room, "close_at"), closedAt = Db.instant(room, "closed_at");
        if (!BoardService.state(open, close, closedAt, now).equals("CLOSED"))
            throw new ApiException(HttpStatus.CONFLICT, "ROOM_NOT_CLOSED", "모닥불이 끝난 뒤에 가져올 수 있어요");
        Record done = archives.findByUserRoom(userId, roomId);
        if (done != null) return new Imported(view(done, false, false), false);                         // 멱등

        var messages = archives.messages(roomId);
        if (messages.isEmpty()) throw new ApiException(HttpStatus.CONFLICT, "NOTHING_TO_IMPORT", "가져올 대화가 없어요");
        boolean[] created = {false};
        Record book = target(userId, roomId, room, body, created);
        Instant end = closedAt != null ? closedAt : close;
        String kind = room.get("kind", String.class), title = room.get("title", String.class);
        ObjectNode snap = json.createObjectNode();
        snap.put("roomType", kind).put("title", title).put("openedAt", open.toString()).put("closedAt", end.toString());
        ArrayNode list = snap.putArray("messages");
        Map<Long, String> names = new HashMap<>();                                                      // 다른 참여자는 처음 말한 순서대로 참여자 A, B, ...
        for (Record m : messages) {
            long author = m.get("user_id", Long.class);
            ObjectNode o = list.addObject();
            boolean mine = author == userId;
            o.put("mine", mine);
            o.put("author", mine ? "나" : names.computeIfAbsent(author, k -> alias(names.size())));
            if (m.get("page") != null) o.put("page", m.get("page", Integer.class)); else o.putNull("page");
            o.put("content", m.get("content", String.class)).put("createdAt", Db.instant(m, "created_at").toString());
        }
        long id = archives.insert(userId, book.get("id", Long.class), roomId, title, open, end, snap.toString(), now);
        return new Imported(view(archives.findById(id), created[0], false), true);
    }

    /** 책의 공유방 탭: 내 책만(남의 책은 404). 최근에 가져온 것부터, 모든 글을 그대로 내려준다 */
    public List<ArchiveResponse> byBook(long userId, long bookId) {
        if (archives.ownedBook(bookId, userId) == null) throw new ApiException(HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND", "책을 찾을 수 없어요");
        return archives.listByBook(bookId).stream().map(r -> view(r, false, true)).toList();
    }

    /**
     * 가져올 내 책: 요청의 bookId → 입장할 때 고른 책 → 같은 ISBN의 내 책(같은 책 방) → 없으면 "나중에 읽을 책" 새로 만들기(같은 책 방).
     * 각자 읽기 방에서 책을 못 정하면 400. 같은 책 방은 방의 책(ISBN)과 같은 책만 붙일 수 있다.
     */
    private Record target(long userId, long roomId, Record room, ImportRoomRequest body, boolean[] created) {
        boolean same = room.get("kind", String.class).equals("SAME");
        String isbn = room.get("isbn", String.class);
        Long bookId = null;
        if (RequestJson.present(body.bookId())) {
            JsonNode v = body.bookId();
            if (!v.isIntegralNumber() || !v.canConvertToLong() || v.asLong() <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_BOOK_ID", "bookId가 올바르지 않아요");
            bookId = v.asLong();
            Record b = archives.ownedBook(bookId, userId);
            if (b == null) throw new ApiException(HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND", "내 책을 찾을 수 없어요");
            if (same && !isbn.equals(b.get("isbn", String.class))) throw new ApiException(HttpStatus.BAD_REQUEST, "BOOK_MISMATCH", "고른 책이 방의 책과 달라요");
            return b;
        }
        Long chosen = archives.participantBookId(roomId, userId);
        if (chosen != null) {
            Record b = archives.ownedBook(chosen, userId);
            if (b != null) return b;
        }
        if (same) {
            Record b = archives.myBookByIsbn(userId, isbn);
            if (b != null) return b;
            Record src = archives.ownerBook(roomId);
            if (src == null) throw new ApiException(HttpStatus.BAD_REQUEST, "BOOK_REQUIRED", "가져올 내 책(bookId)을 골라 주세요");
            created[0] = true;
            return archives.insertLaterBook(userId, isbn, src.get("title", String.class), src.get("author", String.class), src.get("cover_url", String.class), src.get("total_pages", Integer.class));
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "BOOK_REQUIRED", "가져올 내 책(bookId)을 골라 주세요");
    }

    /** 0→참여자 A ... 25→참여자 Z, 26→참여자 27 */
    static String alias(int i) {
        return i < 26 ? "참여자 " + (char) ('A' + i) : "참여자 " + (i + 1);
    }

    private ArchiveResponse view(Record r, boolean bookCreated, boolean withMessages) {
        JsonNode snap;
        try {
            snap = json.readTree(r.get("snapshot", String.class));
        } catch (Exception e) {
            throw new IllegalStateException("스냅샷을 읽을 수 없어요", e);
        }
        JsonNode msgs = snap.get("messages");
        return new ArchiveResponse(r.get("id", Long.class), r.get("book_id", Long.class), r.get("book_status", String.class), bookCreated,
                r.get("room_id", Long.class), r.get("room_title", String.class), snap.path("roomType").asText(), Db.instant(r, "opened_at"), Db.instant(r, "closed_at"),
                msgs == null ? 0 : msgs.size(), Db.instant(r, "imported_at"), withMessages ? msgs : null);
    }
}
