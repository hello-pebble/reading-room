package kr.readingroom.app.book;

import kr.readingroom.app.book.dto.*;
import kr.readingroom.app.common.RequestJson;
import java.time.Clock;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.session.SessionService;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 완독·포기: 소파를 비우면서 켜진 스탠드도 같이 끈다. */
@Service
public class BookEndService {
    private final BookRepository bookRepository;
    private final Clock clock;
    private final BookService books;
    private final SessionService sessions;

    public BookEndService(BookRepository bookRepository, Clock clock, BookService books, SessionService sessions) {
        this.bookRepository = bookRepository;
        this.clock = clock;
        this.books = books;
        this.sessions = sessions;
    }

    @Transactional
    public BookResponse finish(long userId, long id, FinishBookRequest b) {
        Record book = books.owned(userId, id);
        String st = book.get("status", String.class);
        if (st.equals("DONE")) return books.view(book);   // 다시 보내도 같은 결과
        if (!st.equals("READING")) throw new ApiException(HttpStatus.CONFLICT, "NOT_READING", "소파에 올려 둔 책만 완독할 수 있어요");
        Integer rating = null;
        if (b != null && RequestJson.present(b.rating())) {
            if (!b.rating().isInt() || b.rating().asInt() < 0 || b.rating().asInt() > 5)
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_RATING", "별점은 1~5예요");
            rating = b.rating().asInt() == 0 ? null : b.rating().asInt();   // 0은 별점 해제
        }
        String review = b == null ? null : b.oneLineReview();
        if (review != null && review.length() > 500) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REVIEW", "한줄평은 500자까지예요");
        if (review != null && review.isEmpty()) review = null;
        endSession(userId);
        Record r = bookRepository.finish(clock.instant().toString(), rating, review, BookService.MAX_PAGES, id);
        return books.view(r);
    }

    @Transactional
    public BookResponse drop(long userId, long id) {
        Record book = books.owned(userId, id);
        String st = book.get("status", String.class);
        if (st.equals("DROPPED")) return books.view(book);
        if (!st.equals("READING")) throw new ApiException(HttpStatus.CONFLICT, "NOT_READING", "소파에 올려 둔 책만 포기할 수 있어요");
        endSession(userId);
        return books.view(bookRepository.drop(id));
    }

    /** 확인이 필요한 스탠드는 먼저 확인해야 한다 (깜빡한 시간이 기록되지 않게). 아니면 켜진 스탠드를 지금 끈다. */
    private void endSession(long userId) {
        if (sessions.needsConfirm(userId)) throw SessionService.needsConfirm();
        sessions.stopForBookEnd(userId);
    }
}
