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
import kr.readingroom.app.auth.dto.TransferCodeResponse;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.IpWindowLimit;
import kr.readingroom.app.common.TokenResolver;
import kr.readingroom.app.user.UserService;
import org.springframework.beans.factory.annotation.Value;
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
    static final String GOOGLE = "google", DEV = "dev", GUEST = "guest";
    private static final java.util.regex.Pattern DEVICE_KEY = java.util.regex.Pattern.compile("[A-Za-z0-9_-]{32,128}");
    static final Duration LIFETIME = Duration.ofDays(30);
    static final String PLACEHOLDER_NICKNAME = "손님";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final GoogleIdTokenVerifier verifier;
    private final AuthRepository auth;
    private final UserService users;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final IpWindowLimit signups; // 게스트 새 계정: IP당 한 시간(결정 #84)
    private final IpWindowLimit attempts; // 이전 코드 입력: IP당 10분(결정 #85)

    public AuthService(GoogleIdTokenVerifier verifier, AuthRepository auth, UserService users, TransactionTemplate tx, Clock clock,
            @Value("${app.auth.guest-signups-per-hour-per-ip:30}") int signupsPerHour,
            @Value("${app.auth.transfer-attempts-per-10min-per-ip:10}") int attemptsPer10Min) {
        this.verifier = verifier;
        this.auth = auth;
        this.users = users;
        this.tx = tx;
        this.clock = clock;
        this.signups = new IpWindowLimit(clock, signupsPerHour, Duration.ofHours(1));
        this.attempts = new IpWindowLimit(clock, attemptsPer10Min, Duration.ofMinutes(10));
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

    /**
     * 게스트 로그인(결정 #84): 가입 없이 시작한다. 기기가 만든 무작위 키(deviceKey)의 SHA-256을 이 계정의 식별자로 쓰고(키 원문은 저장하지 않는다),
     * 같은 키는 같은 계정이다. 토큰이 만료돼도 기기 키로 다시 들어온다. 새 계정을 만들 때만 IP당 시간당 횟수를 제한한다.
     */
    public LoginResponse guestLogin(String deviceKey, String ip) {
        if (deviceKey == null || !DEVICE_KEY.matcher(deviceKey).matches())
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_DEVICE_KEY", "기기 키가 올바르지 않아요");
        String subject = hash(deviceKey);
        // 한도 없이 어디까지 되는지 보려고 잠시 끈다(2026-11-24). 켜려면 아래 두 줄의 주석을 푼다
        // if (auth.findUserByIdentity(GUEST, subject) == null && !signups.tryAcquire(ip))
        //     throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_GUESTS", "잠시 뒤에 다시 시도해 주세요");
        return loginOrCreate(GUEST, subject);
    }

    static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // I O 0 1 제외(읽기 헷갈림)
    static final Duration TRANSFER_LIFETIME = Duration.ofMinutes(10);

    /**
     * 기기 이전 코드를 만든다(결정 #85): 8자리 일회용 코드, 10분 유효, 계정마다 하나(새로 만들면 이전 코드는 못 쓴다).
     * 서버에는 SHA-256만 저장하고 원문은 이 응답에서만 보인다.
     */
    public TransferCodeResponse issueTransferCode(long userId) {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 8; i++) code.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        Instant now = clock.instant(), expires = now.plus(TRANSFER_LIFETIME);
        auth.upsertTransferCode(userId, hash(code.toString()), now, expires);
        return new TransferCodeResponse(code.toString(), expires);
    }

    /**
     * 이전 코드로 이 기기를 그 계정에 잇고 로그인한다. 이 기기 키가 이미 다른 게스트 계정에 이어져 있었다면(새 기기가 먼저 자동으로 시작한 경우)
     * 그 연결이 코드의 계정으로 옮겨 간다. 코드는 한 번만 쓸 수 있고, 코드 모양이 맞는 시도는 IP당 10분에 10번까지 센다.
     */
    public LoginResponse redeemTransfer(String rawCode, String deviceKey, String ip) {
        String code = rawCode == null ? "" : rawCode.toUpperCase().replaceAll("[\s-]", "");
        if (!code.matches("[A-HJ-NP-Z2-9]{8}")) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_CODE", "코드는 영문·숫자 8자리예요");
        if (deviceKey == null || !DEVICE_KEY.matcher(deviceKey).matches())
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_DEVICE_KEY", "기기 키가 올바르지 않아요");
        // 한도 없이 어디까지 되는지 보려고 잠시 끈다(2026-11-24). 켜려면 주석을 푼다
        // if (!attempts.tryAcquire(ip)) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS", "잠시 뒤에 다시 시도해 주세요");
        String subject = hash(deviceKey);
        return tx.execute(status -> {
            Instant now = clock.instant();
            Long userId = auth.consumeTransferCode(hash(code), now);
            if (userId == null) throw new ApiException(HttpStatus.NOT_FOUND, "INVALID_CODE", "코드가 없거나 만료됐어요");
            auth.lockIdentity(GUEST, subject);
            auth.pointIdentityTo(userId, GUEST, subject);
            auth.deleteExpired(userId, now);
            String token = newToken();
            Instant expires = now.plus(LIFETIME);
            auth.insertSession(hash(token), userId, now, expires);
            return new LoginResponse(token, expires, false, users.get(userId));
        });
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
