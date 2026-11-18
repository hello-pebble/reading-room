package kr.readingroom.app.common;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 검증·기능 규칙·트랜잭션 경계는 서비스에서 관리한다. */
@Repository
public class IdempotencyRepository {
    private final DSLContext dsl;

    public IdempotencyRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public int insert(long userId, String key, String path, int status, String body) {
        return dsl.execute("insert into idempotency_key(user_id, key, path, status, body) values (?, ?, ?, ?, ?::jsonb)", userId, key, path, status, body);
    }

    public Record find(long userId, String key) {
        return dsl.fetchOne("select path, status, body::text as body from idempotency_key where user_id = ? and key = ?", userId, key);
    }

    public Result<Record> lock(String lockKey) {
        return dsl.fetch("select pg_advisory_xact_lock(hashtextextended(?, 0))", lockKey);
    }
}
