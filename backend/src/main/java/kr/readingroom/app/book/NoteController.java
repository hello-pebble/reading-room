package kr.readingroom.app.book;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/books/{bookId}/notes")
public class NoteController {
    private final NoteService notes;

    public NoteController(NoteService notes) {
        this.notes = notes;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> add(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long bookId, @RequestBody JsonNode body) {
        return notes.add(uid, bookId, body);
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long bookId) {
        return notes.list(uid, bookId);
    }
}
