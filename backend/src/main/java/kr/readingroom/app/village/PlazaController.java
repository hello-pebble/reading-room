package kr.readingroom.app.village;

import java.util.List;
import kr.readingroom.app.common.UserIdFilter;
import kr.readingroom.app.village.dto.PlazaMessageRequest;
import kr.readingroom.app.village.dto.PlazaMessageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/plaza")
public class PlazaController {
    private final PlazaService plaza;
    private final PlazaPresence presence;

    public PlazaController(PlazaService plaza, PlazaPresence presence) {
        this.plaza = plaza;
        this.presence = presence;
    }

    @GetMapping("/messages")
    public List<PlazaMessageResponse> list(@RequestParam(required = false) String since) {
        return plaza.list(since);
    }

    @PostMapping("/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public PlazaMessageResponse send(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody PlazaMessageRequest body) {
        return plaza.send(uid, body);
    }

    /** 광장 접속 인원 (SSE, 결정 #91): 연결한 동안 접속으로 세고, 명단이 바뀔 때마다 presence 이벤트를 보낸다 */
    @GetMapping(value = "/presence", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter presence(@RequestAttribute(UserIdFilter.ATTR) long uid) {
        return presence.connect(uid);
    }
}
