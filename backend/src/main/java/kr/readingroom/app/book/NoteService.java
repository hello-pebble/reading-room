package kr.readingroom.app.book;

import kr.readingroom.app.book.dto.*;
import kr.readingroom.app.common.RequestJson;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.Db;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoteService {
    private final NoteRepository noteRepository;
    private final BookService books;
    private final Clock clock;

    public NoteService(NoteRepository noteRepository, BookService books, Clock clock) {
        this.noteRepository = noteRepository;
        this.books = books;
        this.clock = clock;
    }

    /** 메모·인용구 추가. 쪽이 현재 쪽보다 크면 현재 쪽이 따라 올라가고, 작으면 그대로다 (SF-03). */
    @Transactional
    public NoteCreatedResponse add(long userId, long bookId, NoteRequest b) {
        books.owned(userId, bookId);
        String type = b.type() != null ? b.type() : "MEMO";
        if (!type.equals("MEMO") && !type.equals("QUOTE"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_TYPE", "type은 MEMO 또는 QUOTE예요");
        String content = b.content() == null ? "" : b.content();
        if (content.isEmpty() || content.length() > 2000)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_CONTENT", "내용은 1~2000자로 적어 주세요");
        Integer page = null;
        if (RequestJson.present(b.page())) {
            if (!b.page().isNumber()) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_PAGE", "쪽은 숫자예요");
            page = (int) Math.max(0, Math.min(BookService.MAX_PAGES, Math.round(b.page().asDouble())));
        }
        Record n = noteRepository.insert(bookId, type, content, page, clock.instant().toString());
        if (page != null) books.raisePage(bookId, page);
        NoteResponse note = view(n);
        BookResponse book = books.get(userId, bookId);
        return new NoteCreatedResponse(note.id(), note.bookId(), note.type(), note.content(), note.page(), note.createdAt(), book.currentPage(), book.percent());
    }

    /** 메모·인용구 삭제. 내 책의 메모만 지울 수 있고(남의 책·없는 메모는 404), 이미 올라간 현재 쪽은 줄지 않는다. */
    @Transactional
    public void delete(long userId, long bookId, long noteId) {
        books.owned(userId, bookId);
        if (noteRepository.deleteInBook(bookId, noteId) == 0)
            throw new ApiException(HttpStatus.NOT_FOUND, "NOTE_NOT_FOUND", "메모를 찾을 수 없어요");
    }

    public List<NoteResponse> list(long userId, long bookId) {
        books.owned(userId, bookId);
        List<NoteResponse> out = new ArrayList<>();
        noteRepository.findByBook(bookId).forEach(r -> out.add(view(r)));
        return out;
    }

    private NoteResponse view(Record r) {
        return new NoteResponse(r.get("id", Long.class), r.get("book_id", Long.class), r.get("type", String.class),
                r.get("content", String.class), r.get("page", Integer.class), Db.instant(r, "created_at"));
    }
}
