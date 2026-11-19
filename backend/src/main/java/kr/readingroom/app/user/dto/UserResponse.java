package kr.readingroom.app.user.dto;


/**
 * 내 정보. publicId는 다른 사람에게 보이는 나의 번호(무작위 UUID)라서 글 작성자(publicId)와 견줘 내 글을 알아보고 내 집 주소를 만든다(결정 #69).
 * id는 내부 번호라 이 응답(본인 것)에만 있고 다른 사람의 응답에는 나가지 않는다. needsNickname: 구글로 막 가입해 닉네임이 임시인 사용자(화면이 PUT /me/nickname으로 보낸다).
 */
public record UserResponse(long id, String publicId, String nickname, AvatarResponse avatar, boolean needsNickname) {}
