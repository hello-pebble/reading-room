package kr.readingroom.app.auth.dto;

/** 구글 로그인 요청: 화면이 구글에서 받은 ID 토큰 */
public record GoogleLoginRequest(String idToken) {}
