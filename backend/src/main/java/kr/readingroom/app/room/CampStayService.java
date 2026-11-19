package kr.readingroom.app.room;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.Db;
import kr.readingroom.app.room.dto.LeaveStayResponse;
import kr.readingroom.app.room.dto.StayResponse;
import kr.readingroom.app.village.BoardService;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 모닥불(공유방 장면)에 머문 시간 (결정 #65). 입장·퇴장 시각은 서버가 적는다(클라이언트 시각은 받지 않는다).
 * 퇴장 때 방 종료 시각을 넘지 않게 자르고, 1분 미만은 저장하지 않는다. 스탠드와 겹치는 구간은 합산할 때 한 번만 센다(CalendarService.readingTime).
 * 퇴장을 못 부른 입장(새로고침·강제 종료)은 시간으로 인정하지 않는다: 다시 입장하면 이전 열린 입장은 시간 없이 지운다.
 */
@Service
public class CampStayService {
    static final long MIN_SECONDS = 60;
    private final RoomRepository rooms;
    private final CampStayRepository stays;
    private final Clock clock;

    public CampStayService(RoomRepository rooms, CampStayRepository stays, Clock clock) {
        this.rooms = rooms;
        this.stays = stays;
        this.clock = clock;
    }

    /** 입장: 참여 중이고 보관 동의를 했고 열린 방이어야 한다. 이 사용자의 이전 열린 입장은 시간 없이 지운다. */
    @Transactional
    public StayResponse enter(long userId, long roomId) {
        Instant now = clock.instant();
        Record room = rooms.find(roomId);
        Record view = room == null ? null : rooms.view(roomId, userId);
        if (view == null || BoardService.view(view, userId, now) == null) throw new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND", "모닥불을 찾을 수 없어요");
        Record me = rooms.participant(roomId, userId);
        if (me == null || me.get("left_at") != null) throw new ApiException(HttpStatus.FORBIDDEN, "NOT_PARTICIPANT", "참여 중인 모닥불이 아니에요");
        if (me.get("agreed_at") == null) throw new ApiException(HttpStatus.FORBIDDEN, "AGREE_REQUIRED", "보관 동의를 한 뒤에 들어갈 수 있어요");
        String state = BoardService.state(Db.instant(room, "open_at"), Db.instant(room, "close_at"), Db.instant(room, "closed_at"), now);
        if (state.equals("SCHEDULED")) throw new ApiException(HttpStatus.CONFLICT, "ROOM_NOT_OPEN", "아직 열리지 않은 모닥불이에요");
        if (state.equals("CLOSED")) throw new ApiException(HttpStatus.GONE, "ROOM_CLOSED", "이미 끝난 모닥불이에요");
        stays.lockUser(userId);
        stays.deleteOpen(userId);
        return new StayResponse(roomId, Db.instant(stays.insertOpen(userId, roomId, now), "entered_at"));
    }

    /** 퇴장: 이 방의 열린 입장을 닫는다. 방 종료 시각(일찍 끝냈으면 그 시각)까지만 센다. 1분 미만이면 기록하지 않는다. */
    @Transactional
    public LeaveStayResponse leave(long userId, long roomId) {
        Instant now = clock.instant();
        stays.lockUser(userId);
        Record stay = stays.findOpen(userId, roomId);
        if (stay == null) throw new ApiException(HttpStatus.NOT_FOUND, "NO_OPEN_STAY", "들어가 있는 모닥불이 아니에요");
        long id = stay.get("id", Long.class);
        Instant entered = Db.instant(stay, "entered_at");
        Record room = rooms.find(roomId);
        Instant end = room == null ? entered : (Db.instant(room, "closed_at") != null ? Db.instant(room, "closed_at") : Db.instant(room, "close_at"));
        Instant left = now.isBefore(end) ? now : end;
        if (left.isBefore(entered)) left = entered;
        long seconds = Duration.between(entered, left).toSeconds();
        if (seconds < MIN_SECONDS) {
            stays.delete(id);
            return new LeaveStayResponse(roomId, entered, left, 0, false);
        }
        stays.close(id, left);
        return new LeaveStayResponse(roomId, entered, left, seconds / 60, true);
    }
}
