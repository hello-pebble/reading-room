package kr.readingroom.app.auth.dto;

/** 이전 코드로 들어오기: 코드(대소문자·공백·하이픈은 무시)와 이 기기의 키(게스트 로그인과 같은 규칙) */
public record TransferRequest(String code, String deviceKey) {}
