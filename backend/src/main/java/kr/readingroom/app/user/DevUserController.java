package kr.readingroom.app.user;

import kr.readingroom.app.user.dto.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** dev 프로파일 전용: 로그인이 없는 동안 테스트용 사용자를 만든다. 운영에서는 로드되지 않는다. */
@Profile("dev")
@RestController
public class DevUserController {
    private final UserService users;

    public DevUserController(UserService users) {
        this.users = users;
    }


    @PostMapping("/dev/users")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@RequestBody CreateUserRequest body) {
        return users.create(body.nickname() == null ? "손님" : body.nickname());   // 안 주면 구글 가입 직후와 같은 임시 닉네임
    }
}
