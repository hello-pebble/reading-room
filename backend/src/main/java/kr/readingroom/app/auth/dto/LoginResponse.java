package kr.readingroom.app.auth.dto;

import java.time.Instant;
import kr.readingroom.app.user.dto.UserResponse;

/** token은 이 응답에서만 볼 수 있다(서버에는 해시만 남는다). newUser면 방금 가입한 것이고, user.needsNickname이면 닉네임 정하기로 보낸다. */
public record LoginResponse(String token, Instant expiresAt, boolean newUser, UserResponse user) {}
