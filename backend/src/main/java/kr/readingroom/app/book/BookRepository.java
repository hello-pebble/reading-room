package kr.readingroom.app.book;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 검증·기능 규칙·트랜잭션 경계는 서비스에서 관리한다. */
@Repository
public class BookRepository {
    private final DSLContext dsl;

    public BookRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Record drop(long id) {
        return dsl.fetchOne("update book set status = 'DROPPED' where id = ? returning *", id);
    }

    public Record finish(String finishedAt, Integer rating, String review, int maxPages, long id) {
        return dsl.fetchOne("""
                update book set status = 'DONE', finished_at = ?::timestamptz, rating = ?, one_line_review = ?,
                    current_page = least(current_page, coalesce(total_pages, ?))
                where id = ? returning *""", finishedAt, rating, review, maxPages, id);
    }

    public Record findOwned(long id, long userId) {
        return dsl.fetchOne("select * from book where id = ? and user_id = ?", id, userId);
    }

    public Result<Record> findByStatus(long userId, String status) {
        return dsl.fetch("select * from book where user_id = ? and status = ? order by coalesce(finished_at, started_at, created_at) desc, id desc", userId, status);
    }

    public Result<Record> findAll(long userId) {
        return dsl.fetch("select * from book where user_id = ? order by id desc", userId);
    }

    public int raisePage(int page, int maxPages, long bookId) {
        return dsl.execute("update book set current_page = greatest(current_page, least(?, coalesce(total_pages, ?))) where id = ?", page, maxPages, bookId);
    }

    public Record updateProgress(Integer totalPages, int currentPage, long id) {
        return dsl.fetchOne("update book set total_pages = ?, current_page = ? where id = ? returning *", totalPages, currentPage, id);
    }

    /** 같은 ISBN의 나중에 읽을 책(공유방 가져오기로 만든 것). 없으면 null */
    public Record findLaterByIsbn(long userId, String isbn) {
        return dsl.fetchOne("select id from book where user_id = ? and isbn = ? and status = 'LATER' order by id limit 1", userId, isbn);
    }

    /** 나중에 읽을 책을 소파에 올린다: 읽는 중으로 바꾸고 시작 시각을 기록한다. 쪽수는 새로 받은 값이 있으면 덮는다. 가져온 공유방 기록은 book_id로 그대로 따라온다 */
    public Record promoteLater(long id, Integer totalPages, int currentPage, String startedAt) {
        return dsl.fetchOne("update book set status = 'READING', started_at = ?::timestamptz, total_pages = coalesce(?, total_pages), current_page = ? where id = ? returning *",
                startedAt, totalPages, currentPage, id);
    }

    public Record insert(long userId, String isbn, String title, String author, String coverUrl, Integer totalPages, int currentPage, String startedAt) {
        return dsl.fetchOne("""
                    insert into book(user_id, isbn, title, author, cover_url, total_pages, current_page, status, started_at)
                    values (?, ?, ?, ?, ?, ?, ?, 'READING', ?::timestamptz) returning *""", userId, isbn, title, author, coverUrl, totalPages, currentPage, startedAt);
    }

    public int fillTotalPages(Integer totalPages, long bookId) {
        return dsl.execute("update book set total_pages = ? where id = ? and total_pages is null", totalPages, bookId);
    }

    public Record findReading(long userId) {
        return dsl.fetchOne("select id, current_page from book where user_id = ? and status = 'READING'", userId);
    }

    public Record countFinished(long userId) {
        return dsl.fetchOne("select count(*) from book where user_id = ? and status = 'DONE'", userId);
    }

    public Record countByUser(long userId) {
        return dsl.fetchOne("select count(*) from book where user_id = ?", userId);
    }
}
