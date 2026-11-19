package kr.readingroom.app.auth;

import kr.readingroom.app.auth.dto.GoogleLoginRequest;
import kr.readingroom.app.auth.dto.LoginResponse;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 구글 로그인과 로그아웃 (결정 #68). 로그인은 사용자 헤더·토큰 없이 열려 있다(UserIdFilter 예외). */
@RestController
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/auth/google")
    public LoginResponse google(@RequestBody GoogleLoginRequest body) {
        return auth.googleLogin(body == null ? null : body.idToken());
    }

    /** 이 기기에서 쓴 토큰만 끝낸다 */
    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        auth.logout(UserIdFilter.bearer(authorization));
    }
}
