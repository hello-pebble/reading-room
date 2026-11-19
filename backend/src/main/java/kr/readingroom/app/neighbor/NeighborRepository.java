package kr.readingroom.app.neighbor;

import java.time.Instant;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 책 자격·집 주인 확인 같은 규칙은 NeighborService에서 한다. */
@Repository
public class NeighborRepository {
    private static final String COLS = "r.id, r.to_user, r.from_user, u.nickname as from_nickname, r.isbn, r.title, r.author, r.cover_url, r.created_at, r.confirmed_at ";
    private final DSLContext dsl;

    public NeighborRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 핸들로 집 주인을 찾는다 */
    public Record findHouse(String handle) {
        return dsl.fetchOne("select id, handle, nickname from app_user where handle = ? and status = 'ACTIVE'", handle);
    }

    /** 내 책(소유 확인)의 추천에 복사할 정보와 상태 */
    public Record findOwnedBook(long bookId, long userId) {
        return dsl.fetchOne("select isbn, title, author, cover_url, status from book where id = ? and user_id = ?", bookId, userId);
    }

    /** 집마다 미확인 추천은 한 권(부분 유니크 인덱스). 이미 차 있으면 아무것도 넣지 않고 null. 넣었으면 id */
    public Long insert(long toUser, long fromUser, String isbn, String title, String author, String coverUrl, Instant now) {
        Record r = dsl.fetchOne("insert into neighbor_recommendation(to_user, from_user, isbn, title, author, cover_url, created_at) "
                + "values (?, ?, ?, ?, ?, ?, ?::timestamptz) on conflict (to_user) where confirmed_at is null do nothing returning id",
                toUser, fromUser, isbn, title, author, coverUrl, now.toString());
        return r == null ? null : r.get("id", Long.class);
    }

    /** 그 집의 확인 전 추천. 없으면 null */
    public Record findOpen(long toUser) {
        return dsl.fetchOne("select " + COLS + "from neighbor_recommendation r join app_user u on u.id = r.from_user where r.to_user = ? and r.confirmed_at is null", toUser);
    }

    /** 집 주인이 확인: 행은 남기고 confirmed_at만 기록한다. 확인할 추천이 없으면 0 */
    public int confirm(long toUser, Instant now) {
        return dsl.execute("update neighbor_recommendation set confirmed_at = ?::timestamptz where to_user = ? and confirmed_at is null", now.toString(), toUser);
    }
}
