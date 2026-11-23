# 독서 공유방 작업 지침 (AI 에이전트용)

독서 기록·공유 웹서비스. 폴더는 `frontend/`(화면: `index.html`, `js/`, `css/`, `vendor/`), `backend/`(서버), `docs/`(기획·결정·API 문서), `tests/`(검사)다. 화면에서 `index.html`은 화면 뼈대, `js/room.js`는 내 방, `village.js`는 마을, `shared-room.js`는 공유방, `neighbor.js`는 이웃집 방문·책 추천 기능이다. `scene.js`는 공용 3D, 공용 상태·저장·모달·시작 순서는 `base·state·stage·render·panel·app.js`다. 큰 파일은 구역별로 나뉘어 있다(`room*.js`, `shared-*.js`). 순서는 `index.html`의 스크립트 태그를 따른다. CSS는 `common.css`(공용), `room.css`(내 방), `village.css`(마을), `shared-room.css`(공유방), `neighbor.css`(이웃집)로 나뉜다. 수정 위치는 `frontend/EDITING.md`를 본다. 설명과 결정은 한국어 문서에 있다.

## 검사 — 코드를 바꾸면 반드시 돌린다

```bash
npm install        # 처음 한 번 (jsdom 설치)
npm run verify     # 문법 검사 + 시나리오 테스트. 통과해야 커밋한다
```

| 명령 | 하는 일 |
|---|---|
| `npm run check` | `frontend/js/*.js`와 `frontend/*.html`의 인라인 스크립트가 문법 오류 없이 컴파일되는지 본다 |
| `npm test` | `tests/scenarios.test.js` — 페이지를 가상 브라우저(jsdom)에 올려 패널·버튼·저장 상태를 실제로 조작한다 (약 2초) |

- **실제 브라우저 테스트(Playwright)**: `npx playwright install chromium`(처음 한 번) 뒤 `npm run e2e`. 데스크톱과 폰 두 화면에서 3D가 그려지는지, 화면이 넘치거나 겹치지 않는지, 실제 클릭·키보드 흐름(방, 마을, 미니맵, 광장 채팅창)을 본다. 느려서(약 2분) 화면을 바꾼 작업에서만 돌린다. 좌표는 `PLAZA` 같은 상수를 읽어 쓴다.
- jsdom 테스트는 3D(three.js)를 올리지 않는다. 그래서 **3D 그림, 실제 터치, 알림 팝업, 화면 겹침**은 테스트가 못 본다. 화면이 바뀌는 일이면 브라우저로 직접 확인한다.
- 테스트는 페이지 안의 변수와 함수(`S`, `openF`, `endSession`, `plazaSend` …)를 `a.ev('...')`로 직접 부른다. 새 기능에는 같은 방식으로 테스트를 한두 개 추가한다 (`tests/load.js`의 `load()`가 로더).
- 결함을 고칠 때는 그 결함을 재현하는 테스트를 먼저 추가하고 고친다.

## 지킬 것

- **확정된 결정은 되돌리지 않는다.** `docs/DECISIONS.md`의 확정 표를 먼저 읽는다. 새로 확정하면 번호와 날짜를 붙여 추가한다.
- 기능을 바꾸면 문서를 같이 고친다: `docs/SPEC.md`, `docs/FEATURE_DEFINITION.md`, `docs/FEATURE_GUIDE.md`, 데이터·API가 바뀌면 `docs/DATA_API.md`, 진행 상태는 `README.md`.
- 가구는 6개 + 문, 방 크기는 사용 중 바뀌지 않는다, 알림은 노란 별만 쓴다 (빨간 점·숫자 금지).
- 상태는 `localStorage` 키 `myroom-proto-v1`의 객체 `S`. 저장 구조를 바꾸면 로드 직후에 이관 코드를 넣는다 (예: `if(!S.later)S.later=[]`).
- 날짜·시간은 한국 시간(`Asia/Seoul`) 기준이다 (달력, 오늘 읽은 시간, 완독일).
- 커밋 메시지와 사용자 응답은 한국어. 한 번에 하나의 작은 변경을 하고, 검사를 통과한 뒤에만 커밋한다.

