package kr.readingroom.app.neighbor.dto;

import java.time.Instant;

/** 이웃집 책장 아래 칸에 꽂힌 추천 한 권. 받는 사람에게도 보내는 사람은 알리지 않는다(몰래 꽂아 두기). */
public record RecommendationResponse(long id, RecommendedBook book, Instant createdAt) {}
