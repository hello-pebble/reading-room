package kr.readingroom.app.user.dto;


/** needsNickname: 구글로 막 가입해 닉네임이 임시인 사용자. 화면이 닉네임 정하기(PUT /me/nickname)로 보낸다. */
public record UserResponse(long id, String handle, String nickname, AvatarResponse avatar, boolean needsNickname) {}
