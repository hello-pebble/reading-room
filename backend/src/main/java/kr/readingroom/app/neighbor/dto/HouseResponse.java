package kr.readingroom.app.neighbor.dto;

/**
 * 이웃집 방문 화면. occupied는 아래 칸에 확인 전 추천이 있는지(있으면 더 꽂을 수 없다).
 * book은 그 추천을 내가 꽂았을 때(mine)만 내려가고, 다른 사람이 꽂은 책은 알려 주지 않는다.
 */
public record HouseResponse(String handle, String nickname, boolean occupied, boolean mine, RecommendedBook book) {}
