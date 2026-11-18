package kr.readingroom.app.neighbor.dto;

import java.time.Instant;

/** 이웃집 책장 아래 칸에 꽂힌 추천 한 권. 보낸 사람은 닉네임으로 밝힌다(결정 #62, 핸들·id는 내려주지 않는다). */
public record RecommendationResponse(long id, String fromNickname, RecommendedBook book, Instant createdAt) {}
