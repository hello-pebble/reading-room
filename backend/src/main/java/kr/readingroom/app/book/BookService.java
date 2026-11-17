package kr.readingroom.app.book;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class BookService {
    public static final int MAX_PAGES = 9999;
    private final DSLContext dsl;
    private final Clock clock;

    public BookService(DSLContext dsl, Clock clock) {
        this.dsl = dsl;
        this.clock = clock;
    }

    /** 전체 쪽수: 비우거나 1~9999. 0·음수는 비운 것으로 보고 9999를 넘으면 9999로 맞춘다 (프로토타입과 같다). */
    public static Integer normTotal(JsonNode n) {
        if (n == null || n.isNull() || !n.isNumber()) return null;
        long v = Math.round(n.asDouble());
        return v < 1 ? null : (int) Math.min(MAX_PAGES, v);
    }

    public static int percent(int current, Integer total) {
        return Math.min(100, Math.max(0, (int) Math.round(current * 100.0 / total)));
    }

    public Map<String, Object> create(long userId, JsonNode b) {
        String title = text(b, "title");
        if (title == null || title.isBlank() || title.length() > 200)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_TITLE", "제목은 1~200자로 적어 주세요");
        Integer total = normTotal(b.get("totalPages"));
        int cur = b.hasNonNull("currentPage") && b.get("currentPage").isNumber() ? (int) Math.max(0, Math.min(MAX_PAGES, b.get("currentPage").asLong())) : 0;
        try {
            Record r = dsl.fetchOne("""
                    insert into book(user_id, isbn, title, author, cover_url, total_pages, current_page, status, started_at)
                    values (?, ?, ?, ?, ?, ?, ?, 'READING', ?::timestamptz) returning *""",
                    userId, text(b, "isbn"), title.trim(), text(b, "author"), text(b, "coverUrl"), total, cur, clock.instant().toString());
            return view(r);
        } catch (DuplicateKeyException e) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_READING", "소파에 이미 읽는 책이 있어요. 먼저 완독하거나 포기해 주세요");
        }
    }

    public Map<String, Object> patch(long userId, long id, JsonNode b) {
        Record cur = owned(userId, id);
        Integer total = cur.get("total_pages", Integer.class);
        if (b.has("totalPages")) total = normTotal(b.get("totalPages"));
        int page = cur.get("current_page", Integer.class);
        if (b.hasNonNull("currentPage")) {
            if (!b.get("currentPage").isNumber()) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_PAGE", "쪽수는 숫자예요");
            long want = Math.min(MAX_PAGES, b.get("currentPage").asLong());
            page = (int) Math.max(page, want); // 현재 쪽은 줄지 않는다
        }
        Record r = dsl.fetchOne("update book set total_pages = ?, current_page = ? where id = ? returning *", total, page, id);
        return view(r);
    }

    public List<Map<String, Object>> list(long userId, String status) {
        if (status != null && !List.of("READING", "DONE", "DROPPED", "LATER").contains(status))
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_STATUS", "status는 READING/DONE/DROPPED/LATER 중 하나예요");
        List<Map<String, Object>> out = new ArrayList<>();
        var rs = status == null
                ? dsl.fetch("select * from book where user_id = ? order by id desc", userId)
                : dsl.fetch("select * from book where user_id = ? and status = ? order by coalesce(finished_at, started_at, created_at) desc, id desc", userId, status);
        rs.forEach(r -> out.add(view(r)));
        return out;
    }

    public Map<String, Object> get(long userId, long id) {
        return view(owned(userId, id));
    }

    /** 남의 책이나 없는 책은 404. */
    public Record owned(long userId, long id) {
        Record r = dsl.fetchOne("select * from book where id = ? and user_id = ?", id, userId);
        if (r == null) throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "책을 찾을 수 없어요");
        return r;
    }

    public Map<String, Object> view(Record r) {
        Map<String, Object> m = new LinkedHashMap<>();
        Integer total = r.get("total_pages", Integer.class);
        int cur = r.get("current_page", Integer.class);
        m.put("id", r.get("id", Long.class));
        m.put("isbn", r.get("isbn", String.class));
        m.put("title", r.get("title", String.class));
        m.put("author", r.get("author", String.class));
        m.put("coverUrl", r.get("cover_url", String.class));
        m.put("totalPages", total);
        m.put("currentPage", cur);
        m.put("percent", total == null ? null : percent(cur, total));
        m.put("status", r.get("status", String.class));
        m.put("rating", r.get("rating", Short.class));
        m.put("oneLineReview", r.get("one_line_review", String.class));
        m.put("startedAt", r.get("started_at", OffsetDateTime.class));
        m.put("finishedAt", r.get("finished_at", OffsetDateTime.class));
        return m;
    }

    private static String text(JsonNode b, String k) {
        return b.hasNonNull(k) && b.get(k).isTextual() ? b.get(k).asText().trim() : null;
    }
}
