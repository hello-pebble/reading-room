package kr.readingroom.app.room;

import java.time.Clock;
import kr.readingroom.app.village.BoardService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 끝난 지 7일이 지난 공유방을 지운다 (DATA_API 배치 작업, 매일 새벽). 보관 기간은 마을 게시판에서 방이 사라지는 시각과 같은 값(BoardService.KEEP)이다.
 * 가져오기는 이 기간 안에만 할 수 있고, 가져온 기록(book_room_archive)·개설 기록(room_open_log)·머문 시간(camp_stay)은 방과 상관없이 남는다.
 */
@Service
public class RoomPurgeService {
    private final RoomRepository rooms;
    private final Clock clock;

    public RoomPurgeService(RoomRepository rooms, Clock clock) {
        this.rooms = rooms;
        this.clock = clock;
    }

    /** 지운 방 수를 돌려준다. 여러 번 돌려도 같은 결과다. */
    @Transactional
    public int purgeExpired() {
        return rooms.deleteEndedBefore(clock.instant().minus(BoardService.KEEP));
    }
}
