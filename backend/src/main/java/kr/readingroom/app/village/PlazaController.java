package kr.readingroom.app.village;

import java.util.List;
import kr.readingroom.app.common.UserIdFilter;
import kr.readingroom.app.village.dto.PlazaMessageRequest;
import kr.readingroom.app.village.dto.PlazaMessageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/plaza/messages")
public class PlazaController {
    private final PlazaService plaza;

    public PlazaController(PlazaService plaza) {
        this.plaza = plaza;
    }

    @GetMapping
    public List<PlazaMessageResponse> list(@RequestParam(required = false) String since) {
        return plaza.list(since);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlazaMessageResponse send(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody PlazaMessageRequest body) {
        return plaza.send(uid, body);
    }
}
