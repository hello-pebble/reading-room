package kr.readingroom.app.auth.dto;

/** 개발용 로그인 요청: 계정을 구분하는 이름 (1~40자) */
public record DevLoginRequest(String label) {}
