package kr.readingroom.app.user.dto;


public record UserResponse(long id, String handle, String nickname, AvatarResponse avatar) {}
