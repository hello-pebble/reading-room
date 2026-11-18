package kr.readingroom.app.village.dto;

import java.time.Instant;

/** 마을 게시판의 방 한 줄. 상태는 시각으로 계산한 값이고, 초대 코드는 개설자에게만 내려간다. */
public record RoomResponse(long id, String kind, String title, String isbn, String status,
                           Instant openAt, Instant closeAt, Instant closedAt, Instant deleteAt,
                           int participants, int maxParticipants, boolean mine, boolean joined, boolean agreed,
                           String ownerNickname, String inviteCode) {}
