package kr.readingroom.app.book;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 검증·기능 규칙·트랜잭션 경계는 서비스에서 관리한다. */
@Repository
public class NoteRepository {
    private final DSLContext dsl;

    public NoteRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Result<Record> findByBook(long bookId) {
        return dsl.fetch("select * from book_note where book_id = ? order by created_at desc, id desc", bookId);
    }

    public Record insert(long bookId, String type, String content, Integer page, String createdAt) {
        return dsl.fetchOne("insert into book_note(book_id, type, content, page, created_at) values (?, ?, ?, ?, ?::timestamptz) returning *", bookId, type, content, page, createdAt);
    }

    public int insertMemo(long bookId, String memo, String createdAt) {
        return dsl.execute("insert into book_note(book_id, type, content, page, created_at) values (?, 'MEMO', ?, null, ?::timestamptz)", bookId, memo, createdAt);
    }
}
