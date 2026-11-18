# 데이터와 API 설계

스택 가정: Java 21, Spring, jOOQ, Flyway, PostgreSQL. **내 방 부분은 `backend/`에 구현됐다** (아래 "구현 상태와 차이").

## 이웃집 추천의 프로토타입 저장 (2026-11-18, 서버 미구현)

- `myroom-proto-v1`의 `S.recommendations`에 집 ID별 미확인 추천 한 권을 저장한다. 이전 저장 상태에는 빈 객체를 추가한다. 키 `neighbor-0`~`neighbor-7`은 시연용 이웃집이고 `me`는 내 집이다.
- 값은 `{from, book:{title,author,cover,isbn}, at}`다. `at`는 Unix 밀리초이며 표시 날짜는 한국 시간을 사용한다. 독서 메모·평점·진행률은 복사하지 않는다. 현재 읽는 책이나 완독 목록에서 선택한 순간의 책 정보만 복사한다.
- 이미 차 있는 집은 덮어쓰지 않으며, 집 주인이 확인하면 해당 키를 삭제한다. 원본 책 목록과 추천받은 사람의 독서 목록은 변경하지 않는다.
- 실제 사용자 간 API는 아직 없다. 서버 연결 때는 발신자의 책 소유·현재 상태, 받는 집의 빈 칸을 서버에서 검사하고 집별 미확인 한 권 제약을 원자적으로 보장해야 한다. 확인 처리는 수신자 본인만 허용한다. 프로토타입의 집 주인 시점 테스트 도구는 실제 인증 기능이 아니다.

## 백엔드 역할 분리 (2026-11-18)

`Controller`는 HTTP 입출력, `Service`는 검증·기능 규칙·트랜잭션, `Repository`는 jOOQ SQL 실행을 담당한다. 요청·응답은 각 기능의 `dto/` record로 선언한다. SQL은 Java에 직접 작성하고 값은 `?`로 바인딩한다. DB 스키마와 아래 API 계약은 유지한다. PATCH의 필드 생략/null과 숫자 타입 검사를 보존하기 위해 일부 요청 필드는 `JsonNode`를 사용한다. 수정 예시는 `backend/README.md`를 참고한다.

## 구현 상태와 차이 (`backend/`, 2026-11-17)

