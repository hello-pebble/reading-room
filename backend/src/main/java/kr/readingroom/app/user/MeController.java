package kr.readingroom.app.user;

import java.util.Map;
import kr.readingroom.app.common.UserIdFilter;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    /** 거울: 아바타 저장. 응답은 /me와 같은 모양이다. */
    @PutMapping("/me/avatar")
    public Map<String, Object> avatar(@RequestAttribute(UserIdFilter.ATTR) long userId, @RequestBody JsonNode body) {
        return users.saveAvatar(userId, body);
    }
}
