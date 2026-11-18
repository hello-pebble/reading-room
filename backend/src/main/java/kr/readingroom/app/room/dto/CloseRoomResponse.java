package kr.readingroom.app.room.dto;

import java.time.Instant;

/** result는 예정 방을 취소했으면 CANCELED(방 행 삭제), 열린 방을 일찍 끝냈으면 CLOSED. */
public record CloseRoomResponse(long id, String result, Instant closedAt) {}
