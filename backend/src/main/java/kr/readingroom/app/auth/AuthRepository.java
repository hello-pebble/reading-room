package kr.readingroom.app.auth;

import java.time.Instant;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

/** 로그인(auth_identity)과 세션 토큰(auth_session) SQL만 담당한다. 규칙은 AuthService에서 한다. */
@Repository
public class AuthRepository {
    private final DSLContext dsl;

    public AuthRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 같은 구글 계정이 동시에 처음 로그인해도 사용자가 둘 생기지 않게 그 계정 기준으로 줄을 세운다(트랜잭션이 끝나면 풀린다) */
    public void lockIdentity(String provider, String providerUserId) {
        dsl.fetch("select pg_advisory_xact_lock(hashtextextended(?, 0))", provider + ":" + providerUserId);
    }

    public Long findUserByIdentity(String provider, String providerUserId) {
        Record r = dsl.fetchOne("select user_id from auth_identity where provider = ? and provider_user_id = ?", provider, providerUserId);
        return r == null ? null : r.get("user_id", Long.class);
    }

    /** 임시 닉네임으로 사용자를 만든다(nickname_chosen_at은 비운다). 공개 번호(public_id)는 DB가 무작위 UUID로 채운다. */
    public long insertUser(String placeholderNickname) {
        return dsl.fetchOne("insert into app_user(nickname) values (?) returning id", placeholderNickname).get("id", Long.class);
    }

    public void insertIdentity(long userId, String provider, String providerUserId) {
        dsl.execute("insert into auth_identity(user_id, provider, provider_user_id) values (?, ?, ?)", userId, provider, providerUserId);
    }

    public void insertSession(String tokenHash, long userId, Instant now, Instant expiresAt) {
        dsl.execute("insert into auth_session(token_hash, user_id, created_at, expires_at) values (?, ?, ?::timestamptz, ?::timestamptz)",
                tokenHash, userId, now.toString(), expiresAt.toString());
    }

    /** 만료 전 세션의 사용자. 없거나 만료됐으면 null */
    public Long findSessionUser(String tokenHash, Instant now) {
        Record r = dsl.fetchOne("select user_id from auth_session where token_hash = ? and expires_at > ?::timestamptz", tokenHash, now.toString());
        return r == null ? null : r.get("user_id", Long.class);
    }

    public int deleteSession(String tokenHash) {
        return dsl.execute("delete from auth_session where token_hash = ?", tokenHash);
    }

    /** 이전 코드(해시)를 계정에 둔다. 계정마다 하나라서 새로 만들면 바꾼다. 지난 코드도 이때 치운다. */
    public void upsertTransferCode(long userId, String codeHash, Instant now, Instant expiresAt) {
        dsl.execute("delete from transfer_code where expires_at <= ?::timestamptz", now.toString());
        dsl.execute("insert into transfer_code(user_id, code_hash, expires_at, created_at) values (?, ?, ?::timestamptz, ?::timestamptz) "
                + "on conflict (user_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, created_at = excluded.created_at",
                userId, codeHash, expiresAt.toString(), now.toString());
    }

    /** 만료 전 코드를 쓰고(지우고) 그 계정을 돌려준다. 없거나 만료됐으면 null (한 번만 쓸 수 있다) */
    public Long consumeTransferCode(String codeHash, Instant now) {
        Record r = dsl.fetchOne("delete from transfer_code where code_hash = ? and expires_at > ?::timestamptz returning user_id", codeHash, now.toString());
        return r == null ? null : r.get("user_id", Long.class);
    }

    /** 이 기기 키(게스트 식별자)를 그 계정에 잇는다. 이미 다른 계정에 이어져 있으면 그 연결을 이 계정으로 옮긴다. */
    public void pointIdentityTo(long userId, String provider, String providerUserId) {
        dsl.execute("insert into auth_identity(user_id, provider, provider_user_id) values (?, ?, ?) "
                + "on conflict (provider, provider_user_id) do update set user_id = excluded.user_id", userId, provider, providerUserId);
    }

    public int deleteExpired(long userId, Instant now) {
        return dsl.execute("delete from auth_session where user_id = ? and expires_at <= ?::timestamptz", userId, now.toString());
    }
}
