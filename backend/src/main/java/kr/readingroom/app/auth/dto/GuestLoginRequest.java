package kr.readingroom.app.auth.dto;

/** 게스트 로그인 요청: 기기가 처음 한 번 만들어 기기에만 저장해 두는 무작위 키(영문·숫자·-·_ 32~128자). 같은 키는 같은 계정이다. */
public record GuestLoginRequest(String deviceKey) {}
