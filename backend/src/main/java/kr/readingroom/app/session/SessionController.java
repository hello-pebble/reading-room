package kr.readingroom.app.session;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import kr.readingroom.app.common.IdempotencyService;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/sessions")
public class SessionController {
    private final SessionService sessions;
    private final IdempotencyService idem;

    public SessionController(SessionService sessions, IdempotencyService idem) {
        this.sessions = sessions;
        this.idem = idem;
    }

    @PostMapping("/start")
    public ResponseEntity<Object> start(@RequestAttribute(UserIdFilter.ATTR) long uid,
                                        @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return idem.run(uid, key, "/sessions/start", HttpStatus.CREATED, () -> sessions.start(uid));
    }

    @GetMapping("/current")
    public Map<String, Object> current(@RequestAttribute(UserIdFilter.ATTR) long uid) {
        return sessions.current(uid);
    }

    private static final String KEY = "Idempotency-Key";

    @PostMapping("/{id}/stop")
    public ResponseEntity<Object> stop(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                       @RequestBody(required = false) JsonNode body, @RequestHeader(value = KEY, required = false) String key) {
        return idem.run(uid, key, "/sessions/" + id + "/stop", HttpStatus.OK, () -> sessions.stop(uid, id, body));
    }

    @PostMapping("/{id}/check")
    public ResponseEntity<Object> check(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                        @RequestHeader(value = KEY, required = false) String key) {
        return idem.run(uid, key, "/sessions/" + id + "/check", HttpStatus.OK, () -> sessions.check(uid, id));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<Object> confirm(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                          @RequestBody JsonNode body, @RequestHeader(value = KEY, required = false) String key) {
        return idem.run(uid, key, "/sessions/" + id + "/confirm", HttpStatus.OK, () -> sessions.confirm(uid, id, body));
    }

    @PostMapping("/manual")
    public ResponseEntity<Object> manual(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody JsonNode body,
                                         @RequestHeader(value = KEY, required = false) String key) {
        return idem.run(uid, key, "/sessions/manual", HttpStatus.CREATED, () -> sessions.manual(uid, body));
    }
}
