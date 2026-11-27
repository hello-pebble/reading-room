package kr.readingroom.app.village;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 상태 계산·7일 보관 같은 규칙은 서비스에서 한다. */
@Repository
public class BoardRepository {
    private final DSLContext dsl;

    public BoardRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 마을 게시판의 방: 내가 만들었거나 참여 중(나가지 않은)인 방 + 아직 끝나지 않은 다른 사람의 방(결정 #97, 들어가려면 초대 코드). 참여 인원은 나가지 않은 사람만 센다. */
    public Result<Record> findVisible(long userId, String now) {
        return dsl.fetch("select r.id, r.kind, r.title, r.isbn, r.visibility, r.open_at, r.close_at, r.closed_at, r.max_participants, r.invite_code, "
                + "r.created_by, u.nickname as owner_nickname, "
                + "(select count(*) from room_participant p where p.room_id = r.id and p.left_at is null) as participants, "
                + "(me.user_id is not null and me.left_at is null) as joined, "
                + "(me.agreed_at is not null) as agreed, "
                + "(me.user_id is not null and me.left_at is null and exists (select 1 from room_message m where m.room_id = r.id and m.user_id <> me.user_id "
                + "and (me.last_read_at is null or m.created_at > me.last_read_at))) as unread, "
                + "(al.user_id is not null) as alarm "
                + "from shared_room r join app_user u on u.id = r.created_by "
                + "left join room_participant me on me.room_id = r.id and me.user_id = ? "
                + "left join room_alarm al on al.room_id = r.id and al.user_id = me.user_id "
                + "where r.created_by = ? or (me.user_id is not null and me.left_at is null) "
                + "or (r.closed_at is null and r.close_at > ?::timestamptz) "
                + "order by r.open_at desc, r.id desc", userId, userId, now);
    }
}
