package kr.readingroom.app.session.dto;

import java.time.Instant;

public record AlreadyRunningResponse(String error, String message, SessionResponse session, Instant serverNow) {}
