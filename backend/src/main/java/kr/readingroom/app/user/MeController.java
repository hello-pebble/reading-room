package kr.readingroom.app.user;

import kr.readingroom.app.user.dto.*;
import kr.readingroom.app.common.UserIdFilter;
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
    public UserResponse me(@RequestAttribute(UserIdFilter.ATTR) long userId) {
        return users.get(userId);
    }

    /** 닉네임 정하기·바꾸기 (한글·영문·숫자 1~5자). 응답은 /me와 같은 모양이다. */
    @PutMapping("/me/nickname")
    public UserResponse nickname(@RequestAttribute(UserIdFilter.ATTR) long userId, @RequestBody NicknameRequest body) {
        return users.changeNickname(userId, body == null ? null : body.nickname());
    }

    /** 거울: 아바타 저장. 응답은 /me와 같은 모양이다. */
    @PutMapping("/me/avatar")
    public UserResponse avatar(@RequestAttribute(UserIdFilter.ATTR) long userId, @RequestBody AvatarRequest body) {
        return users.saveAvatar(userId, body);
    }
}
