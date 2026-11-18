package kr.readingroom.app.book;

import kr.readingroom.app.book.dto.*;
import com.fasterxml.jackson.databind.JsonNode;
import kr.readingroom.app.common.RequestJson;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.Db;
import org.jooq.Record;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class BookService {
    public static final int MAX_PAGES = 9999;
    private final BookRepository bookRepository;
    private final Clock clock;

    public BookService(BookRepository bookRepository, Clock clock) {
        this.bookRepository = bookRepository;
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

    public BookResponse create(long userId, CreateBookRequest b) {
        String title = b.title();
        if (title == null || title.isBlank() || title.length() > 200)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_TITLE", "제목은 1~200자로 적어 주세요");
        Integer total = normTotal(b.totalPages());
        int cur = RequestJson.present(b.currentPage()) && b.currentPage().isNumber() ? (int) Math.max(0, Math.min(MAX_PAGES, b.currentPage().asLong())) : 0;
        try {
            Record r = bookRepository.insert(userId, b.isbn(), title.trim(), b.author(), b.coverUrl(), total, cur, clock.instant().toString());
            return view(r);
        } catch (DuplicateKeyException e) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_READING", "소파에 이미 읽는 책이 있어요. 먼저 완독하거나 포기해 주세요");
        }
    }

    public BookResponse patch(long userId, long id, PatchBookRequest b) {
        Record cur = owned(userId, id);
        Integer total = cur.get("total_pages", Integer.class);
        if ((b.totalPages() != null)) total = normTotal(b.totalPages());
        int page = cur.get("current_page", Integer.class);
        if (RequestJson.present(b.currentPage())) {
            if (!b.currentPage().isNumber()) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_PAGE", "쪽수는 숫자예요");
            long want = Math.min(MAX_PAGES, b.currentPage().asLong());
            page = (int) Math.max(page, want); // 현재 쪽은 줄지 않는다
        }
        Record r = bookRepository.updateProgress(total, page, id);
        return view(r);
    }

    /**
     * 현재 쪽을 올린다. 줄이지 않고, 전체 쪽수가 있으면 그 이상으로는 올리지 않는다.
     * (메모·스탠드 끄기·직접 기록·완독이 같은 규칙을 쓴다)
     */
    public void raisePage(long bookId, int page) {
        bookRepository.raisePage(Math.max(0, Math.min(MAX_PAGES, page)), MAX_PAGES, bookId);
    }

    public List<BookResponse> list(long userId, String status) {
        if (status != null && !List.of("READING", "DONE", "DROPPED", "LATER").contains(status))
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_STATUS", "status는 READING/DONE/DROPPED/LATER 중 하나예요");
        List<BookResponse> out = new ArrayList<>();
        var rs = status == null
                ? bookRepository.findAll(userId)
                : bookRepository.findByStatus(userId, status);
        rs.forEach(r -> out.add(view(r)));
        return out;
    }

    public BookResponse get(long userId, long id) {
        return view(owned(userId, id));
    }

    /** 남의 책이나 없는 책은 404. */
    public Record owned(long userId, long id) {
        Record r = bookRepository.findOwned(id, userId);
        if (r == null) throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "책을 찾을 수 없어요");
        return r;
    }

    public BookResponse view(Record r) {
        Integer total = r.get("total_pages", Integer.class);
        int page = r.get("current_page", Integer.class);
        return new BookResponse(r.get("id", Long.class), r.get("isbn", String.class), r.get("title", String.class),
                r.get("author", String.class), r.get("cover_url", String.class), total, page, total == null ? null : percent(page, total),
                r.get("status", String.class), r.get("rating", Short.class), r.get("one_line_review", String.class),
                Db.instant(r, "started_at"), Db.instant(r, "finished_at"));
    }

}
