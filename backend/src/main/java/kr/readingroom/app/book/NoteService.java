package kr.readingroom.app.book;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.Db;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoteService {
    private final DSLContext dsl;
    private final BookService books;
    private final Clock clock;

    public NoteService(DSLContext dsl, BookService books, Clock clock) {
        this.dsl = dsl;
        this.books = books;
        this.clock = clock;
    }

    /** 메모·인용구 추가. 쪽이 현재 쪽보다 크면 현재 쪽이 따라 올라가고, 작으면 그대로다 (SF-03). */
    @Transactional
    public Map<String, Object> add(long userId, long bookId, JsonNode b) {
        books.owned(userId, bookId);
        String type = b.hasNonNull("type") && b.get("type").isTextual() ? b.get("type").asText() : "MEMO";
        if (!type.equals("MEMO") && !type.equals("QUOTE"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_TYPE", "type은 MEMO 또는 QUOTE예요");
        String content = b.hasNonNull("content") && b.get("content").isTextual() ? b.get("content").asText().trim() : "";
        if (content.isEmpty() || content.length() > 2000)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_CONTENT", "내용은 1~2000자로 적어 주세요");
        Integer page = null;
        if (b.hasNonNull("page")) {
            if (!b.get("page").isNumber()) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_PAGE", "쪽은 숫자예요");
            page = (int) Math.max(0, Math.min(BookService.MAX_PAGES, Math.round(b.get("page").asDouble())));
        }
        Record n = dsl.fetchOne("insert into book_note(book_id, type, content, page, created_at) values (?, ?, ?, ?, ?::timestamptz) returning *",
                bookId, type, content, page, clock.instant().toString());
        if (page != null) books.raisePage(bookId, page);
        Map<String, Object> out = view(n);
        Map<String, Object> book = books.get(userId, bookId);
        out.put("currentPage", book.get("currentPage"));
        out.put("percent", book.get("percent"));
        return out;
    }

    public List<Map<String, Object>> list(long userId, long bookId) {
        books.owned(userId, bookId);
        List<Map<String, Object>> out = new ArrayList<>();
        dsl.fetch("select * from book_note where book_id = ? order by created_at desc, id desc", bookId).forEach(r -> out.add(view(r)));
        return out;
    }

    private Map<String, Object> view(Record r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.get("id", Long.class));
        m.put("bookId", r.get("book_id", Long.class));
        m.put("type", r.get("type", String.class));
        m.put("content", r.get("content", String.class));
        m.put("page", r.get("page", Integer.class));
        m.put("createdAt", Db.instant(r, "created_at"));
        return m;
    }
}
