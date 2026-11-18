package kr.readingroom.app.book;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.session.SessionService;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 완독·포기: 소파를 비우면서 켜진 스탠드도 같이 끈다. */
@Service
public class BookEndService {
    private final DSLContext dsl;
    private final Clock clock;
    private final BookService books;
    private final SessionService sessions;

    public BookEndService(DSLContext dsl, Clock clock, BookService books, SessionService sessions) {
        this.dsl = dsl;
        this.clock = clock;
        this.books = books;
        this.sessions = sessions;
    }

    @Transactional
    public Map<String, Object> finish(long userId, long id, JsonNode b) {
        Record book = books.owned(userId, id);
        String st = book.get("status", String.class);
        if (st.equals("DONE")) return books.view(book);   // 다시 보내도 같은 결과
        if (!st.equals("READING")) throw new ApiException(HttpStatus.CONFLICT, "NOT_READING", "소파에 올려 둔 책만 완독할 수 있어요");
        Integer rating = null;
        if (b != null && b.hasNonNull("rating")) {
            if (!b.get("rating").isInt() || b.get("rating").asInt() < 0 || b.get("rating").asInt() > 5)
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_RATING", "별점은 1~5예요");
            rating = b.get("rating").asInt() == 0 ? null : b.get("rating").asInt();   // 0은 별점 해제
        }
        String review = b != null && b.hasNonNull("oneLineReview") && b.get("oneLineReview").isTextual() ? b.get("oneLineReview").asText().trim() : null;
        if (review != null && review.length() > 500) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REVIEW", "한줄평은 500자까지예요");
        if (review != null && review.isEmpty()) review = null;
        endSession(userId);
        Record r = dsl.fetchOne("""
                update book set status = 'DONE', finished_at = ?::timestamptz, rating = ?, one_line_review = ?,
                    current_page = least(current_page, coalesce(total_pages, ?))
                where id = ? returning *""", clock.instant().toString(), rating, review, BookService.MAX_PAGES, id);
        return books.view(r);
    }

    @Transactional
    public Map<String, Object> drop(long userId, long id) {
        Record book = books.owned(userId, id);
        String st = book.get("status", String.class);
        if (st.equals("DROPPED")) return books.view(book);
        if (!st.equals("READING")) throw new ApiException(HttpStatus.CONFLICT, "NOT_READING", "소파에 올려 둔 책만 포기할 수 있어요");
        endSession(userId);
        return books.view(dsl.fetchOne("update book set status = 'DROPPED' where id = ? returning *", id));
    }

    /** 확인이 필요한 스탠드는 먼저 확인해야 한다 (깜빡한 시간이 기록되지 않게). 아니면 켜진 스탠드를 지금 끈다. */
    private void endSession(long userId) {
        if (sessions.needsConfirm(userId)) throw SessionService.needsConfirm();
        sessions.stopForBookEnd(userId);
    }
}
