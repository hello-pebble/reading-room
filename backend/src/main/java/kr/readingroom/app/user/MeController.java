package kr.readingroom.app.user;

import java.util.Map;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeController {
    private final UserService users;

    public MeController(UserService users) {
        this.users = users;
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestAttribute(UserIdFilter.ATTR) long userId) {
        return users.get(userId);
    }
}
