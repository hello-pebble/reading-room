package kr.readingroom.app.village;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.Db;
import kr.readingroom.app.village.dto.RoomResponse;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * 마을 게시판 읽기. 상태는 저장된 값이 아니라 시각으로 계산해서(배치가 늦어도 맞다),
 * 종료된 방은 종료 시각부터 7일 동안만 보여 준다 (결정 #53).
 */
@Service
public class BoardService {
    static final Duration KEEP = Duration.ofDays(7);
    private static final Map<String, Integer> ORDER = Map.of("OPEN", 0, "SCHEDULED", 1, "CLOSED", 2);
    private final BoardRepository rooms;
    private final Clock clock;

    public BoardService(BoardRepository rooms, Clock clock) {
        this.rooms = rooms;
        this.clock = clock;
    }

    public List<RoomResponse> list(long userId, String status) {
        if (status != null && !ORDER.containsKey(status))
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_STATUS", "status는 SCHEDULED, OPEN, CLOSED 중 하나예요");
        Instant now = clock.instant();
        return rooms.findMine(userId).stream()
                .map(r -> view(r, userId, now))
                .filter(v -> v != null && (status == null || v.status().equals(status)))
                .sorted(Comparator.comparing((RoomResponse v) -> ORDER.get(v.status())).thenComparingLong(BoardService::order))
                .toList();
    }

    /** 같은 상태 안의 순서: 열린 방은 최근에 연 것, 예정 방은 곧 열릴 것, 지난 방은 최근에 끝난 것이 먼저 */
    private static long order(RoomResponse v) {
        return switch (v.status()) {
            case "OPEN" -> -v.openAt().toEpochMilli();
            case "SCHEDULED" -> v.openAt().toEpochMilli();
            default -> -v.deleteAt().toEpochMilli();
        };
    }

    /** 상태는 저장값이 아니라 시각으로: closedAt이 있거나 closeAt이 지났으면 CLOSED, openAt 전이면 SCHEDULED, 아니면 OPEN */
    public static String state(Instant open, Instant close, Instant closed, Instant now) {
        if (closed != null || !close.isAfter(now)) return "CLOSED";
        return open.isAfter(now) ? "SCHEDULED" : "OPEN";
    }

    /** 보관 기간이 지난 종료 방이면 null. 공유방 개설·입장 응답(`room` 패키지)도 같은 모양을 쓴다. */
    public static RoomResponse view(Record r, long userId, Instant now) {
        Instant open = Db.instant(r, "open_at"), close = Db.instant(r, "close_at"), closed = Db.instant(r, "closed_at");
        String state = state(open, close, closed, now);
        Instant deleteAt = null;
        if (state.equals("CLOSED")) {
            deleteAt = (closed != null ? closed : close).plus(KEEP);
            if (!deleteAt.isAfter(now)) return null;
        }
        boolean mine = r.get("created_by", Long.class) == userId;
        return new RoomResponse(r.get("id", Long.class), r.get("kind", String.class), r.get("title", String.class), r.get("isbn", String.class),
                state, open, close, closed, deleteAt, r.get("participants", Long.class).intValue(), r.get("max_participants", Integer.class),
                mine, r.get("joined", Boolean.class), r.get("agreed", Boolean.class), r.get("owner_nickname", String.class),
                mine ? r.get("invite_code", String.class) : null);
    }
}
