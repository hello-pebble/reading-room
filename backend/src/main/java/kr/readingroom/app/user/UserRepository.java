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

    public int updateNickname(String nickname, long userId) {
        return dsl.execute("update app_user set nickname = ?, nickname_chosen_at = coalesce(nickname_chosen_at, now()) where id = ?", nickname, userId);
    }

    public Record insert(String nickname) {
        // 개발용 생성은 닉네임을 이미 정한 것으로 친다 (구글 가입은 AuthRepository.insertUser가 임시 닉네임으로 만든다). 공개 번호는 DB가 채운다.
        return dsl.fetchOne("insert into app_user(nickname, nickname_chosen_at) values (?, now()) returning id, public_id::text as public_id, nickname, avatar::text as avatar, false as needs_nickname", nickname);
    }

    public Record findById(long id) {
        return dsl.fetchOne("select id, public_id::text as public_id, nickname, avatar::text as avatar, nickname_chosen_at is null as needs_nickname from app_user where id = ?", id);
    }
}