구현한 범위: 책 검색(`GET /books/search`, 국립중앙도서관, 인증키 설정 전에는 503)과 **마을 게시판 읽기(`GET /rooms`)·광장 채팅(`GET·POST /plaza/messages`, `village` 패키지, 테이블 `shared_room`·`room_participant`·`plaza_message`는 `V8__village.sql`)**, 내 방(책·메모·스탠드 타이머·직접 기록·완독/포기·거울 아바타·달력/월 목표·푸시 구독과 알림 대상 선정). **공유방 개설(`POST /rooms`)·초대 미리보기·닫기는 `room` 패키지(V9)로 구현했고, 입장(`POST /rooms/join`)·나가기·보관 동의·대화(`GET·POST /rooms/{id}/messages`)·읽음(`POST /rooms/{id}/read`)도 같은 패키지에 있다(테이블 `room_message`는 `V10__room_message.sql`). 공유방 가져오기, 개방·종료 배치, 광장 접속 인원(`/plaza/presence`), 구글 로그인·`room_alarm`·`invite_code` 사용 로직·실제 VAPID 전송·공유방/일 단위 배치는 아직 없다.** 아래는 이 문서의 설계와 구현이 다른 곳이다. 확정 규칙(결정 #16, #17, #24, #26, #36, #39, #41 등)은 바꾸지 않았다.

| 영역 | 구현 (이 문서와 다른 점) |
|---|---|
| 인증 | 로그인이 없어 **`X-User-Id` 헤더**로 사용자를 식별하는 임시 필터(`UserIdFilter`, 없으면 401). 구글 로그인(결정 #55)이 생기면 교체. `POST /dev/users`는 `dev` 프로파일에서만 열린다 |
| 시각 | 서버 `Clock`으로 `now()`를 정하고, 응답의 시각은 모두 UTC(`...Z`) ISO 문자열. 날짜 자르기(달력·월 목표·직접 기록)는 `Asia/Seoul` |
| 멱등키 | `Idempotency-Key` 헤더. `idempotency_key(user_id, key, path, status, body)`에 **성공 응답만** 저장하고 재전송이면 그대로 돌려준다. 같은 키를 다른 경로에 쓰면 422. 적용: `POST /books`, `/books/{id}/notes`, `/books/{id}/finish`, `/drop`, `/sessions/start`, `/{id}/stop`, `/{id}/check`, `/{id}/confirm`, `/sessions/manual`. (`PUT`·`PATCH`·구독 저장은 원래 멱등) |
| 아바타 | 표에 없던 **`PUT /me/avatar`**를 만들었다. 모르는 키는 버리고, 모르는 값·빠진 키는 기본값으로 채우며, **400은 해금 조건 미충족일 때만**(glasses는 책 1건 이상, beanie는 `DONE` 10권 이상). `GET /me`에 `avatar`가 들어 있다 |
| 책 | `GET /books?status=`, `GET /books/{id}`, `GET /books/{id}/notes`를 더했다. 전체 쪽수는 1~9999이고 0·음수는 비움, 9999 초과는 9999로 맞춘다(프로토타입과 같다). `PATCH`의 현재 쪽은 줄지 않고(작은 값은 무시) 전체 쪽수를 넘는 값도 그대로 저장하되 퍼센트만 100으로 막는다. **메모·스탠드 끄기·직접 기록·완독은 현재 쪽을 전체 쪽수까지만** 올리고 완독 때 넘은 값을 전체 쪽수로 줄인다. `percent`는 서버가 반올림해 내려준다. 포기한 책의 `finished_at`은 비운다. 메모·인용구 삭제 API는 아직 없다 |
| 세션 | `RUNNING`뿐 아니라 **`NEEDS_CONFIRM`도 사용자당 1개 인덱스에 포함**해(확인 필요 상태도 켜진 것), 그 사이 새로 켤 수 없다(409 + 기존 세션). 컬럼 추가: `memo`, `needs_confirm_at`(전환 시각), `check_notified_for`·`confirm_notified_at`(푸시 중복 방지). 켠 지 3시간이 넘은 `RUNNING`은 10분 배치를 기다리지 않고 **요청 시점에도** `NEEDS_CONFIRM`으로 바꾼다(`check`·`stop`·`GET /sessions/current` 등. 3시간 확인 우회 방지) |
| stop / confirm | `stop` 본문 `{endPage?, totalPages?(모르던 책만), memo?, endedBy?(LAMP/PIP/NOTIFICATION)}`. 메모는 세션과 책의 `MEMO` 노트로 남는다. `NEEDS_CONFIRM`에서 `stop`하면 `last_check_at`까지만 기록한다(1분 미만이면 `DISCARDED`). `confirm` 본문 `{until: LAST_CHECK \| MINUTES, minutes?, discard?}`: `LAST_CHECK`는 '계속'을 한 번도 안 눌렀으면 1시간으로 기록(프로토타입 [1시간 읽은 걸로 기록]), `MINUTES`는 1~600분이고 켠 뒤 지난 시간 안 |
| 직접 기록 | 본문 `{minutes(1~600), daysAgo(0·1) 또는 date(YYYY-MM-DD), endPage?, memo?}`. 선택한 한국 날짜 정오에 저장. 미래 날짜는 400. 소파에 `READING` 책이 있어야 한다 |
| 모닥불 시간 | 공유방 장면에 머문 시간은 `reading_session`(`source=CAMP`, `room_id`)으로 저장해 오늘 읽은 시간·달력에 더한다. 스탠드 기록과 겹치는 구간은 한 번만 센다. 방의 종료 시각까지만 센다 (결정 #53). 1분 미만은 저장하지 않는다 |
| 완독·포기 | `READING` 책만 가능(이미 처리된 책이면 같은 결과로 200, `LATER`는 409). 켜진 스탠드는 같이 끄고(1분 미만은 `DISCARDED`), `NEEDS_CONFIRM`이면 409 `NEEDS_CONFIRM`. 별점 0은 해제, 한줄평 500자까지 |
| 달력 | `streak`는 **이번 달 조회에서만 숫자**이고 지난 달은 `null`. 이번 달보다 뒤의 `month`는 400. `days`는 그 달 날짜만, `streak`는 전체 기록으로 계산. 확인용 **`GET /me/goal`**을 더했다(첫 조회 때 기본 1권 행 생성). `PUT /me/goal`이 같은 값이면 변경 기록을 늘리지 않는다. `changes`의 `at`은 한국 날짜(`YYYY-MM-DD`), 새 사용자의 첫 변경은 기본 1권에서 시작한다(`1→N`). `app_user.monthly_goal` 컬럼은 서버에 없었으므로 이관은 필요 없다 |
| 푸시 구독 | `POST` 본문은 브라우저 `PushSubscription` 그대로(`{endpoint, keys:{p256dh, auth}}`, 평평한 모양도 허용), endpoint는 `https://`. 다른 사용자가 같은 endpoint를 저장하면 그 기기의 주인이 바뀐다. `DELETE`는 `?endpoint=` 또는 본문 `{endpoint}`로 내 구독만 지우고 없어도 204 |
| 알림 선정 | 1분 배치(`NotificationBatch`)가 대상을 DB에서 먼저 "보냈음"으로 표시한 뒤 보낸다(`PushSender` 인터페이스, 구현은 로그만 남기는 `LogPushSender`). 60분 확인은 `last_check_at + 60분`을 **지났을 때**(정확히 60분은 아직)이고 `last_check_at` 값마다 한 번, 3시간을 넘긴 `RUNNING`은 제외. 확인 필요는 `NEEDS_CONFIRM` 전환 뒤 한 번. 보낼 기기가 없어도 선정(표시)은 되어 나중에 구독해도 지난 알림은 오지 않고, 표시 후 전송이 실패하면 다시 보내지 않는다(중복보다 누락). 전송이 `GONE`이면 구독 삭제. VAPID 키는 환경변수 `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT` |
| 배치 | 구현: 10분(`SessionBatch`, 3시간 초과 → `NEEDS_CONFIRM`), 1분(`NotificationBatch`, 60분 확인·확인 필요 푸시). `app.scheduling.enabled=false`로 끌 수 있다. 1시간(`PlazaBatch`, 24시간이 지난 광장 글 삭제). 나머지 배치(공유방 개방·종료·D-1 알림)는 없음 |
| 테스트 | `backend/`의 `./gradlew test` (실제 PostgreSQL: Docker 없으면 zonky embedded-postgres, 루트 사용자는 `TEST_DATABASE_URL`로 외부 DB 지정). 시간대가 달라도 같은 결과임을 `-Dtest.tz=America/Los_Angeles`로도 확인 |

## 테이블

### 계정

| 테이블 | 컬럼 | 제약 |
|---|---|---|
| `app_user` | id, handle, nickname, avatar(JSON), status, beta_tester, created_at | handle unique (영소문자·숫자·`_`, 3~15자). 월 목표는 `monthly_goal` 테이블(월별 이력, 결정 #39) |
| `auth_identity` | id, user_id, provider, provider_user_id, created_at | unique(provider, provider_user_id) |
| `invite_code` | code, created_by, max_uses, used_count, expires_at | |

`avatar` 예: `{"color":"#ffd6e4","expr":"happy","face":"glasses","head":"bow","prop":"mug"}` (3D 유령, 결정 #23)

| 필드 | 값 | 기본 | 해금 조건 |
|---|---|---|---|
| `color` | 유령 몸 색. 허용 색 8가지 중 하나 (`#f6f3ff` `#fff1d6` `#ffd6e4` `#cdf0e0` `#cfe4fb` `#e0d4fa` `#fff0a8` `#d9dce6`) | `#f6f3ff` | 없음 |
| `expr` | 표정: `normal` `happy` `surprised` `sleepy` `wink` | `normal` | 없음 |
| `face` | 얼굴 장식: `none` `glasses` `sunglasses` `bandaid` | `none` | `glasses`는 첫 책 기록 후 |
| `head` | 머리 장식: `none` `beanie` `bow` `crown` `sprout` | `none` | `beanie`는 완독 10권 이상 |
| `prop` | 손에 든 소품: `none` `book` `mug` `lantern` `balloon` | `book` | 없음 |

- 서버는 저장할 때 위 허용 값만 받고, 해금 조건을 만족하지 않는 값은 400으로 거절한다 (클라이언트 잠금은 표시용).
- 모르는 키와 값은 버리고 기본값으로 채운다. 새 항목을 추가해도 기존 데이터가 깨지지 않게 하기 위해서다.
- 이전 구조(`style`, `hair`, `skin`, `top`, `bottom`, `acc`)는 사용하지 않는다. 베타 전이라 이전 데이터는 옮기지 않고 기본값으로 시작한다. 프로토타입은 `expr`이 없는 저장 값을 기본 유령으로 바꾼다.
- 공유방, 마을, 이름표에는 이 JSON을 그대로 내려주고 클라이언트가 그린다 (이미지로 굽지 않는다).

### 책과 기록

| 테이블 | 컬럼 | 제약 |
|---|---|---|
| `book` | id, user_id, isbn, title, author, cover_url, total_pages, current_page, status(`READING`/`DONE`/`DROPPED`/`LATER`), rating, one_line_review, started_at, finished_at | `finished_at`은 `timestamptz`(연도 포함)이고 달력·월 완독 수는 `Asia/Seoul` 기준 연-월로 센다. 프로토타입의 `finishedAt`(`YYYY.M.DD`)은 이 값의 날짜 부분이다. `READING`은 사용자당 1개. 화면에서 `DROPPED`는 "포기한 책". 퍼센트는 저장하지 않고 `current_page ÷ total_pages`로 계산(100% 상한). `total_pages`가 없으면 퍼센트 없음. `current_page`는 줄지 않는다(메모에 더 작은 쪽을 적어도 유지) |
| `book_note` | id, book_id, type(`MEMO`/`QUOTE`), content, page, created_at | |
| `reading_session` | id, user_id, book_id, started_at, ended_at, last_check_at, status(`RUNNING`/`DONE`/`NEEDS_CONFIRM`/`DISCARDED`), source(`TIMER`/`MANUAL`), ended_by(`LAMP`/`PIP`/`NOTIFICATION`/`CONFIRM`/`FINISH`/`MANUAL`), start_page, end_page | `RUNNING`은 사용자당 1개 (부분 유니크 인덱스) |

### 공유방

| 테이블 | 컬럼 | 수명 |
|---|---|---|
| `shared_room` | id, created_by, kind(`SAME`/`OWN`), isbn, title, visibility(`INVITE`/`PUBLIC`), max_participants, invite_code, open_at, close_at, status(`SCHEDULED`/`OPEN`/`CLOSED`), closed_at | 종료 후 7일. `isbn`은 `SAME`에서 필수, `OWN`은 비움. invite_code unique(8자리, 헷갈리는 글자 `I O 0 1` 제외). max_participants 2~10 |
| `room_participant` | room_id, user_id, book_id, joined_at, agreed_at(보관 동의), last_read_at, left_at | 종료 후 7일. unique(room_id, user_id). `book_id`는 이 방에서 내가 읽는 책 (`SAME`은 방의 책과 같은 ISBN, `OWN`은 내가 고른 책, 없을 수 있음). 가져오기는 `book_id`의 책에 붙인다 |
| `room_message` | id, room_id, user_id, content(최대 300자), page(같은 책 방, 1~9999, 없을 수 있음), created_at | 종료 후 7일. 보낸 글은 삭제·수정하지 않는다(#53). 나간 사람의 글은 남긴다 (결정 #38). 방이 지워지면 함께 지워진다(`ON DELETE CASCADE`). DB도 내용 1~300자(공백만은 안 됨)·`page` 1~9999를 지킨다. 인덱스 `(room_id, id)`, `(user_id, created_at)` |
| `room_open_log` | id, user_id, room_id(외래키 없음), opened_at | 영구(사용자와 함께 삭제). 개설할 때마다 한 줄. 예정 방을 취소하면 `shared_room` 행이 지워지므로, "하루(한국 시간) 3번, 취소해도 센다"(#53)를 세려면 방과 따로 남긴 이 기록이 필요하다. 동시 2개는 이 기록이 아니라 `shared_room`을 시각으로 센다 (결정 #59) |
| `book_room_archive` | id, book_id, room_id, room_title, opened_at, closed_at, snapshot(JSON), imported_at | 영구. unique(book_id, room_id) |

### 마을 광장

| 테이블 | 컬럼 | 수명 |
|---|---|---|
| `plaza_message` | id, user_id, content(최대 40자), created_at | 24시간. 공유방 7일(`room_message`)보다 짧다. 책·방과 무관한 공개 대화라 `user_id`만 둔다. 신고·차단은 공개 가입 전에 만든다(#41) |

### 알림

| 테이블 | 컬럼 | 제약 |
|---|---|---|
| `push_subscription` | id, user_id, endpoint, p256dh, auth, user_agent, created_at | unique(endpoint). 기기마다 한 행. 전송이 404·410이면 삭제 |
| `room_alarm` | user_id, room_id, created_at | unique(user_id, room_id). 창문 [알림 받기]를 켜면 생성, 끄면 삭제 |

웹 알림(Notification)은 페이지를 열어 둔 동안만 오기 때문에, 창을 닫은 뒤에도 받으려면 서버가 웹 푸시(VAPID)로 보낸다. iOS 웹은 홈 화면에 추가한 경우에만 받을 수 있다. 앱은 같은 내용을 로컬 알림과 푸시로 보낸다.

### 꾸미기 (상용화 대비, 지금은 기본값만)

| 테이블 | 컬럼 | 지금 |
|---|---|---|
| `furniture_type` | code(`SHELF`,`CALENDAR`,`SOFA`,`MIRROR`,`WINDOW`,`LAMP`) | 코드 고정 |
| `room_furniture` | user_id, furniture_code, skin_id, pos_x, pos_y, rotation | skin_id=`default` |
| `skin` | id, furniture_code, name, unlock_rule | 기본 스킨 1행씩 |

기능은 `furniture_code`, 외형은 `skin_id`에 묶는다. 에셋은 몸체와 상태 레이어(소파·책, 스탠드·빛)를 분리하고, 앵커 포인트(책 놓는 자리, 앉는 자리, 빛 위치)는 메타데이터로 둔다.

## API (주요)

### 타이머

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/sessions/current` | 접속·화면 복귀 시 호출. `{session, serverNow}` 반환 → 클라이언트가 시계 차이 보정 |
| POST | `/sessions/start` | 이미 `RUNNING`이 있으면 409 + 기존 세션 |
| POST | `/sessions/{id}/stop` | end_page, memo. 서버에서 `ended_at = now()`. 1분 미만은 `DISCARDED`. 이미 `DONE`이면 200 (멱등) |
| POST | `/sessions/{id}/check` | [계속] → `last_check_at = now()` |
| POST | `/sessions/{id}/confirm` | `NEEDS_CONFIRM` 해결: until(`LAST_CHECK`/`MINUTES`)/discard |
| POST | `/sessions/manual` | 직접 기록 |

모든 쓰기 요청에 **멱등키**를 넣어 네트워크 재시도 시 중복 저장을 막는다. 클라이언트가 보낸 경과 시간은 받지 않는다.

**오프라인 기록**: 인터넷이 없어도 스탠드 켜기·끄기, 직접 기록, 메모, 쪽수 입력은 기기에 먼저 저장한다. 각 변경에 멱등키를 붙여 대기열에 쌓아 두고, 연결이 돌아오면 순서대로 서버에 보낸다. 같은 멱등키는 한 번만 반영하므로 재전송해도 중복되지 않는다. 시작 시각은 기기 시각으로 기록하고 서버가 받을 때 `serverNow`와의 차이를 보정한다. 책 검색과 공유방 소식처럼 서버가 있어야 하는 기능은 오프라인에서 직접 입력으로 대신한다.

### 책

| 메서드 | 경로 | 동작 |
|---|---|---|
| POST | `/books` | 소파에 올리기 (`READING`) |
| PATCH | `/books/{id}` | 현재 쪽(`currentPage`), 전체 쪽(`totalPages`). 퍼센트는 서버·클라이언트가 계산 |
| GET | `/books/search?q=` | 제목·저자·ISBN(10·13자리)·ISBN이 든 링크로 검색 → `[{title, author, totalPages, isbn, coverUrl}]` (최대 10개, 중복 ISBN 제거). 서버가 국립중앙도서관 ISBN 서지정보 API(`SearchApi.do`, 제목 → 없으면 저자 순, ISBN은 정확히)를 호출한다. 쪽수는 1~9999만 쓰고 없으면 `null`. 검색어가 비면·ISBN이 틀리면 400, 키가 없으면 503 `SEARCH_UNAVAILABLE`, 외부 실패면 502 `SEARCH_FAILED`. 인증키는 서버 환경변수 `NL_CERT_KEY`에만 둔다 (결정 #56). 지금은 `X-User-Id` 없이 열려 있다(구글 로그인 때 로그인 필요 + 호출 제한). 화면 주소는 `CORS_ORIGINS`로 허용한다 |
| GET | `/books?status=` · `/books/{id}` | 내 책 목록(상태별)·한 권. 남의 책은 404 |
| POST | `/books/{id}/notes` | 메모·인용구 (쪽을 적으면 현재 쪽이 더 클 때만 올라간다). `GET`으로 목록 |
| POST | `/books/{id}/finish` | 별점, 한줄평 → `DONE` (실행 중인 세션 자동 종료. 세션이 `NEEDS_CONFIRM`이면 409로 거절하고 확인을 먼저 요구한다. 확인 없이 닫는 경로는 `last_check_at`까지만 기록한다) |
| POST | `/books/{id}/drop` | `DROPPED` |

### 달력과 월 목표

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/me/calendar?month=YYYY-MM` | 생략하면 한국 시간 기준 이번 달. 지난 달도 조회할 수 있다. `{month, days, streak(이번 달만), finishedCount, goal(없으면 null), goalChanges, goalInherited, serverNow}` 반환 |
| PUT | `/me/goal` | body `{monthlyGoal}`. **이번 달 목표만** 바꾼다(지난 달은 바꿀 수 없다, 달 지정 없음). 1~99가 아니면 400. 같은 값을 다시 보내면 200 (멱등) |

- **월별 목표 이력 (결정 #39)**: `monthly_goal(user_id, year_month 'YYYY-MM', goal smallint 1~99, changes jsonb, updated_at)`, unique(`user_id`, `year_month`). `changes`는 `[{at, from, to}]`로 "목표를 바꿨어요" 표시에 쓴다. 같은 한국 날짜 안에서 여러 번 바꾸면 한 번의 변경으로 합치고, 처음 값으로 돌아오면 기록을 지운다.
- **조회 규칙**: 그 달의 행이 있으면 그 값, 없으면 그보다 이른 달 중 가장 최근에 정한 값을 이어받는다(`goalInherited: true`). 이어받기는 앞으로만 가므로 지난 달 값은 이번 달 변경에 영향받지 않는다. 가장 이른 행보다 앞선 달은 `goal: null`("목표 기록 없음"). 새 사용자는 첫 조회 때 이번 달 행을 기본 1권으로 만든다.
- **마이그레이션**: 기존 `app_user.monthly_goal` 값은 **이관한 달의 행으로만** 옮기고 이전 달은 행을 만들지 않는다(이전 달에 현재 값을 채우면 소급 문제가 다시 생긴다). 이관 뒤 `app_user.monthly_goal` 컬럼은 삭제한다.
- 새 테이블: `CREATE TABLE monthly_goal (user_id bigint NOT NULL REFERENCES app_user(id), year_month char(7) NOT NULL, goal smallint NOT NULL CHECK (goal BETWEEN 1 AND 99), changes jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, year_month));`
- 날짜는 모두 `Asia/Seoul` 기준으로 자른다. 서버가 계산해서 내려주고, 클라이언트는 다시 계산하지 않는다 (폰 시간대 차이 방지).
- `days`: 그 달에 독서한 날(`YYYY-MM-DD` 목록). 아래 둘 중 하나라도 있는 날이다.
  - `reading_session`이 `DONE`이고 `source`가 `TIMER`/`MANUAL`인 기록의 `ended_at` 날짜 (`RUNNING`·`NEEDS_CONFIRM`·`DISCARDED`는 제외)
  - `book`이 `DONE`인 `finished_at` 날짜
- `streak`: 오늘에 기록이 있으면 오늘부터, 없으면 어제부터 거꾸로 연속으로 기록이 있는 날 수. 같은 날 여러 번 읽어도 하루. 오늘도 어제도 없으면 0. 월과 상관없이 전체 기록으로 센다.
- `finishedCount`: 그 달에 `finished_at`이 속한 `DONE` 책 수. `DROPPED`는 제외. 화면은 `완독 {finishedCount}/{goal}권`으로 보여준다.
- 목표 달성 알림은 만들지 않는다 (달력에는 알림 표시가 없다, 결정 #24).

### 알림

| 메서드 | 경로 | 동작 |
|---|---|---|
| POST | `/me/push-subscription` | 알림 권한을 허용한 기기의 구독 정보 저장. 같은 endpoint면 덮어쓴다 (멱등) |
| DELETE | `/me/push-subscription` | 구독 해제 |
| PUT | `/rooms/{id}/alarm` | 공유방 알림 켜기 (`room_alarm` 생성). 이미 있으면 200 |
| DELETE | `/rooms/{id}/alarm` | 공유방 알림 끄기 |

보내는 알림은 아래 세 가지다. 알림을 누르면 앱·웹이 해당 화면(스탠드 창 또는 창문)을 연다.

| 알림 | 시점 | 제목 / 본문 |
|---|---|---|
| 60분 확인 | `RUNNING`이고 `last_check_at + 60분`이 지났을 때 (세션당 `last_check_at`마다 한 번) | 아직 읽고 있어요? / 『책』을 읽은 지 60분이 지났어요. 계속 읽고 있나요? |
| 확인 필요 | `NEEDS_CONFIRM`으로 바뀔 때 한 번 | 확인이 필요해요 / HH:MM에 켠 스탠드가 아직 켜져 있어요 |
| 공유방 개방 | `shared_room.open_at`이 되었을 때, `room_alarm`이 있는 사용자에게 한 번 | 이야기방이 열렸어요 / 방 제목 |

### 공유방

| 메서드 | 경로 | 동작 |
|---|---|---|
| POST | `/rooms` | 모닥불 피우기(개설). body `{kind, isbn?, title?, visibility(베타는 `INVITE`만, #41), maxParticipants(2~10), openAt (생략하면 지금), hours(1~7), bookId?}`. 개설자는 자동으로 참여자가 된다. 한 사용자가 동시에 열 수 있는 방(`SCHEDULED`·`OPEN`, 시각으로 계산)은 2개(`ROOM_LIMIT_LIVE`), 하루(한국 시간)에 개설할 수 있는 방은 3개(`ROOM_LIMIT_DAILY`, 취소해도 센다: `room_open_log`), 넘으면 409. **구현(`RoomController.create`)**: 201과 마을 게시판과 같은 방 한 줄(`inviteCode` 포함). `kind`는 `SAME`/`OWN`, `maxParticipants`·`hours`는 정수만(아니면 400), `visibility`는 생략 또는 `INVITE`(`PUBLIC`은 400), `OWN`이면 `isbn`은 무시하고 비운다. `bookId`는 내 책이어야 하고(없으면 404) `SAME`이면 그 책의 ISBN이 방의 `isbn`과 같아야 한다(400). 방 이름은 최대 100자이고 비우면 자동(`『책』 같이 읽기`는 `bookId` 책의 제목을 쓰고 없으면 `같이 읽기`, 각자 읽기는 `닉네임의 모닥불`). 초대 코드는 서버가 8자리(`I O 0 1` 제외)로 만든다 시간이 다 되면 서버가 방을 `CLOSED`로 바꾼다. `SAME`인데 `isbn`이 없으면 400. `openAt`이 지금보다 앞서면 400 |
| GET | `/rooms/invite/{code}` | 초대 링크 미리보기 (방 이름, 종류, 책, 개설자 닉네임, 현재/최대 인원, 기간). 로그인 전에도 보여 준다. **구현**: `X-User-Id` 없이 열리고(`UserIdFilter` 예외, GET만) 코드는 대소문자를 가리지 않는다. 응답 `{title, kind, isbn, bookTitle, status, ownerNickname, participants, maxParticipants, openAt, closeAt, closedAt}`(방 id·초대 코드·참여자 목록은 없다). 종료된 방은 `status`가 `CLOSED`로 보이고, 없거나(취소 포함) 보관 7일이 지난 방은 404 |
| POST | `/rooms/join` | body `{code, bookId?}`. 정원이 차면 409, 이미 참여 중이면 200 (멱등), 종료된 방이면 410. **구현**: 새로 들어오면 201, 응답은 방 한 줄(게시판과 같은 모양, `inviteCode`는 개설자에게만). 코드는 대소문자·앞뒤 공백을 가리지 않고, 없는(취소 포함) 코드는 404, 비어 있으면 400. 예정(`SCHEDULED`) 방도 들어올 수 있다. 정원 검사는 방 행을 잠가 동시에 와도 넘지 않는다(`ROOM_FULL`). 종료(일찍 끝냄·시간 지남)는 `ROOM_CLOSED` 410. `bookId`는 내 책이어야 하고(404) 같은 책 방이면 방의 `isbn`과 같아야 한다(400, 책은 없어도 된다). 나갔다 다시 들어오면 같은 행을 되살리고 `left_at`·`agreed_at`을 비운다(동의를 다시 받는다). 정원이 찼으면 다시 들어올 수 없다 |
| POST | `/rooms/{id}/close` | 개설자만. `SCHEDULED`는 삭제(취소), `OPEN`은 `CLOSED`로 바꾸고 그날부터 7일 보관. **구현**: 응답 `{id, result(CANCELED/CLOSED), closedAt}`. 개설자가 아니면 403(`NOT_OWNER`), 없으면 404, 이미 끝난 방(일찍 끝냄·시간 지남)은 409(`ROOM_ALREADY_CLOSED`). 취소해도 `room_open_log`는 남는다 |
| DELETE | `/rooms/{id}/participants/me` | 방 나가기. 내 글은 남고 익명("나간 참여자")으로 내려간다. 개설자는 나갈 수 없다(409). **구현**: 204, 개설자 `OWNER_CANNOT_LEAVE` 409, 방이 없거나 참여 중이 아니면(이미 나간 경우 포함) 404. 행은 지우지 않고 `left_at`만 기록한다 |
| POST | `/rooms/{id}/agree` | 보관 동의 기록(`agreed_at`). 동의 전에는 글 목록을 내려주지 않는다 (403). **구현**: 응답 `{roomId, agreedAt}`. 참여 중인 사람만(아니면 403, 나간 사람 포함), 방이 없으면 404, 다시 눌러도 처음 동의한 시각을 그대로 돌려준다 |
| GET | `/rooms/{id}/messages?after=` | 글 목록. 삭제하지 않은 글은 모두 내려준다(쪽수 잠금은 #43으로 없어졌다). 다른 사람의 진행 퍼센트는 내려주지 않는다. **구현**: `after`는 마지막으로 본 **글 id**(숫자, 아니면 400). 있으면 그 다음 글부터 오래된 순으로 최대 100개, 없으면 가장 최근 100개를 오래된 순으로 준다. 응답 `[{id, userId, handle, nickname, avatar, content, page, createdAt, mine, left}]`. 나간 사람의 글은 남고 `userId`·`handle`·`avatar`가 없고 `nickname`이 `나간 참여자`, `left`가 true다(다시 들어오면 이름으로 돌아온다). 방이 없거나 보관 7일이 지났으면 404, 참여 중이 아니면 403(`NOT_PARTICIPANT`), 보관 동의 전이면 403(`AGREE_REQUIRED`). 종료된 방도 보관 7일 동안은 읽을 수 있다 |
| POST | `/rooms/{id}/messages` | 글 보내기. body `{content, page?}` (1~300자). 사용자당 3초에 3건·같은 글 30초 연속 금지(#61, 넘으면 429 `TOO_FAST`, 같은 글은 409 `DUPLICATE_MESSAGE`). `OPEN` 방과 내가 참여 중인 방만. **구현**: 201과 글 한 줄(위와 같은 모양). 글자 수는 코드포인트로 세고(이모지 한 글자) 공백만 있거나 없으면 400(`BAD_CONTENT`), 앞뒤 공백은 그대로 둔다. `page`는 같은 책(`SAME`) 방에서만 1~9999 정수이고, 각자 읽기 방에서 주면 400(`PAGE_NOT_ALLOWED`), 범위·형식이 틀리면 400(`BAD_PAGE`). 도배 제한(`ChatRate`)은 **방과 상관없이 사용자당**이고 광장과는 따로 센다: ① 내 글이 3초 안(`created_at > 지금-3초`)에 이미 3건이면 429 `TOO_FAST`(첫 글이 3초 밖으로 나가는 순간 한 자리가 난다) ② 내 **직전 글**과 같고(앞뒤 공백 무시) 30초 안이면 409 `DUPLICATE_MESSAGE`(직전 글이 아니라 그 앞 글과 같은 것은 된다). 동시에 보내도 사용자 잠금으로 한 줄씩 검사해 3건을 넘지 않는다. 검사 순서: 방(404) → 참여(403) → 동의(403) → 상태(`SCHEDULED`는 409 `ROOM_NOT_OPEN`, 종료는 410 `ROOM_CLOSED`) → 내용(400) → 3초 3건(429) → 같은 글(409). 막힌 요청은 저장하지 않아 횟수에도 세지 않는다 |
| ~~DELETE~~ | ~~`/rooms/{id}/messages/{mid}`~~ | 폐지 (#53). 보낸 글은 삭제·수정하지 않는다 |
| POST | `/rooms/{id}/read` | 마지막으로 읽은 시각(`last_read_at`) 저장. 새 글 별(✦) 계산에 쓴다. **구현**: 응답 `{roomId, lastReadAt}`(서버 시각). 참여 중인 사람만(아니면 403), 방이 없거나 보관 7일이 지났으면 404, 종료된 방도 보관 기간 안에는 된다. 동의 전에도 저장은 되지만 글 목록은 못 본다 |
| GET | `/rooms?status=` | 마을 게시판, 창문 소식. 내가 만들었거나 참여 중(나가지 않은)인 방만 내려준다(베타는 공개 방이 없다, #41). 응답 `[{id, kind, title, isbn, status, openAt, closeAt, closedAt, deleteAt, participants, maxParticipants, mine, joined, agreed, unread, ownerNickname, inviteCode(개설자에게만)}]`(`unread`: 참여 중이고 마지막으로 읽은 뒤(읽은 적 없으면 처음부터) **다른 사람의** 새 글이 있으면 true = 새 글 별 ✦. 내 글은 별을 만들지 않는다). **`status`는 저장값이 아니라 시각으로 계산**한다(`closedAt`이 있거나 `closeAt`이 지났으면 `CLOSED`, `openAt` 전이면 `SCHEDULED`, 아니면 `OPEN`). 종료 방은 종료 시각(일찍 끝냈으면 `closedAt`)부터 7일 동안만 내려가고 `deleteAt`이 그 시각이다. 순서: 열린 방(최근에 연 것) → 예정 방(곧 열릴 것) → 지난 방(최근에 끝난 것). `status`가 `SCHEDULED·OPEN·CLOSED`가 아니면 400 |
| POST | `/rooms/{id}/import` | 스냅샷 생성 (다른 참여자 익명화). 삭제된 글만 빼고 `page`와 함께 저장하며(`room_type`도 스냅샷에 담는다), 책의 공유방 탭은 모든 글을 그대로 내려준다. 내 책(`DONE`·`DROPPED`·`READING`)에 같은 ISBN이 없으면 `status=LATER`(나중에 읽을 책)로 책을 만들어 담는다. `LATER`는 완독 수·달력·해금에 세지 않고, 소파에 올리면 `READING`으로 바뀌며 스냅샷이 따라온다 |

### 마을 광장

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/plaza/messages?since=` | 최근 24시간 대화. `since`(ISO 시각, 예 `2026-11-18T03:00:00Z`)가 없으면 가장 최근 30개, 있으면 그 이후 글을 오래된 순으로 최대 30개(24시간보다 오래된 `since`는 24시간 전으로 본다). 응답 `[{id, userId, handle, nickname, avatar, content, createdAt}]`, 잘못된 `since`는 400. 광장 안(채팅창이 떠 있는 동안)에서 몇 초마다 다시 부르거나 SSE로 받는다 (실시간 방식은 서버 단계에서 결정) |
| GET | `/plaza/presence` | `{online, max}`. 마을 접속 인원과 정원(하단 `접속 (06/100)` 표시용). 접속은 연결(SSE/WebSocket) 수로 세고 DB에는 저장하지 않는다. 정원은 100명(기본값, 설정값)이고 가득 차면 마을 입장 연결이 409를 받아 "마을이 가득 찼어요" 안내를 띄운다. 초대 링크 입장자나 모닥불 참여자도 예외 없이 같다(링크는 그대로 유효). 내 방 API는 정원과 무관하다 (결정 #35). 화면에는 가까운 20명까지만 그린다 |
| POST | `/plaza/messages` | body `{content}` (1~40자, 앞뒤 공백 제거, 글자는 코드 포인트 기준). 사용자당 3초에 3건·같은 글 30초 연속 금지(#61, 공유방 대화와 같은 `ChatRate`이지만 따로 센다. 같은 사람의 동시 전송은 DB 잠금으로 한 줄로 세운다), 넘으면 429 `TOO_FAST`, 같은 글은 409 `DUPLICATE_MESSAGE`. 성공하면 201과 만든 글 |

## 배치 작업 (`@Scheduled`)

| 주기 | 작업 |
|---|---|
| 1분 | `status='RUNNING' AND last_check_at + 60분 < now()` 이고 아직 안 보낸 세션 → 60분 확인 푸시 |
| 1분 | `status='NEEDS_CONFIRM'`으로 막 바뀐 세션 → 확인 필요 푸시 |
| 1분 | `shared_room.open_at <= now()` 이고 아직 안 보낸 방 → `room_alarm` 사용자에게 개방 푸시. 상태는 `SCHEDULED`→`OPEN`. 개설자는 `room_alarm` 없이도 받는다 |
| 1분 | `status='OPEN' AND close_at <= now()` → `CLOSED`, `closed_at = now()` (이때부터 7일 보관) |
| 10분 | `status='RUNNING' AND started_at + 3h < now()` → `NEEDS_CONFIRM` |
| 매일 새벽 | `closed_at + 7일 < now()` 공유방 하드 삭제 (일찍 끝낸 방도 끝낸 날부터 7일. 예정 종료일 `close_at` 기준이 아니다) (메시지 → 참여자 → 방) |
| 1시간 | `plaza_message.created_at + 24h < now()` 하드 삭제 |
| 매일 | 가져오기 마감 D-1 알림 |

## 클라이언트 타이머 표시 (웹)

```js
let session = null, offset = 0; // offset = 서버시각 - 폰시각
async function sync() {
  const res = await fetch('/sessions/current').then(r => r.json());
  offset = Date.parse(res.serverNow) - Date.now();
  session = res.session;
  if (session?.status === 'NEEDS_CONFIRM') openConfirmSheet(session);
  renderLamp();
}
const elapsedSec = () => session ? Math.floor((Date.now() + offset - Date.parse(session.startedAt)) / 1000) : 0;
setInterval(() => session && renderTimer(elapsedSec()), 1000);   // 표시만
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sync());
window.addEventListener('pageshow', sync);
sync();
```

## 공유방 남은 일 메모 (2026-11-18)

공유방 서버는 개설·입장·대화·읽음까지 `room` 패키지에 구현됐다(결정 #59·#60). 아래는 남은 일이다. 아직 코드는 없다.

- **가져오기 `POST /rooms/{id}/import`**: 테이블 `book_room_archive`가 아직 없다(`V11__…`로 만든다). 스냅샷은 `room_message`를 `page`와 함께 담고 다른 참여자는 익명화한다. 내 책(`DONE`·`DROPPED`·`READING`)에 같은 ISBN이 없으면 `status=LATER` 책을 만든다. 가져오기 마감은 방 종료 후 7일이고, 지우는 배치보다 먼저여야 한다. 가져오기는 보관 동의(`agreed_at`)한 참여자만 할 수 있게 하자고 제안한다.
- **개방·종료 배치(1분)**: `SCHEDULED`→`OPEN`으로 `status` 열 갱신과 개방 푸시(`room_alarm` 사용자와 개설자). 지금은 화면·API 모두 시각으로 상태를 계산하므로 배치가 늦거나 없어도 동작은 맞고, `status` 열은 보조값이다. `close_at`이 지난 방의 `status`를 `CLOSED`로 맞추는 것도 같은 배치에서 한다(일찍 끝낸 방은 `closed_at`이 이미 있다).
- **하드 삭제(매일 새벽)**: `closed_at`(없으면 `close_at`) + 7일이 지난 방을 지운다. 글(`room_message`)·참여자는 `ON DELETE CASCADE`로 함께 지워진다. `room_open_log`는 방을 지워도 남겨야 하므로(하루 3번 제한) 이 배치가 지우지 않는다.
- **`room_alarm`**(창문 알림 켜기 `PUT·DELETE /rooms/{id}/alarm`), **모닥불 머문 시간**(`reading_session`, `source=CAMP`, `room_id`, 종료 시각까지만 센다, 오늘 읽은 시간·달력에 합산)은 별도 작업이다.
- **정하지 않은 것**: `app_user`를 지울 때 글을 지울지 익명으로 남길지(지금은 `ON DELETE CASCADE`로 함께 지워진다). 재입장하면 보관 동의를 다시 받으므로 화면은 재입장 때 동의 고지를 다시 띄워야 한다. 나간 동안의 글은 재입장 후에도 보인다.
- **테스트 요령**: `ApiTestBase`가 `TestClock`(기준 `2026-11-17T03:00:00Z`)과 `truncate app_user ... cascade`를 쓰므로 `app_user`에서 외래키로 이어진 새 테이블은 자동으로 비워진다. 방은 `RoomOpenTest`·`RoomJoinTest`·`RoomChatTest`의 `open(...)`처럼 API로 열면 규칙이 그대로 지켜진다. 글은 5초 제한 때문에 `clock.advance`로 시각을 옮겨 가며 보낸다.
