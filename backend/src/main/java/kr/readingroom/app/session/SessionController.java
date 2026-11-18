package kr.readingroom.app.session;

import kr.readingroom.app.session.dto.*;
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
    public ResponseEntity<SessionResponse> start(@RequestAttribute(UserIdFilter.ATTR) long uid,
                                        @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return idem.run(uid, key, "/sessions/start", HttpStatus.CREATED, SessionResponse.class, () -> sessions.start(uid));
    }

    @GetMapping("/current")
    public CurrentSessionResponse current(@RequestAttribute(UserIdFilter.ATTR) long uid) {
        return sessions.current(uid);
    }

    private static final String KEY = "Idempotency-Key";

    @PostMapping("/{id}/stop")
    public ResponseEntity<SessionResponse> stop(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                       @RequestBody(required = false) SessionRequest body, @RequestHeader(value = KEY, required = false) String key) {
        return idem.run(uid, key, "/sessions/" + id + "/stop", HttpStatus.OK, SessionResponse.class, () -> sessions.stop(uid, id, body));
    }

    @PostMapping("/{id}/check")
    public ResponseEntity<SessionResponse> check(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                        @RequestHeader(value = KEY, required = false) String key) {
        return idem.run(uid, key, "/sessions/" + id + "/check", HttpStatus.OK, SessionResponse.class, () -> sessions.check(uid, id));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<SessionResponse> confirm(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                          @RequestBody SessionRequest body, @RequestHeader(value = KEY, required = false) String key) {
        return idem.run(uid, key, "/sessions/" + id + "/confirm", HttpStatus.OK, SessionResponse.class, () -> sessions.confirm(uid, id, body));
    }

    @PostMapping("/manual")
    public ResponseEntity<SessionResponse> manual(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody SessionRequest body,
                                         @RequestHeader(value = KEY, required = false) String key) {
        return idem.run(uid, key, "/sessions/manual", HttpStatus.CREATED, SessionResponse.class, () -> sessions.manual(uid, body));
    }
}
