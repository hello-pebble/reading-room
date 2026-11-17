package kr.readingroom.app.book;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/books")
public class BookController {
    private final BookService books;

    public BookController(BookService books) {
        this.books = books;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody JsonNode body) {
        return books.create(uid, body);
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
