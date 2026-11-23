package kr.readingroom.app.auth.dto;

import java.time.Instant;

/** 새로 만든 이전 코드. 원문은 이 응답에서만 볼 수 있다(서버에는 해시만 남는다). 10분 뒤(expiresAt) 만료된다. */
public record TransferCodeResponse(String code, Instant expiresAt) {}
