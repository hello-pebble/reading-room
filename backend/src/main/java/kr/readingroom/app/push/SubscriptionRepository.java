package kr.readingroom.app.push;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 검증·기능 규칙·트랜잭션 경계는 서비스에서 관리한다. */
@Repository
public class SubscriptionRepository {
    private final DSLContext dsl;

    public SubscriptionRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public int deleteById(long id) {
        return dsl.execute("delete from push_subscription where id = ?", id);
    }

    public Result<Record> findByUser(long userId) {
        return dsl.fetch("select id, user_id, endpoint, p256dh, auth from push_subscription where user_id = ? order by id", userId);
    }

    public int deleteOwned(long userId, String endpoint) {
        return dsl.execute("delete from push_subscription where user_id = ? and endpoint = ?", userId, endpoint);
    }

    public Record upsert(long userId, String endpoint, String p256dh, String auth, String userAgent) {
        return dsl.fetchOne("""
                insert into push_subscription(user_id, endpoint, p256dh, auth, user_agent) values (?, ?, ?, ?, ?)
                on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent
                returning id, endpoint""", userId, endpoint, p256dh, auth, userAgent);
    }
}
