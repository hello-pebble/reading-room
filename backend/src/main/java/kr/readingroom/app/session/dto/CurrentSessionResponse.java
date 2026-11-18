package kr.readingroom.app.session.dto;

import java.time.Instant;

public record CurrentSessionResponse(SessionResponse session, Instant serverNow) {}
