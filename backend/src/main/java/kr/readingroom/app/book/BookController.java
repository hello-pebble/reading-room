package kr.readingroom.app.book;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
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
    public ResponseEntity<Object> finish(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                         @RequestBody(required = false) JsonNode body,
                                         @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return idem.run(uid, key, "/books/" + id + "/finish", HttpStatus.OK, () -> ends.finish(uid, id, body));
    }

    @PostMapping("/{id}/drop")
    public ResponseEntity<Object> drop(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                       @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return idem.run(uid, key, "/books/" + id + "/drop", HttpStatus.OK, () -> ends.drop(uid, id));
    }

    @PostMapping
    public ResponseEntity<Object> create(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody JsonNode body,
                                         @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return idem.run(uid, key, "/books", HttpStatus.CREATED, () -> books.create(uid, body));
    }

    @PatchMapping("/{id}")
    public Map<String, Object> patch(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id, @RequestBody JsonNode body) {
        return books.patch(uid, id, body);
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestParam(required = false) String status) {
        return books.list(uid, status);
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        return books.get(uid, id);
    }
}
