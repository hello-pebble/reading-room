package kr.readingroom.app.room.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

/** 모닥불 참여자 한 명 (결정 #92). 공개 번호로만 가리키고 내부 id는 내보내지 않는다(결정 #69). bookTitle은 그 사람이 고른 책(없으면 생략). */
public record RoomParticipantResponse(String publicId, String nickname, JsonNode avatar,
                                      @JsonInclude(JsonInclude.Include.NON_NULL) String bookTitle, boolean owner, boolean mine) {}
