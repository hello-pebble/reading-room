# 구글 로그인과 세션 토큰 설계 (짧은 설계)

2026-11-19. 결정 #55(구글 로그인), #67(닉네임 규칙·구글 `sub` 연결). 세션 방식은 **A: 서버가 발급하는 Bearer 토큰(DB 저장)**으로 확정.

## 의도
임시 `X-User-Id` 헤더를 걷어내고, 구글 계정으로 로그인한 사용자만 API를 쓰게 한다. 화면(다른 주소의 정적 페이지)이 구글에서 받은 ID 토큰을 서버에 보내면 서버가 검증하고 자기 세션 토큰을 돌려준다.

## 하지 않는 것
- 화면 연결, 카카오 로그인, 가입 제한(초대 코드): **이번에는 가입을 열어 둔다**(아래 "열린 질문"), 로그인 횟수 제한, 핸들 직접 정하기·바꾸기.
- 구글 이메일·프로필 저장(필요 없다: 구글 계정 고유 ID `sub`만 저장한다).

## 접근
- **A. 불투명 Bearer 토큰 + DB 저장(선택)**: 로그아웃·강제 만료가 즉시 되고 필터만 바꾸면 된다. 요청마다 DB 한 번 조회.
- B. 서명 JWT: 즉시 무효화가 어렵다. 제외. C. HttpOnly 쿠키: 화면과 서버 주소가 달라 SameSite·CORS 설정이 번거롭다. 제외.
- 구글 ID 토큰 검증은 라이브러리 없이 JDK(RS256 서명 검증)와 Jackson으로 직접 한다. 구글 키(JWKS)는 `GoogleKeys` 인터페이스 뒤에 두어 테스트에서 직접 만든 키로 서명·거절 경우를 모두 검사한다.

## 설계
1. `V16__auth_session.sql`: `auth_session(token_hash(SHA-256 16진수 64자, 기본키), user_id → app_user ON DELETE CASCADE, created_at, expires_at)`와 `app_user.nickname_chosen_at`(기존 사용자는 `created_at`으로 채움).
2. `POST /auth/google` body `{idToken}`: 로그인 필요 없음. 검증 규칙(RS256만, `kid`로 키 선택, `iss`는 `accounts.google.com`/`https://accounts.google.com`, `aud`는 우리 클라이언트 ID, `exp` 지남·`sub` 없음 거절). 실패는 401 `INVALID_ID_TOKEN`, 클라이언트 ID(`GOOGLE_CLIENT_ID`)가 없으면 503 `AUTH_UNAVAILABLE`.
   - `auth_identity(google, sub)`가 있으면 그 사용자로 로그인. 없으면 새 사용자를 만든다: 핸들은 자동(`g` + 영소문자·숫자 8자, 겹치면 다시), 닉네임은 임시 `손님`, `nickname_chosen_at`은 비움, `auth_identity` 연결.
   - 응답 200 `{token, expiresAt, newUser, user:{id, handle, nickname, avatar, needsNickname}}`. `needsNickname`은 닉네임을 아직 안 정했을 때 true이고 화면은 닉네임 정하기로 보낸다.
3. 토큰: 무작위 32바이트를 base64url로 만들어 한 번만 돌려주고, DB에는 해시만 저장한다. 유효 기간 30일(고정, 갱신 없음). 로그인할 때 그 사용자의 만료된 세션을 지운다.
4. `UserIdFilter`: `Authorization: Bearer <token>`을 해시해 만료 전 세션의 사용자로 인정한다. 없거나 틀리거나 만료면 401. **`X-User-Id` 헤더는 `dev` 프로파일에서만 받는다**(운영에서는 무시). 공개 경로에 `POST /auth/google`을 더한다.
5. `POST /auth/logout`(로그인 필요): 쓴 토큰의 세션을 지운다(204). 다른 기기의 토큰은 그대로.
6. `PUT /me/nickname`은 `nickname_chosen_at`을 채운다(처음 한 번). `GET /me`·`PUT /me/avatar` 응답에도 `needsNickname`이 들어간다.
7. 화면 주소의 CORS는 이미 모든 헤더를 허용한다(`Authorization` 포함).

## 열린 질문 (사용자 결정 필요)
- **가입 제한**: #55는 초대 링크 흐름을 말하지만, 계정 가입용 `invite_code`를 만들고 나눠 주는 방법이 정해지지 않았다. 지금은 구글 계정이 있으면 누구나 가입된다. 베타를 닫으려면 초대 코드 검사(`inviteCode` 필드)나 허용 목록을 더한다.
- **핸들**: 자동으로 만든다. 이웃집 방문에 쓰이므로 정하거나 바꾸는 API가 필요한지 정해야 한다.

## 테스트 (`ApiTestBase`, `TestClock`, 직접 만든 RSA 키)
새 사용자 로그인·재로그인(같은 사용자)·닉네임 정하기 / 잘못된 ID 토큰 여러 종류(aud·iss·exp·서명·alg none·HS256·kid·형식·sub 없음) / 클라이언트 ID 없음 503 / Bearer 규칙(없음·틀림·만료 30일·로그아웃·다른 기기) / 필터: 운영(dev 아님)에서는 `X-User-Id` 거절.

## 문서
`DATA_API.md`(계정·인증 API), `DECISIONS.md` #68, `README.md`, `AGENTS.md`.
