package kr.readingroom.app.room.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

/**
 * 공유방 글 한 줄. 방을 나간 사람의 글은 남기되 익명이다: userId·handle·avatar는 null, nickname은 "나간 참여자".
 * 다른 사람의 진행 퍼센트는 담지 않는다. page는 같은 책 방에서 글쓴이가 적은 쪽수(없을 수 있음).
 */
public record RoomMessageResponse(long id, Long userId, String handle, String nickname, JsonNode avatar, String content, Integer page,
                                  Instant createdAt, boolean mine, boolean left) {}
