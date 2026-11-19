package kr.readingroom.app.room;

import java.time.Instant;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 종료·동의·익명화·책 고르기 규칙은 RoomArchiveService에서 한다. */
@Repository
public class RoomArchiveRepository {
    private static final String COLS = "a.id, a.book_id, b.status as book_status, a.room_id, a.room_title, a.snapshot::text as snapshot, a.opened_at, a.closed_at, a.imported_at ";
    private final DSLContext dsl;

    public RoomArchiveRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 방의 모든 글을 오래된 순으로 (삭제 기능이 없어 전부 가져온다) */
    public Result<Record> messages(long roomId) {
        return dsl.fetch("select user_id, content, page, created_at from room_message where room_id = ? order by id", roomId);
    }

    /** 입장할 때 고른 책(내 참여 행). 없으면 null 값 */
    public Long participantBookId(long roomId, long userId) {
        Record r = dsl.fetchOne("select book_id from room_participant where room_id = ? and user_id = ?", roomId, userId);
        return r == null ? null : r.get("book_id", Long.class);
    }

    /** 방을 연 사람이 고른 책의 정보(같은 책 방에서 내 책에 없을 때 나중에 읽을 책을 만드는 재료) */
    public Record ownerBook(long roomId) {
        return dsl.fetchOne("select b.isbn, b.title, b.author, b.cover_url, b.total_pages from shared_room s "
                + "join room_participant p on p.room_id = s.id and p.user_id = s.created_by join book b on b.id = p.book_id where s.id = ?", roomId);
    }

    /** 내 책 중 같은 ISBN. 읽는 중·완독·포기를 나중에 읽을 책보다 먼저 쓴다 */
    public Record myBookByIsbn(long userId, String isbn) {
        return dsl.fetchOne("select id, isbn, status from book where user_id = ? and isbn = ? "
                + "order by (status = 'LATER'), coalesce(finished_at, started_at, created_at) desc, id desc limit 1", userId, isbn);
    }

    public Record ownedBook(long bookId, long userId) {
        return dsl.fetchOne("select id, isbn, status from book where id = ? and user_id = ?", bookId, userId);
    }

    /** 나중에 읽을 책을 만든다: 완독 수·달력에 세지 않고, 소파에 올리면 읽는 중으로 바뀐다 */
    public Record insertLaterBook(long userId, String isbn, String title, String author, String coverUrl, Integer totalPages) {
        return dsl.fetchOne("insert into book(user_id, isbn, title, author, cover_url, total_pages, current_page, status) values (?, ?, ?, ?, ?, ?, 0, 'LATER') "
                + "returning id, isbn, status", userId, isbn, title, author, coverUrl, totalPages);
    }

    public Record findByUserRoom(long userId, long roomId) {
        return dsl.fetchOne("select " + COLS + "from book_room_archive a join book b on b.id = a.book_id where a.user_id = ? and a.room_id = ?", userId, roomId);
    }

    public long insert(long userId, long bookId, long roomId, String title, Instant opened, Instant closed, String snapshot, Instant now) {
        return dsl.fetchOne("insert into book_room_archive(user_id, book_id, room_id, room_title, opened_at, closed_at, snapshot, imported_at) "
                + "values (?, ?, ?, ?, ?::timestamptz, ?::timestamptz, ?::jsonb, ?::timestamptz) returning id",
                userId, bookId, roomId, title, opened.toString(), closed.toString(), snapshot, now.toString()).get("id", Long.class);
    }

    public Record findById(long id) {
        return dsl.fetchOne("select " + COLS + "from book_room_archive a join book b on b.id = a.book_id where a.id = ?", id);
    }

    /** 책의 공유방 탭: 최근에 가져온 것부터 */
    public Result<Record> listByBook(long bookId) {
        return dsl.fetch("select " + COLS + "from book_room_archive a join book b on b.id = a.book_id where a.book_id = ? order by a.imported_at desc, a.id desc", bookId);
    }
}
