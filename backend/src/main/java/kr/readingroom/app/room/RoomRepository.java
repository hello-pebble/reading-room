package kr.readingroom.app.room;

import java.time.Instant;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 한도·권한·상태 규칙은 RoomService에서 한다. */
@Repository
public class RoomRepository {
    /** 마을 게시판(BoardRepository)과 같은 열이라 BoardService.view로 응답을 만든다. 마지막 두 `?`는 (나, 방 조건) 순이다. */
    private static final String VIEW = "select r.id, r.kind, r.title, r.isbn, r.open_at, r.close_at, r.closed_at, r.max_participants, r.invite_code, "
            + "r.created_by, u.nickname as owner_nickname, "
            + "(select count(*) from room_participant p where p.room_id = r.id and p.left_at is null) as participants, "
            + "(me.user_id is not null and me.left_at is null) as joined, "
            + "(me.agreed_at is not null) as agreed "
            + "from shared_room r join app_user u on u.id = r.created_by "
            + "left join room_participant me on me.room_id = r.id and me.user_id = ? ";
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
    public Long insertRoom(long userId, String kind, String isbn, String title, int max, String code, Instant open, Instant close, String status, Instant now) {
        Record r = dsl.fetchOne("insert into shared_room(created_by, kind, isbn, title, visibility, max_participants, invite_code, open_at, close_at, status, created_at) "
                + "values (?, ?, ?, ?, 'INVITE', ?, ?, ?::timestamptz, ?::timestamptz, ?, ?::timestamptz) "
                + "on conflict (invite_code) do nothing returning id", userId, kind, isbn, title, max, code, open.toString(), close.toString(), status, now.toString());
        return r == null ? null : r.get("id", Long.class);
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
}
