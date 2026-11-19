package kr.readingroom.app.room;

import java.time.Instant;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

/** 모닥불 머문 시간(camp_stay) SQL만 담당한다. 규칙은 CampStayService에서 한다. */
@Repository
public class CampStayRepository {
    private final DSLContext dsl;

    public CampStayRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 사용자 행을 잠가 같은 사람의 입장·퇴장 요청이 동시에 와도 한 줄씩 처리한다 (열린 입장은 사용자당 하나) */
    public void lockUser(long userId) {
        dsl.fetch("select id from app_user where id = ? for update", userId);
    }

    /** 이 사용자의 열린 입장을 시간 없이 지운다 (새로고침·다른 방으로 이동) */
    public int deleteOpen(long userId) {
        return dsl.execute("delete from camp_stay where user_id = ? and left_at is null", userId);
    }

    public Record insertOpen(long userId, long roomId, Instant now) {
        return dsl.fetchOne("insert into camp_stay(user_id, room_id, entered_at) values (?, ?, ?::timestamptz) returning *", userId, roomId, now.toString());
    }

    public Record findOpen(long userId, long roomId) {
        return dsl.fetchOne("select * from camp_stay where user_id = ? and room_id = ? and left_at is null for update", userId, roomId);
    }

    public void close(long id, Instant leftAt) {
        dsl.execute("update camp_stay set left_at = ?::timestamptz where id = ?", leftAt.toString(), id);
    }

    public void delete(long id) {
        dsl.execute("delete from camp_stay where id = ?", id);
    }
}
