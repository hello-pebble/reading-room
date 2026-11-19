package kr.readingroom.app.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import kr.readingroom.app.auth.dto.LoginResponse;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.TokenResolver;
import kr.readingroom.app.user.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 구글 로그인과 세션 토큰 (결정 #67·#68). 구글 ID 토큰을 확인해 구글 계정 고유 ID(sub)를 얻고, 그 계정에 연결된 사용자로 로그인한다.
 * 처음이면 사용자를 만든다: 핸들은 자동, 닉네임은 임시("손님")이고 직접 정할 때까지 needsNickname이 켜져 있다.
 * 토큰은 무작위 32바이트이고 서버에는 SHA-256 해시만 저장한다. 유효 기간은 30일(고정).
 */
@Service
public class AuthService implements TokenResolver {
    static final String GOOGLE = "google", DEV = "dev";
    static final Duration LIFETIME = Duration.ofDays(30);
    static final String PLACEHOLDER_NICKNAME = "손님";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final GoogleIdTokenVerifier verifier;
    private final AuthRepository auth;
    private final UserService users;
    private final TransactionTemplate tx;
    private final Clock clock;

    public AuthService(GoogleIdTokenVerifier verifier, AuthRepository auth, UserService users, TransactionTemplate tx, Clock clock) {
        this.verifier = verifier;
        this.auth = auth;
        this.users = users;
        this.tx = tx;
        this.clock = clock;
    }

    /** ID 토큰 확인(외부 키 내려받기가 있을 수 있어 DB 트랜잭션 밖에서)을 먼저 하고, 사용자 찾기·만들기와 세션 발급은 한 트랜잭션으로 한다. */
    public LoginResponse googleLogin(String idToken) {
        return loginOrCreate(GOOGLE, verifier.verify(idToken));
    }

    /**
     * 개발용 로그인(dev 프로파일 전용 컨트롤러가 부른다): 이름(label)마다 계정이 하나이고 구글과 같은 흐름으로 진짜 Bearer 토큰을 준다.
     * 화면 연결을 구글 클라이언트 ID 없이 시작하려는 용도라서, 나중에 구글 로그인으로 바꿀 때는 로그인 호출만 바꾸면 된다.
     */
    public LoginResponse devLogin(String label) {
        String l = label == null ? "" : label.trim();
        if (l.isEmpty() || l.length() > 40) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_LABEL", "이름은 1~40자로 적어 주세요");
        return loginOrCreate(DEV, l);
    }

    private LoginResponse loginOrCreate(String provider, String subject) {
        return tx.execute(status -> {
            Instant now = clock.instant();
            auth.lockIdentity(provider, subject);
            Long userId = auth.findUserByIdentity(provider, subject);
            boolean created = userId == null;
            if (created) {
                userId = newUser();
                auth.insertIdentity(userId, provider, subject);
            }
            auth.deleteExpired(userId, now);
            String token = newToken();
            Instant expires = now.plus(LIFETIME);
            auth.insertSession(hash(token), userId, now, expires);
            return new LoginResponse(token, expires, created, users.get(userId));
        });
    }

    @Override
    public Long userIdFor(String token) {
        return token == null || token.isEmpty() ? null : auth.findSessionUser(hash(token), clock.instant());
    }

    /** 이 토큰의 세션만 지운다(다른 기기는 그대로). 없는 토큰이어도 오류가 아니다. */
    public void logout(String token) {
        if (token != null && !token.isEmpty()) auth.deleteSession(hash(token));
    }

    private long newUser() {
        return auth.insertUser(PLACEHOLDER_NICKNAME);
    }

    private static String newToken() {
        byte[] b = new byte[32];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
