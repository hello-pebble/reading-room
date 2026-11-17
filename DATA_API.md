# 데이터와 API 설계

스택 가정: Java 21, Spring, jOOQ, Flyway, PostgreSQL.

## 테이블

### 계정

| 테이블 | 컬럼 | 제약 |
|---|---|---|
| `app_user` | id, handle, nickname, avatar(JSON), monthly_goal, status, beta_tester, created_at | handle unique (영소문자·숫자·`_`, 3~15자). monthly_goal은 1~99 |
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
| `shared_room` | id, created_by, kind(`SAME`/`OWN`), isbn, title, visibility(`INVITE`/`PUBLIC`), max_participants, invite_code, page_lock, open_at, close_at, status(`SCHEDULED`/`OPEN`/`CLOSED`), closed_at | 종료 후 7일. `isbn`은 `SAME`에서 필수, `OWN`은 비움. invite_code unique(8자리, 헷갈리는 글자 `I O 0 1` 제외). max_participants 2~30. `page_lock`은 `SAME`에서만 true 가능 |
| `room_participant` | room_id, user_id, book_id, joined_at, agreed_at(보관 동의), last_read_at, left_at | 종료 후 7일. unique(room_id, user_id). `book_id`는 이 방에서 내가 읽는 책 (`SAME`은 방의 책과 같은 ISBN, `OWN`은 내가 고른 책, 없을 수 있음). 가져오기는 `book_id`의 책에 붙인다 |
| `room_message` | id, room_id, user_id, content(최대 300자), page(같은 책 방, 1~9999, 없을 수 있음), created_at, deleted_at | 종료 후 7일. 삭제하면 `content`를 지우고 `deleted_at`을 채운다. 나간 사람의 글은 남긴다 (결정 #38) |
| `book_room_archive` | id, book_id, room_id, room_title, opened_at, closed_at, snapshot(JSON), imported_at | 영구. unique(book_id, room_id) |

### 마을 광장

| 테이블 | 컬럼 | 수명 |
|---|---|---|
| `plaza_message` | id, user_id, content(최대 40자), created_at | 24시간. 공유방 7일(`room_message`)보다 짧다. 책·방과 무관한 공개 대화라 `user_id`만 둔다. 신고·차단은 열린 결정 N 이후 |

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
| GET | `/books/search?q=` | 제목·저자·ISBN·책 링크로 검색 → `[{title, author, totalPages, isbn, coverUrl}]`. 서버가 알라딘(표지·쪽수)과 카카오 책 검색을 호출한다. 링크는 서버가 ISBN이나 서점 상품 번호를 해석해서 같은 책을 찾는다. API 키는 서버에만 둔다 |
| POST | `/books/{id}/notes` | 메모·인용구 |
| POST | `/books/{id}/finish` | 별점, 한줄평 → `DONE` (실행 중인 세션 자동 종료. 세션이 `NEEDS_CONFIRM`이면 409로 거절하고 확인을 먼저 요구한다. 확인 없이 닫는 경로는 `last_check_at`까지만 기록한다) |
| POST | `/books/{id}/drop` | `DROPPED` |

### 달력과 월 목표

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/me/calendar?month=YYYY-MM` | 생략하면 한국 시간 기준 이번 달. `{month, days, streak, finishedCount, goal, serverNow}` 반환 |
| PUT | `/me/goal` | body `{monthlyGoal}`. 1~99가 아니면 400. 같은 값을 다시 보내면 200 (멱등) |

- `monthly_goal`은 `app_user`의 컬럼이다. 기본 1, 사용자당 값 하나를 모든 달에 적용한다 (과거 달의 목표 이력은 두지 않는다).
- 마이그레이션: `ALTER TABLE app_user ADD COLUMN monthly_goal smallint NOT NULL DEFAULT 1 CONSTRAINT app_user_monthly_goal_range CHECK (monthly_goal BETWEEN 1 AND 99);`
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
| POST | `/rooms` | 모닥불 피우기(개설). body `{kind, isbn?, title?, visibility, maxParticipants, pageLock, openAt (생략하면 지금), days(3/7/14), bookId?}`. 개설자는 자동으로 참여자가 된다. 한 사용자가 동시에 열 수 있는 방(`SCHEDULED`·`OPEN`)은 2개, 넘으면 409. `SAME`인데 `isbn`이 없으면 400. `openAt`이 지금보다 앞서면 400 |
| GET | `/rooms/invite/{code}` | 초대 링크 미리보기 (방 이름, 종류, 책, 개설자 닉네임, 현재/최대 인원, 기간). 로그인 전에도 보여 준다 |
| POST | `/rooms/join` | body `{code, bookId?}`. 정원이 차면 409, 이미 참여 중이면 200 (멱등), 종료된 방이면 410 |
| POST | `/rooms/{id}/close` | 개설자만. `SCHEDULED`는 삭제(취소), `OPEN`은 `CLOSED`로 바꾸고 그날부터 7일 보관 |
| DELETE | `/rooms/{id}/participants/me` | 방 나가기. 내 글은 남고 익명("나간 참여자")으로 내려간다. 개설자는 나갈 수 없다(409) |
| POST | `/rooms/{id}/agree` | 보관 동의 기록(`agreed_at`). 동의 전에는 글 목록을 내려주지 않는다 (403) |
| GET | `/rooms/{id}/messages?after=` | 글 목록. **쪽수 잠금**이 켜진 방은 서버가 내 쪽수(또는 완독·포기 여부)로 판단해 잠긴 글의 `content`를 빼고 `page`만 내려준다. 다른 사람의 진행 퍼센트는 내려주지 않는다 |
| POST | `/rooms/{id}/messages` | 글 보내기. body `{content, page?}` (1~300자). 사용자당 5초에 1건(넘으면 429). `OPEN` 방과 내가 참여 중인 방만 |
| DELETE | `/rooms/{id}/messages/{mid}` | 내 글 삭제 (남의 글은 403) |
| POST | `/rooms/{id}/read` | 마지막으로 읽은 시각(`last_read_at`) 저장. 새 글 별(✦) 계산에 쓴다 |
| GET | `/rooms?status=` | 마을 게시판, 창문 소식. `PUBLIC` 방과 내가 참여한 방만 내려준다 |
| POST | `/rooms/{id}/import` | 스냅샷 생성 (다른 참여자 익명화). 내 책(`DONE`·`DROPPED`·`READING`)에 같은 ISBN이 없으면 `status=LATER`(나중에 읽을 책)로 책을 만들어 담는다. `LATER`는 완독 수·달력·해금에 세지 않고, 소파에 올리면 `READING`으로 바뀌며 스냅샷이 따라온다 |

### 마을 광장

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/plaza/messages?since=` | 최근 24시간 대화 (최대 30개). 광장 창을 열고 있는 동안 몇 초마다 다시 부르거나 SSE로 받는다 (실시간 방식은 서버 단계에서 결정) |
| GET | `/plaza/presence` | `{online, max}`. 마을 접속 인원과 정원(하단 `접속 (06/50)` 표시용). 접속은 연결(SSE/WebSocket) 수로 세고 DB에는 저장하지 않는다. 정원은 50명(기본값, 설정값)이고 가득 차면 마을 입장 연결이 409를 받아 "마을이 가득 찼어요" 안내를 띄운다. 초대 링크 입장자나 모닥불 참여자도 예외 없이 같다(링크는 그대로 유효). 내 방 API는 정원과 무관하다 (결정 #35). 화면에는 가까운 20명까지만 그린다 |
| POST | `/plaza/messages` | body `{content}` (1~40자, 앞뒤 공백 제거). 사용자당 5초에 1건 제한, 넘으면 429 |

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
