package kr.readingroom.app.auth;

import jakarta.servlet.http.HttpServletRequest;
import kr.readingroom.app.auth.dto.GoogleLoginRequest;
import kr.readingroom.app.auth.dto.GuestLoginRequest;
import kr.readingroom.app.auth.dto.TransferCodeResponse;
import kr.readingroom.app.auth.dto.TransferRequest;
import kr.readingroom.app.auth.dto.LoginResponse;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
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

    /** 게스트 로그인: 가입 없이 기기 키로 시작한다(결정 #84). 응답은 구글 로그인과 같다. */
    @PostMapping("/auth/guest")
    public LoginResponse guest(@RequestBody GuestLoginRequest body, HttpServletRequest req) {
        return auth.guestLogin(body == null ? null : body.deviceKey(), req.getRemoteAddr());
    }

    /** 기기 이전 코드 만들기(결정 #85): 로그인한 기기가 8자리 일회용 코드를 받는다(10분). 다른 기기가 POST /auth/transfer로 쓴다. */
    @PostMapping("/me/transfer-code")
    public TransferCodeResponse issueTransferCode(@RequestAttribute(UserIdFilter.ATTR) long uid) {
        return auth.issueTransferCode(uid);
    }

    /** 이전 코드로 이 기기를 그 계정에 잇고 로그인한다. 응답은 구글·게스트 로그인과 같다. */
    @PostMapping("/auth/transfer")
    public LoginResponse transfer(@RequestBody TransferRequest body, HttpServletRequest req) {
        return auth.redeemTransfer(body == null ? null : body.code(), body == null ? null : body.deviceKey(), req.getRemoteAddr());
    }

    /** 이 기기에서 쓴 토큰만 끝낸다 */
    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        auth.logout(UserIdFilter.bearer(authorization));
    }
}
