package kr.readingroom.app.room;

import java.time.Instant;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 한도·권한·상태 규칙은 RoomService에서 한다. */
@Repository
public class RoomRepository {
    /** 마을 게시판(BoardRepository)과 같은 열이라 BoardService.view로 응답을 만든다. 마지막 두 `?`는 (나, 방 조건) 순이다. */
    private static final String VIEW = "select r.id, r.kind, r.title, r.isbn, r.visibility, r.open_at, r.close_at, r.closed_at, r.max_participants, r.invite_code, "
            + "r.created_by, u.nickname as owner_nickname, "
            + "(select count(*) from room_participant p where p.room_id = r.id and p.left_at is null) as participants, "
            + "(me.user_id is not null and me.left_at is null) as joined, "
            + "(me.agreed_at is not null) as agreed, "
            + "(me.user_id is not null and me.left_at is null and exists (select 1 from room_message m where m.room_id = r.id and m.user_id <> me.user_id "
            + "and (me.last_read_at is null or m.created_at > me.last_read_at))) as unread, "
            + "(al.user_id is not null) as alarm "
            + "from shared_room r join app_user u on u.id = r.created_by "
            + "left join room_participant me on me.room_id = r.id and me.user_id = ? "
            + "left join room_alarm al on al.room_id = r.id and al.user_id = me.user_id ";
    private final DSLContext dsl;

    public RoomRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 사용자 행을 잠가 같은 사용자의 동시 개설이 한도 검사를 건너뛰지 못하게 한다. */
    public void lockUser(long userId) {
        dsl.fetchOne("select id from app_user where id = ? for update", userId);
    }

    public String nickname(long userId) {
        return dsl.fetchOne("select nickname from app_user where id = ?", userId).get("nickname", String.class);
    }

    public Record findOwnedBook(long bookId, long userId) {
        return dsl.fetchOne("select id, isbn, title from book where id = ? and user_id = ?", bookId, userId);
    }

    /** 끝나지 않은 내 방(예정·열림). 상태는 시각으로 센다: 일찍 끝내지 않았고 종료 시각이 아직 안 지났다. */
    public int countLive(long userId, Instant now) {
        return dsl.fetchOne("select count(*) as n from shared_room where created_by = ? and closed_at is null and close_at > ?::timestamptz",
                userId, now.toString()).get("n", Integer.class);
    }

    /** [from, to) 사이에 개설한 횟수. 취소한 방도 개설 기록에 남아 있어 센다. */
    public int countOpened(long userId, Instant from, Instant to) {
        return dsl.fetchOne("select count(*) as n from room_open_log where user_id = ? and opened_at >= ?::timestamptz and opened_at < ?::timestamptz",
                userId, from.toString(), to.toString()).get("n", Integer.class);
    }

    /** 초대 코드가 겹치면 아무것도 넣지 않고 null을 돌려준다(서비스가 새 코드로 다시 시도). */
    public Long insertRoom(long userId, String kind, String isbn, String title, String visibility, int max, String code, Instant open, Instant close, String status, Instant now) {
        // 지금 바로 열리는 방은 개설자가 이미 알고 있으니 개방 알림 대상이 아니다: 개설 시각으로 미리 표시한다
        String notified = open.isAfter(now) ? null : now.toString();
        Record r = dsl.fetchOne("insert into shared_room(created_by, kind, isbn, title, visibility, max_participants, invite_code, open_at, close_at, status, created_at, open_notified_at) "
                + "values (?, ?, ?, ?, ?, ?, ?, ?::timestamptz, ?::timestamptz, ?, ?::timestamptz, ?::timestamptz) "
                + "on conflict (invite_code) do nothing returning id", userId, kind, isbn, title, visibility, max, code, open.toString(), close.toString(), status, now.toString(), notified);
        return r == null ? null : r.get("id", Long.class);
    }

