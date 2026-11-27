package kr.readingroom.app.village.dto;

import com.fasterxml.jackson.databind.JsonNode;

/** 광장에 접속한 사람 한 명. 공개 번호(publicId)로만 가리킨다 — 내부 숫자 id는 내보내지 않는다(결정 #69). */
public record PlazaMember(String publicId, String nickname, JsonNode avatar) {}
