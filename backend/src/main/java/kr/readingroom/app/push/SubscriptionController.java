package kr.readingroom.app.push;

import kr.readingroom.app.push.dto.*;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class SubscriptionController {
    private final SubscriptionService subs;

    public SubscriptionController(SubscriptionService subs) {
        this.subs = subs;
    }

    @PostMapping("/me/push-subscription")
    public SubscriptionResponse save(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody SubscriptionRequest body,
                                    @RequestHeader(value = "User-Agent", required = false) String ua) {
        return subs.save(uid, body, ua);
    }

    /** endpoint는 쿼리(?endpoint=) 또는 본문({endpoint})으로 받는다. */
    @DeleteMapping("/me/push-subscription")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestParam(required = false) String endpoint,
                       @RequestBody(required = false) DeleteSubscriptionRequest body) {
        String e = endpoint != null ? endpoint : body != null ? body.endpoint() : null;
        subs.delete(uid, e);
    }
}
