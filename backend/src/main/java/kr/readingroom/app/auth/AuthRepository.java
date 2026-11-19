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

    /** 핸들이 겹치면 아무것도 넣지 않고 null (서비스가 새 핸들로 다시 시도). 닉네임은 임시이고 nickname_chosen_at은 비운다. */
    public Long insertUser(String handle, String placeholderNickname) {
        Record r = dsl.fetchOne("insert into app_user(handle, nickname) values (?, ?) on conflict (handle) do nothing returning id", handle, placeholderNickname);
        return r == null ? null : r.get("id", Long.class);
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

    public int deleteExpired(long userId, Instant now) {
        return dsl.execute("delete from auth_session where user_id = ? and expires_at <= ?::timestamptz", userId, now.toString());
    }
}
