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

- **실제 브라우저 테스트(Playwright)**: `npx playwright install chromium`(처음 한 번) 뒤 `npm run e2e`. 데스크톱과 폰 두 화면에서 3D가 그려지는지, 화면이 넘치거나 겹치지 않는지, 실제 클릭·키보드 흐름(방, 마을, 미니맵, 광장 채팅창)과 모든 창에서 버튼 줄·카드·입력칸이 겹치거나 넘치지 않는지를 본다. 느려서(약 2분) 화면을 바꾼 작업에서만 돌린다. 좌표는 `PLAZA` 같은 상수를 읽어 쓴다.
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
- 인증은 게스트 로그인(기본, 가입 없음, `POST /auth/guest {deviceKey}`, 결정 #84) + Bearer 세션 토큰이다. 구글 로그인(`POST /auth/google`, 결정 #68)은 만들어 두었지만 화면은 쓰지 않는다: `Authorization: Bearer <토큰>`을 `UserIdFilter`가 확인한다. 개발용 `X-User-Id` 헤더와 `/dev/users`는 dev 프로파일에서만 된다(테스트가 이것을 쓴다). 책 검색(`GET /books/search`)과 `POST /auth/google`·`POST /auth/guest`·`POST /auth/transfer`(기기 이전 코드로 들어오기, 코드는 로그인한 기기가 `POST /me/transfer-code`로 만든다, 결정 #85)만 로그인 없이 열려 있다.
- 시간 규칙은 서버 `Clock`으로 계산하고(`Instant`, 응답은 UTC ISO), 날짜 자르기는 `Asia/Seoul`이다. 상태처럼 시각으로 알 수 있는 값은 저장값에만 기대지 말고 시각으로 계산한다(예: `BoardService`).
- 비밀 키(`NL_CERT_KEY`, `KAKAO_REST_KEY`, VAPID 등)는 환경변수로만 받는다. 코드·문서·커밋·로그에 값을 적지 않는다. 키가 없을 때는 503처럼 명확한 오류로 응답한다.

## 지금 상태와 다음 작업

- **배포:** 서버 jar가 화면까지 낸다(결정 #86). 운영은 오라클 VM 컨테이너 + Caddy + Supabase 서울, 주소 `https://readingroom.duckdns.org`(결정 #90, `docs/DEPLOY.md`). 자동 배포는 없고 `main` 머지 뒤 VM에서 `rr-deploy`로 다시 빌드해 교체한다. 버전 이름은 git 태그(GitHub 릴리스)에서 온다. 화면 설정은 `frontend/config.js`(프로토타입, 서버 없음)와 jar의 `static/config.js`(같은 주소 서버 연결)로 갈린다.
- **끝난 것:** 내 방, 책 검색(카카오 우선·국립중앙도서관 쪽수), 마을(광장 대화 300자·접속 인원 SSE), 공유방(개설·공개 범위·초대 코드 입장·대화·알림·가져오기·머문 시간·참여자 명단), 이웃집 책 추천, 게스트 시작·기기 이전 코드, 구글 로그인(서버만). 화면은 서버 연결 모드에서 이 기능을 쓴다(`api.js`·`account.js`·`books.js`·`sessions.js`·`calendar.js`·`plaza.js`·`rooms.js`·`rooms-chat.js`·`neighbor-server.js`). 거울 꾸미기·웹 푸시 구독은 서버 API만 있고 화면은 아직 `localStorage`다. 기능별 진행은 `README.md`, 규칙과 이력은 `docs/DECISIONS.md`, 끝난 설계서는 `docs/archive/`에 있다.
- **다음 작업(순서):** ① `PushSender` 메시지를 공유방 개방용으로 일반화하고 개방 배치(`RoomOpenBatch`)와 잇기 ② VAPID 실발송(웹 푸시 라이브러리 추가, 키는 환경변수만) ③ 마을 정원 100명을 넘으면 409(결정 #35). 정하지 않은 것: 가입 제한(초대 코드), 광장 신고·차단·금칙어(결정 #41 ④, 공개 가입 전).
- 한 번에 한 기능씩 만들고, 기능마다 통합 테스트를 추가한다.

## 작업 방식

- 코드를 고친 뒤 **커밋·푸시하기 전에 관련 문서를 먼저 최신으로 반영**하고, 코드와 문서를 한 커밋으로 묶어 푸시한다. 반영할 문서가 없으면 없다고 남긴다.
- 푸시할 브랜치는 작업을 시킨 사람이 정한 곳이다. 따로 말이 없으면 새 작업 브랜치로 올리고 `main`에 직접 푸시하지 않는다. 시작할 때 최신 `main`을 받아 온다.
- 이미 커밋된 다른 사람의 변경(특히 `docs/`, `frontend/`)은 되돌리지 않는다. 막히거나 결정이 필요하면 추측하지 말고 무엇이 필요한지 적어 알린다.
- 폴더 구조(결정 #57): 루트에는 `README.md`, `AGENTS.md`와 `backend/`, `frontend/`, `docs/`, `tests/`만 둔다. 임시 스크립트·결과물은 커밋하지 않는다.
