package kr.readingroom.app.book;

import kr.readingroom.app.book.dto.*;
import java.util.List;
import kr.readingroom.app.common.IdempotencyService;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/books/{bookId}/notes")
public class NoteController {
    private final NoteService notes;
    private final IdempotencyService idem;

    public NoteController(NoteService notes, IdempotencyService idem) {
        this.notes = notes;
        this.idem = idem;
    }

    @PostMapping
    public ResponseEntity<NoteCreatedResponse> add(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long bookId, @RequestBody NoteRequest body,
                                      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return idem.run(uid, key, "/books/" + bookId + "/notes", HttpStatus.CREATED, NoteCreatedResponse.class, () -> notes.add(uid, bookId, body));
    }

    @GetMapping
    public List<NoteResponse> list(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long bookId) {
        return notes.list(uid, bookId);
    }
}