## 백엔드 (`backend/`, Spring Boot + jOOQ + PostgreSQL)

- 요청은 `Controller → Service → Repository` 순서로 흐르고, 요청·응답은 기능 패키지의 `dto/` record다. 수정 위치와 패키지 표는 `backend/README.md`를 먼저 본다. SQL은 Repository에만 두고 값은 `?`로 바인딩한다. 스키마는 Flyway(`src/main/resources/db/migration/V*.sql`)로만 바꾸고 이미 있는 마이그레이션은 고치지 않는다(새 `V9__…` 추가).
- 검사: `cd backend && ./gradlew test`. DB가 필요한 통합 테스트(`ApiTestBase`)는 기본으로 내장 PostgreSQL(zonky)을 띄우고, 안 되면 `TEST_DATABASE_URL`(`jdbc:postgresql://…`), `TEST_DATABASE_USER`, `TEST_DATABASE_PASSWORD`로 외부 DB를 준다(테스트마다 스키마를 비운다). 루트 사용자로는 PostgreSQL이 실행되지 않으니 일반 사용자로 돌린다. 시각은 `TestClock`으로 고정·이동한다.
- API 계약은 `docs/DATA_API.md`가 기준이다. 경로·필드·상태 코드를 바꾸면 그 문서와 `docs/DECISIONS.md`를 같이 고친다. 오류는 `ApiException`(상태, 코드, 한국어 메시지)으로 던진다.
- 인증은 구글 로그인 + Bearer 세션 토큰이다(결정 #68): `Authorization: Bearer <토큰>`을 `UserIdFilter`가 확인한다. 개발용 `X-User-Id` 헤더와 `/dev/users`는 dev 프로파일에서만 된다(테스트가 이것을 쓴다). 책 검색(`GET /books/search`)과 `POST /auth/google`만 로그인 없이 열려 있다.
- 시간 규칙은 서버 `Clock`으로 계산하고(`Instant`, 응답은 UTC ISO), 날짜 자르기는 `Asia/Seoul`이다. 상태처럼 시각으로 알 수 있는 값은 저장값에만 기대지 말고 시각으로 계산한다(예: `BoardService`).
- 비밀 키(`NL_CERT_KEY`, `KAKAO_REST_KEY`, VAPID 등)는 환경변수로만 받는다. 코드·문서·커밋·로그에 값을 적지 않는다. 키가 없을 때는 503처럼 명확한 오류로 응답한다.

## 지금 상태와 다음 작업

- **끝난 것:** 내 방 API(책·메모·스탠드·직접 기록·완독/포기·거울·달력/월 목표·푸시 구독), 책 검색(국립중앙도서관, 키 발급·실제 응답 확인 완료, 결정 #82, 제목 검색은 카카오 우선 결정 #83), 마을 게시판 읽기 `GET /rooms`, 광장 채팅 `GET·POST /plaza/messages`(24시간 삭제 배치), 공유방 개설·입장·대화·읽음(`room`), 이웃집 책 추천(`neighbor`, 결정 #62). 화면은 주소 끝 `?api=http://localhost:8080`으로 켜는 서버 연결 모드에서 **개발용 로그인·닉네임·내 정보와 책·메모·완독/포기·스탠드 타이머·달력/월 목표·광장 대화·마을 게시판과 공유방 개설/입장/나가기/대화/알림/가져오기/머문 시간·이웃집 책 추천까지** 연결했고(`api.js`·`account.js`·`books.js`·`sessions.js`·`calendar.js`·`plaza.js`·`rooms.js`·`rooms-chat.js`·`neighbor-server.js`, 서버 `POST /dev/login`, 결정 #71~#73·#75~#81), 나머지 기능은 아직 `localStorage`로 동작한다(책 검색은 서버 연결 모드에서 서버 검색을 자동으로 쓰고, 서버 없이는 `?searchApi=`).
- **공유방 백엔드(`room` 패키지)는 단계별로 만든다.** 1단계(끝남): 개설·초대 미리보기·닫기(`V9__room.sql`, `room_open_log`, 결정 #59). 2단계(끝남): 입장 `POST /rooms/join`·나가기·보관 동의. 3단계(끝남): 대화 `GET·POST /rooms/{id}/messages`(300자, 3초 3건·같은 글 30초 연속 금지(#61), 삭제·수정 없음)·읽음 `POST /rooms/{id}/read`·게시판 `unread`(`V10__room_message.sql`, 결정 #60).
- 공유방 4단계(끝남): 알림 `PUT·DELETE /rooms/{id}/alarm`, 가져오기 `POST /rooms/{id}/import`·`GET /books/{id}/rooms`(`V12__room_alarm_archive.sql`, 결정 #63).
- 공유방 5단계(끝남): 개방·종료 배치 `RoomOpenService`·`RoomOpenBatch`(`open_notified_at` 선점, 30분 기준, `V13__room_open_notify.sql`, 결정 #64). 대상 선정까지이고 푸시는 로그만 남긴다. 설계: `docs/superpowers/specs/2026-11-19-room-open-batch-design.md`.
- 공유방 6단계(끝남): 모닥불 머문 시간 `CampStayService`(`POST /rooms/{id}/stay`·`stay/leave`)·합산 `GET /me/reading-time`·달력 반영(`camp_stay`, `V14__camp_stay.sql`, 결정 #65). 설계: `docs/superpowers/specs/2026-11-19-camp-stay-design.md`.
- 인증(끝남): 구글 로그인 `AuthService`·`GoogleIdTokenVerifier`·`UserIdFilter`(Bearer 토큰, 개발용 `X-User-Id`는 dev 프로파일만)·`V16__auth_session.sql`·`GOOGLE_CLIENT_ID`. 설계: `docs/superpowers/specs/2026-11-19-google-login-design.md`.
- **다음 작업(순서 정함, ①은 끝남): ② `PushSender` 메시지 모양을 공유방 개방용으로 일반화하고 개방 배치와 잇기 ③ VAPID 실발송(웹 푸시 라이브러리 추가, 키는 환경변수만) ④ 광장 접속 인원 `GET /plaza/presence`(연결 방식은 SSE로 정했다).** (앞 번호는 원래 순서다.) 7일 지난 방 삭제 배치는 끝났고(결정 #66), 가져오기 마감 알림·이웃 접속 상태는 만들지 않기로 했다. 닉네임 규칙(한글·영문·숫자 1~5자, `PUT /me/nickname`, 결정 #67)은 구현했고, 구글 로그인(`POST /auth/google`, Bearer 세션 토큰, `auth_session`, 결정 #68)도 구현했다. 핸들은 없고 사용자는 공개 번호(무작위 UUID, `app_user.public_id`)로 가리킨다(결정 #69). 가입 제한(초대 코드)은 정하지 않았다. 설계와 정하지 않은 점은 `docs/DATA_API.md` 끝의 "공유방 남은 일 메모"에 있다. 규칙은 `docs/SPEC.md`의 "공유방 개설"과 결정 #32·#33·#38·#41·#43·#53·#54·#56·#59·#60·#64·#65 를 따른다.
- 한 번에 한 기능씩 만들고, 기능마다 통합 테스트를 추가한다.

## 작업 방식

- 코드를 고친 뒤 **커밋·푸시하기 전에 관련 문서를 먼저 최신으로 반영**하고, 코드와 문서를 한 커밋으로 묶어 푸시한다. 반영할 문서가 없으면 없다고 남긴다.
- 푸시할 브랜치는 작업을 시킨 사람이 정한 곳이다. 따로 말이 없으면 새 작업 브랜치로 올리고 `main`에 직접 푸시하지 않는다. 시작할 때 최신 `main`을 받아 온다.
- 이미 커밋된 다른 사람의 변경(특히 `docs/`, `frontend/`)은 되돌리지 않는다. 막히거나 결정이 필요하면 추측하지 말고 무엇이 필요한지 적어 알린다.
- 폴더 구조(결정 #57): 루트에는 `README.md`, `AGENTS.md`와 `backend/`, `frontend/`, `docs/`, `tests/`만 둔다. 임시 스크립트·결과물은 커밋하지 않는다.
