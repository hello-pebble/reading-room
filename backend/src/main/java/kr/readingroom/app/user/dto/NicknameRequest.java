package kr.readingroom.app.user.dto;

/** 닉네임 정하기·바꾸기 요청. 규칙 검사는 user.Nickname에서 한다. */
public record NicknameRequest(String nickname) {}
