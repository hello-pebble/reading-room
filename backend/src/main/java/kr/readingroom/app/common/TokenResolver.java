package kr.readingroom.app.common;

/** Bearer 토큰으로 사용자를 찾는다. 없거나 만료됐으면 null. 구현은 auth.AuthService이고, 필터는 이 인터페이스만 안다. */
@FunctionalInterface
public interface TokenResolver {
    Long userIdFor(String token);
}
