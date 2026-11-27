package kr.readingroom.app.village;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 글자 수·도배 제한·24시간 규칙은 서비스에서 한다. */
@Repository
public class PlazaRepository {
    private static final String COLS = "m.id, m.user_id, u.public_id::text as public_id, u.nickname, u.avatar::text as avatar, m.content, m.created_at ";
    private static final String FROM = "from plaza_message m join app_user u on u.id = m.user_id ";
    private final DSLContext dsl;

    public PlazaRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 광장 접속 명단에 보일 그 사람의 공개 번호·닉네임·캐릭터 */
    public Record member(long userId) {
        return dsl.fetchOne("select public_id::text as public_id, nickname, avatar::text as avatar from app_user where id = ?", userId);
    }

    /** 같은 사람이 동시에 두 번 보내도 도배 제한(3초 3건·같은 글)이 새지 않게, 이 트랜잭션 동안 그 사람의 전송을 한 줄로 세운다. */
    public void lockSender(long userId) {
        dsl.fetch("select pg_advisory_xact_lock(?)", 7_000_000_000L + userId);
    }

    /** since 보다 뒤에 보낸 그 사람의 글 수 (3초 안 3건 제한) */
    public int countSince(long userId, String since) {
        return dsl.fetchOne("select count(*) as n from plaza_message where user_id = ? and created_at > ?::timestamptz", userId, since).get("n", Integer.class);
    }

    /** 그 사람의 직전 글(내용·시각). 없으면 null */
    public Record lastMessage(long userId) {
        return dsl.fetchOne("select content, created_at from plaza_message where user_id = ? order by created_at desc, id desc limit 1", userId);
    }

    public Record insert(long userId, String content, String createdAt) {
        return dsl.fetchOne("with m as (insert into plaza_message(user_id, content, created_at) values (?, ?, ?::timestamptz) returning *) select "
                + COLS + "from m join app_user u on u.id = m.user_id", userId, content, createdAt);
    }

    /** since 이후 글을 오래된 것부터 limit개 */
    public Result<Record> after(String since, int limit) {
        return dsl.fetch("select " + COLS + FROM + "where m.created_at > ?::timestamptz order by m.created_at asc, m.id asc limit ?", since, limit);
    }

    /** floor 이후 가장 최근 limit개를 오래된 순으로 */
    public Result<Record> latest(String floor, int limit) {
        return dsl.fetch("select * from (select " + COLS + FROM + "where m.created_at > ?::timestamptz order by m.created_at desc, m.id desc limit ?) t "
                + "order by created_at asc, id asc", floor, limit);
    }

    public int deleteOlderThan(String cutoff) {
        return dsl.execute("delete from plaza_message where created_at <= ?::timestamptz", cutoff);
    }
}
