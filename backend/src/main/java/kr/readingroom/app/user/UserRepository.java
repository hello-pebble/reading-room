package kr.readingroom.app.user;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 검증·기능 규칙·트랜잭션 경계는 서비스에서 관리한다. */
@Repository
public class UserRepository {
    private final DSLContext dsl;

    public UserRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Record lock(long userId) {
        return dsl.fetchOne("select id from app_user where id = ? for update", userId);
    }

    public int updateAvatar(String avatar, long userId) {
        return dsl.execute("update app_user set avatar = ?::jsonb where id = ?", avatar, userId);
    }

    public Record insert(String handle, String nickname) {
        return dsl.fetchOne("insert into app_user(handle, nickname) values (?, ?) returning id, handle, nickname, avatar::text as avatar", handle, nickname);
    }

    public Record countByHandle(String handle) {
        return dsl.fetchOne("select count(*) from app_user where handle = ?", handle);
    }

    public Record findById(long id) {
        return dsl.fetchOne("select id, handle, nickname, avatar::text as avatar from app_user where id = ?", id);
    }
}