    /**
     * 개방 시각이 지난 방을 선점(open_notified_at 채움)하고 알릴 대상을 돌려준다. 같은 SQL이라 배치가 겹쳐도 한 방은 한 번만 잡힌다.
     * 알림 대상은 아직 열려 있고(일찍 끝내지 않았고 종료 전) 열린 지 {@code staleBefore} 이후인 방의 알림 켠 사람 + 개설자.
     * 끝났거나 너무 오래된 방은 표시만 하고 대상에서 뺀다. 상태는 끝난 방을 OPEN으로 되돌리지 않게 열려 있는 방만 바꾼다.
     */
    public Result<Record> claimOpened(Instant now, Instant staleBefore) {
        return dsl.fetch("""
                with c as (
                    update shared_room r set open_notified_at = ?::timestamptz,
                        status = case when r.closed_at is null and r.close_at > ?::timestamptz then 'OPEN' else r.status end
                    where r.open_notified_at is null and r.open_at <= ?::timestamptz
                    returning r.id, r.title, r.created_by,
                        (r.closed_at is null and r.close_at > ?::timestamptz and r.open_at > ?::timestamptz) as announce
                )
                select c.id as room_id, c.title, c.created_by as user_id from c where c.announce
                union
                select c.id, c.title, a.user_id from c
                  join room_alarm a on a.room_id = c.id
                  join room_participant p on p.room_id = c.id and p.user_id = a.user_id and p.left_at is null
                where c.announce""", now.toString(), now.toString(), now.toString(), now.toString(), staleBefore.toString());
    }

    /**
     * 끝난 지 보관 기간이 지난 방을 지운다: 일찍 끝낸 방은 closed_at, 아니면 close_at이 {@code endedBefore} 이전(같은 시각 포함)인 방.
     * 글·참여자·알림은 외래키(ON DELETE CASCADE)로 함께 지워진다. 개설 기록(room_open_log)·가져온 기록(book_room_archive)·머문 시간(camp_stay)은 남는다.
     */
    public int deleteEndedBefore(Instant endedBefore) {
        return dsl.execute("delete from shared_room where coalesce(closed_at, close_at) <= ?::timestamptz", endedBefore.toString());
    }

    /** 종료 시각이 지났는데 status가 아직 CLOSED가 아닌 방을 CLOSED로 맞춘다. closed_at은 일찍 끝낸 방만 가지므로 건드리지 않는다. */
    public int markExpiredClosed(Instant now) {
        return dsl.execute("update shared_room set status = 'CLOSED' where status <> 'CLOSED' and closed_at is null and close_at <= ?::timestamptz", now.toString());
    }

    public void insertParticipant(long roomId, long userId, Long bookId, Instant now) {
        dsl.execute("insert into room_participant(room_id, user_id, book_id, joined_at) values (?, ?, ?, ?::timestamptz)", roomId, userId, bookId, now.toString());
    }

    public void insertOpenLog(long userId, long roomId, Instant now) {
        dsl.execute("insert into room_open_log(user_id, room_id, opened_at) values (?, ?, ?::timestamptz)", userId, roomId, now.toString());
    }

    /** 내 기준 방 한 줄(게시판과 같은 모양). 없으면 null */
    public Record view(long roomId, long userId) {
        return dsl.fetchOne(VIEW + "where r.id = ?", userId, roomId);
    }

    /** 초대 미리보기용: 코드로 찾는다. 로그인 전이라 내 참여 정보는 비어 있다. */
    public Record viewByCode(String code) {
        return dsl.fetchOne(VIEW + "where r.invite_code = ?", 0L, code);
    }

    /** 방 행을 잠그지 않고 읽는다(대화처럼 자주 오가는 요청용) */
    public Record find(long roomId) {
        return dsl.fetchOne("select * from shared_room where id = ?", roomId);
    }

    /** 방 행을 잠그고 읽는다 (닫기·입장이 동시에 와도 한 줄씩 처리) */
    public Record lock(long roomId) {
        return dsl.fetchOne("select * from shared_room where id = ? for update", roomId);
    }

