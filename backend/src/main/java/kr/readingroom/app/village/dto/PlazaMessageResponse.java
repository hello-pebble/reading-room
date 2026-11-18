package kr.readingroom.app.village.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

public record PlazaMessageResponse(long id, long userId, String handle, String nickname, JsonNode avatar, String content, Instant createdAt) {}
