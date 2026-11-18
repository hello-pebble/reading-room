package kr.readingroom.app.room;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.ChatRate;
import kr.readingroom.app.common.Db;
import kr.readingroom.app.common.RequestJson;
import kr.readingroom.app.room.dto.ReadResponse;
import kr.readingroom.app.room.dto.RoomMessageRequest;
import kr.readingroom.app.room.dto.RoomMessageResponse;
import kr.readingroom.app.village.BoardService;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공유방 대화: 글 한 줄 1~300자, 사용자당 3초에 3건·같은 글 30초 연속 금지(결정 #61, `ChatRate`), 보낸 글은 삭제·수정하지 않는다(결정 #53).
 * 참여 중이고 보관 동의를 한 사람만 읽고 쓸 수 있다. 쓰기는 열린(OPEN) 방에서만, 읽기는 종료 후 보관 7일 동안도 된다.
 */
@Service
public class RoomMessageService {
    static final int MAX_CHARS = 300, PAGE = 100;
    static final String LEFT_NICKNAME = "나간 참여자";
    private final RoomRepository rooms;
    private final RoomMessageRepository messages;
    private final Clock clock;
    private final ObjectMapper json = new ObjectMapper();

    public RoomMessageService(RoomRepository rooms, RoomMessageRepository messages, Clock clock) {
        this.rooms = rooms;
        this.messages = messages;
        this.clock = clock;
    }

    /** after(글 id)가 있으면 그 다음 글부터 오래된 순으로 최대 100개, 없으면 가장 최근 100개를 오래된 순으로 */
    public List<RoomMessageResponse> list(long userId, long roomId, String after) {
        long afterId = -1;
        if (after != null && !after.isBlank()) {
            try {
                afterId = Long.parseLong(after.trim());
            } catch (NumberFormatException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_AFTER", "after는 마지막으로 본 글의 번호예요");
            }
            if (afterId < 0) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_AFTER", "after는 마지막으로 본 글의 번호예요");
        }
        member(userId, roomId, clock.instant());
        var rows = afterId >= 0 ? messages.after(roomId, afterId, PAGE) : messages.latest(roomId, PAGE);
        return rows.stream().map(r -> view(r, userId)).toList();
    }

    @Transactional
    public RoomMessageResponse send(long userId, long roomId, RoomMessageRequest body) {
        Instant now = clock.instant();
        Record room = member(userId, roomId, now);
        String state = BoardService.state(Db.instant(room, "open_at"), Db.instant(room, "close_at"), Db.instant(room, "closed_at"), now);
        if (state.equals("SCHEDULED")) throw new ApiException(HttpStatus.CONFLICT, "ROOM_NOT_OPEN", "아직 열리지 않은 모닥불이에요");
        if (state.equals("CLOSED")) throw new ApiException(HttpStatus.GONE, "ROOM_CLOSED", "이미 끝난 모닥불이에요. 글은 읽기만 할 수 있어요");
        String content = body.content();
        if (content == null || content.isBlank() || content.codePointCount(0, content.length()) > MAX_CHARS)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_CONTENT", "글은 1~" + MAX_CHARS + "자로 적어 주세요");
        Integer page = page(body.page(), room.get("kind", String.class));
        messages.lockSender(userId);
        Record last = messages.lastMessage(userId);
        ChatRate.check(now, messages.countSince(userId, now.minus(ChatRate.WINDOW)), last == null ? null : last.get("content", String.class),
                last == null ? null : Db.instant(last, "created_at"), content);
        return view(messages.insert(roomId, userId, content, page, now), userId);
    }

    /** 마지막으로 읽은 시각을 지금으로 저장한다(새 글 별 계산). 종료된 방도 보관 기간 안에는 된다. */
    @Transactional
    public ReadResponse read(long userId, long roomId) {
        Instant now = clock.instant();
        visible(roomId, userId, now);
        Instant at = messages.markRead(roomId, userId, now);
        if (at == null) throw notParticipant();
        return new ReadResponse(roomId, at);
    }

    /** 방이 있고(보관 7일이 안 지났고) 내가 참여 중이며 보관 동의를 했을 때만 방 행을 돌려준다 */
    private Record member(long userId, long roomId, Instant now) {
        Record room = visible(roomId, userId, now);
        Record me = rooms.participant(roomId, userId);
        if (me == null || me.get("left_at") != null) throw notParticipant();
        if (me.get("agreed_at") == null) throw new ApiException(HttpStatus.FORBIDDEN, "AGREE_REQUIRED", "보관 동의를 한 뒤에 볼 수 있어요");
        return room;
    }

    private Record visible(long roomId, long userId, Instant now) {
        Record room = rooms.find(roomId);
        Record v = room == null ? null : rooms.view(roomId, userId);
        if (v == null || BoardService.view(v, userId, now) == null) throw new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND", "모닥불을 찾을 수 없어요");
        return room;
    }

    /** 쪽수는 같은 책 방에서만 적고 1~9999다. 각자 읽기 방에서 주면 400 */
    private static Integer page(JsonNode v, String kind) {
        if (!RequestJson.present(v)) return null;
        if (!kind.equals("SAME")) throw new ApiException(HttpStatus.BAD_REQUEST, "PAGE_NOT_ALLOWED", "쪽수는 같은 책 방에서만 적을 수 있어요");
        if (!v.isIntegralNumber() || !v.canConvertToInt() || v.asInt() < 1 || v.asInt() > 9999)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_PAGE", "쪽수는 1~9999예요");
        return v.asInt();
    }

    private RoomMessageResponse view(Record r, long userId) {
        boolean left = r.get("left_room", Boolean.class);
        long author = r.get("user_id", Long.class);
        JsonNode avatar = null;
        if (!left) {
            try {
                avatar = json.readTree(r.get("avatar", String.class));
            } catch (Exception e) {
                avatar = null;
            }
        }
        return new RoomMessageResponse(r.get("id", Long.class), left ? null : author, left ? null : r.get("handle", String.class),
                left ? LEFT_NICKNAME : r.get("nickname", String.class), avatar, r.get("content", String.class), r.get("page", Integer.class),
                Db.instant(r, "created_at"), author == userId, left);
    }

    private static ApiException notParticipant() {
        return new ApiException(HttpStatus.FORBIDDEN, "NOT_PARTICIPANT", "참여 중인 모닥불이 아니에요");
    }
}
