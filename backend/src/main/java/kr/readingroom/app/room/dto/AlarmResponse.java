package kr.readingroom.app.room.dto;

/** 개방 알림 상태. 켜면 alarm이 true다. */
public record AlarmResponse(long roomId, boolean alarm) {}
