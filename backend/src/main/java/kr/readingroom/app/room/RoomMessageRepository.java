package kr.readingroom.app.room;

import java.time.Instant;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 참여·동의·상태·글자 수·5초 제한은 RoomMessageService에서 한다. */
@Repository
public class RoomMessageRepository {
    /** 글쓴이가 지금도 참여 중인지(left)는 참여 행으로 안다. 나간 뒤 다시 들어왔으면 left가 false라 글이 다시 이름으로 보인다. */
    private static final String COLS = "m.id, m.user_id, u.handle, u.nickname, u.avatar::text as avatar, m.content, m.page, m.created_at, "
            + "(p.left_at is not null) as left_room ";
    private static final String FROM = "from room_message m join app_user u on u.id = m.user_id "
            + "left join room_participant p on p.room_id = m.room_id and p.user_id = m.user_id ";
    private final DSLContext dsl;

    public RoomMessageRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 같은 사람이 동시에 두 번 보내도 5초 제한이 새지 않게, 이 트랜잭션 동안 그 사람의 전송을 한 줄로 세운다(광장과는 다른 잠금). */
    public void lockSender(long userId) {
        dsl.fetch("select pg_advisory_xact_lock(?)", 8_000_000_000L + userId);
    }

    /** 방과 상관없이 그 사람의 마지막 글 시각. 없으면 null 값 */
    public Instant lastSentAt(long userId) {
        return kr.readingroom.app.common.Db.instant(dsl.fetchOne("select max(created_at) as at from room_message where user_id = ?", userId), "at");
    }

    public Record insert(long roomId, long userId, String content, Integer page, Instant now) {
        return dsl.fetchOne("with m as (insert into room_message(room_id, user_id, content, page, created_at) values (?, ?, ?, ?, ?::timestamptz) returning *) select "
                + COLS + "from m join app_user u on u.id = m.user_id "
                + "left join room_participant p on p.room_id = m.room_id and p.user_id = m.user_id", roomId, userId, content, page, now.toString());
    }

    /** afterId 다음 글을 오래된 순으로 limit개 */
    public Result<Record> after(long roomId, long afterId, int limit) {
        return dsl.fetch("select " + COLS + FROM + "where m.room_id = ? and m.id > ? order by m.id asc limit ?", roomId, afterId, limit);
    }

    /** 가장 최근 limit개를 오래된 순으로 */
    public Result<Record> latest(long roomId, int limit) {
        return dsl.fetch("select * from (select " + COLS + FROM + "where m.room_id = ? order by m.id desc limit ?) t order by id asc", roomId, limit);
    }

    /** 처음 읽은 시각보다 뒤로 가지 않게 하고 저장한 값을 돌려준다. 나간 참여자는 건드리지 않아 null */
    public Instant markRead(long roomId, long userId, Instant now) {
        Record r = dsl.fetchOne("update room_participant set last_read_at = greatest(coalesce(last_read_at, ?::timestamptz), ?::timestamptz) "
                + "where room_id = ? and user_id = ? and left_at is null returning last_read_at", now.toString(), now.toString(), roomId, userId);
        return r == null ? null : kr.readingroom.app.common.Db.instant(r, "last_read_at");
    }
}
