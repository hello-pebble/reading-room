package kr.readingroom.app.room.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

/**
 * 가져온 공유방 기록. messages는 책의 공유방 탭에서만 내려가고(가져오기 응답에는 null) 다른 참여자는 "참여자 A"처럼 익명이다.
 * bookCreated는 이번 가져오기에서 "나중에 읽을 책"(LATER)을 새로 만들었는지(가져오기 응답에서만 의미가 있다).
 */
public record ArchiveResponse(long id, long bookId, String bookStatus, boolean bookCreated, long roomId, String roomTitle, String kind,
                              Instant openedAt, Instant closedAt, int messageCount, Instant importedAt, JsonNode messages) {}
