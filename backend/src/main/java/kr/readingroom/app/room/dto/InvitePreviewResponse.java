package kr.readingroom.app.room.dto;

import java.time.Instant;

/** 초대 링크 미리보기. 로그인 전에도 보이므로 방 id·초대 코드·참여자 목록은 담지 않는다. */
public record InvitePreviewResponse(String title, String kind, String isbn, String bookTitle, String status,
                                    String ownerNickname, int participants, int maxParticipants,
                                    Instant openAt, Instant closeAt, Instant closedAt) {}
