package kr.readingroom.app.room;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.jooq.Record;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공유방 개방·종료 배치 (1분). 방이 열릴 때 알림을 켠 사람과 개설자를 한 번만 골라내고, status 열을 시각에 맞춘다.
 * 대상은 먼저 DB에서 "알렸음"(open_notified_at)으로 표시(claim)한 방만 돌려줘서, 배치가 겹치거나 다시 돌아도 같은 알림이 두 번 나가지 않는다.
 * 화면·API는 시각으로 상태를 계산하므로 이 배치가 늦거나 멈춰도 동작은 맞다(status는 보조값).
 */
@Service
public class RoomOpenService {
    /** 열린 지 이만큼 지난 방은 알리지 않는다 (서버가 꺼져 있다 켜졌을 때 옛 알림이 쏟아지는 것을 막는다) */
    static final Duration FRESH = Duration.ofMinutes(30);

    private final RoomRepository rooms;
    private final Clock clock;

    public RoomOpenService(RoomRepository rooms, Clock clock) {
        this.rooms = rooms;
        this.clock = clock;
    }

    /** 개방 알림 대상 한 명: 어느 방이 열렸는지(방 이름 포함)와 받을 사용자. */
    public record OpenTarget(long roomId, String title, long userId) {}

    /**
     * 1분 배치가 부른다. 개방 방을 선점하고 상태를 맞춘 뒤 알릴 대상을 돌려준다.
     * 실제 전송은 PushSender 일반화(다음 단계)에서 붙인다 — 지금은 대상 목록만 만든다.
     */
    @Transactional
    public List<OpenTarget> dispatchDue() {
        Instant now = clock.instant();
        List<OpenTarget> out = new ArrayList<>();
        for (Record r : rooms.claimOpened(now, now.minus(FRESH)))
            out.add(new OpenTarget(r.get("room_id", Long.class), r.get("title", String.class), r.get("user_id", Long.class)));
        rooms.markExpiredClosed(now);
        return out;
    }
}
