package kr.readingroom.app.auth;

import kr.readingroom.app.auth.dto.DevLoginRequest;
import kr.readingroom.app.auth.dto.LoginResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** dev 프로파일 전용: 구글 없이 화면을 연결해 볼 수 있게 이름만으로 로그인한다. 운영에서는 로드되지 않는다. */
@Profile("dev")
@RestController
public class DevAuthController {
    private final AuthService auth;

    public DevAuthController(AuthService auth) {
        this.auth = auth;
    }

    /** 로그인 필요 없음(/dev/ 경로는 UserIdFilter 예외). 응답은 POST /auth/google과 같다. */
    @PostMapping("/dev/login")
    public LoginResponse login(@RequestBody DevLoginRequest body) {
        return auth.devLogin(body == null ? null : body.label());
    }
}
