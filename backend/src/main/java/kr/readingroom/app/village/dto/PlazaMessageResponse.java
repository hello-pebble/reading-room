package kr.readingroom.app.village.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

/** 광장 글 한 줄. 글쓴이는 공개 번호(publicId, 무작위 UUID)로만 가리킨다 — 핸들과 내부 숫자 id는 내보내지 않는다(결정 #69). */
public record PlazaMessageResponse(long id, String publicId, String nickname, JsonNode avatar, String content, Instant createdAt) {}
