package kr.readingroom.app.book;

import kr.readingroom.app.book.dto.*;
import java.util.List;
import kr.readingroom.app.common.IdempotencyService;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/books")
public class BookController {
    private final BookService books;
    private final BookEndService ends;
    private final IdempotencyService idem;

    public BookController(BookService books, BookEndService ends, IdempotencyService idem) {
        this.books = books;
        this.ends = ends;
        this.idem = idem;
    }

    @PostMapping("/{id}/finish")
    public ResponseEntity<BookResponse> finish(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                         @RequestBody(required = false) FinishBookRequest body,
                                         @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return idem.run(uid, key, "/books/" + id + "/finish", HttpStatus.OK, BookResponse.class, () -> ends.finish(uid, id, body));
    }

    @PostMapping("/{id}/drop")
    public ResponseEntity<BookResponse> drop(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                       @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return idem.run(uid, key, "/books/" + id + "/drop", HttpStatus.OK, BookResponse.class, () -> ends.drop(uid, id));
    }

    @PostMapping
    public ResponseEntity<BookResponse> create(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody CreateBookRequest body,
                                         @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return idem.run(uid, key, "/books", HttpStatus.CREATED, BookResponse.class, () -> books.create(uid, body));
    }

    @PatchMapping("/{id}")
    public BookResponse patch(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id, @RequestBody PatchBookRequest body) {
        return books.patch(uid, id, body);
    }

    @GetMapping
    public List<BookResponse> list(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestParam(required = false) String status) {
        return books.list(uid, status);
    }

    @GetMapping("/{id}")
    public BookResponse get(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        return books.get(uid, id);
    }
}
