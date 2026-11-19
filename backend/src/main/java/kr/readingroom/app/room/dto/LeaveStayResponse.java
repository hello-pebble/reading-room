package kr.readingroom.app.room.dto;

import java.time.Instant;

/** 모닥불 퇴장. leftAt은 방 종료 시각을 넘지 않는다. 1분 미만이면 credited=false, minutes=0이고 기록은 남지 않는다. */
public record LeaveStayResponse(long roomId, Instant enteredAt, Instant leftAt, long minutes, boolean credited) {}
