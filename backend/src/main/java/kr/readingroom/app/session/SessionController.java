package kr.readingroom.app.session;

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
}
