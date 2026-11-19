package kr.readingroom.app.auth;

import java.security.PublicKey;

/** 구글 ID 토큰 서명을 확인할 공개키 목록. kid로 찾고 없으면 null. 테스트는 직접 만든 키로 바꿔 끼운다. */
@FunctionalInterface
public interface GoogleKeys {
    PublicKey key(String kid);
}