    public int delete(long roomId) {
        return dsl.execute("delete from shared_room where id = ?", roomId);
    }

    public void close(long roomId, Instant at) {
        dsl.execute("update shared_room set closed_at = ?::timestamptz, status = 'CLOSED' where id = ?", at.toString(), roomId);
    }

    /** 같은 책 방의 책 제목(미리보기용). 방의 책 정보는 개설자의 책에서 가져온다. */
    public String bookTitle(long roomId) {
        Record r = dsl.fetchOne("select b.title from room_participant p join book b on b.id = p.book_id "
                + "join shared_room s on s.id = p.room_id where p.room_id = ? and p.user_id = s.created_by", roomId);
        return r == null ? null : r.get("title", String.class);
    }

    /** 개방 알림 켜기. 새로 켰으면 true, 이미 켜져 있었으면 false */
    public boolean insertAlarm(long userId, long roomId, Instant now) {
        return dsl.execute("insert into room_alarm(user_id, room_id, created_at) values (?, ?, ?::timestamptz) on conflict (user_id, room_id) do nothing",
                userId, roomId, now.toString()) > 0;
    }

    public int deleteAlarm(long userId, long roomId) {
        return dsl.execute("delete from room_alarm where user_id = ? and room_id = ?", userId, roomId);
    }

    /** 초대 코드로 방 행을 잠그고 읽는다 */
    public Record lockByCode(String code) {
        return dsl.fetchOne("select * from shared_room where invite_code = ? for update", code);
    }

    /** 지금 참여 중인 사람(들어온 순): 공개 번호·닉네임·캐릭터·고른 책 제목·개설자인지·나인지 */
    public org.jooq.Result<Record> activeParticipants(long roomId, long userId) {
        return dsl.fetch("select u.public_id::text as public_id, u.nickname, u.avatar::text as avatar, b.title as book_title, "
                + "(r.created_by = p.user_id) as owner, (p.user_id = ?) as mine "
                + "from room_participant p join app_user u on u.id = p.user_id join shared_room r on r.id = p.room_id "
                + "left join book b on b.id = p.book_id where p.room_id = ? and p.left_at is null order by p.joined_at, p.user_id", userId, roomId);
    }

    /** 나간 참여도 행이 남아 있다(left_at). 없으면 null */
    public Record participant(long roomId, long userId) {
        return dsl.fetchOne("select * from room_participant where room_id = ? and user_id = ?", roomId, userId);
    }

    public int countParticipants(long roomId) {
        return dsl.fetchOne("select count(*) as n from room_participant where room_id = ? and left_at is null", roomId).get("n", Integer.class);
    }

    /** 나갔다 다시 들어온다: 새 참여처럼 동의는 다시 받는다(agreed_at 비움). 읽은 시각은 남긴다. */
    public void rejoin(long roomId, long userId, Long bookId, Instant now) {
        dsl.execute("update room_participant set left_at = null, agreed_at = null, book_id = ?, joined_at = ?::timestamptz where room_id = ? and user_id = ?",
                bookId, now.toString(), roomId, userId);
    }

    public int leave(long roomId, long userId, Instant now) {
        return dsl.execute("update room_participant set left_at = ?::timestamptz where room_id = ? and user_id = ? and left_at is null", now.toString(), roomId, userId);
    }

    /** 처음 동의한 시각을 지키고 돌려준다. 나간 참여자는 건드리지 않아 null */
    public Instant agree(long roomId, long userId, Instant now) {
        Record r = dsl.fetchOne("update room_participant set agreed_at = coalesce(agreed_at, ?::timestamptz) "
                + "where room_id = ? and user_id = ? and left_at is null returning agreed_at", now.toString(), roomId, userId);
        return r == null ? null : kr.readingroom.app.common.Db.instant(r, "agreed_at");
    }
}
