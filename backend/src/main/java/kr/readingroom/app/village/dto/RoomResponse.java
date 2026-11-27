package kr.readingroom.app.village.dto;

import java.time.Instant;

/** 마을 게시판의 방 한 줄. 상태는 시각으로 계산한 값이고, 초대 코드는 개설자에게만 내려간다(공개 방 PUBLIC은 누구에게나, 결정 #101). alarm은 내가 예정 방의 개방 알림을 켰는지, unread는 참여 중이고 마지막으로 읽은 뒤 다른 사람의 새 글이 있으면 true(새 글 별). */
public record RoomResponse(long id, String kind, String title, String isbn, String status,
                           Instant openAt, Instant closeAt, Instant closedAt, Instant deleteAt,
                           int participants, int maxParticipants, boolean mine, boolean joined, boolean agreed, boolean unread, boolean alarm,
                           String ownerNickname, String visibility, String inviteCode) {}
