# 모닥불 머문 시간 설계 (짧은 설계)

2026-11-19. 남은 일 순서 3 → **4** → 2 → 1 중 4번. 접근 B(별도 `camp_stay` 테이블)로 확정.

## 의도
공유방 장면(모닥불)에 머문 시간을 "오늘 읽은 시간"과 달력(독서한 날·연속일)에 더한다. 스탠드 기록과 겹치는 구간은 한 번만 센다(결정 #53).

## 하지 않는 것
- 화면 연결, 주기 신호(heartbeat), 새로고침·강제 종료로 못 닫은 입장의 시간 인정(규칙: 기록되지 않는다).
- 진행 중인 스탠드(RUNNING)의 시간 합산(화면이 실시간 타이머로 더한다).

## 접근
- A. `reading_session`에 CAMP 행: `book_id` NOT NULL·`source` CHECK·켜진 세션 1개 제한과 부딪히고, 스탠드가 나중에 `NEEDS_CONFIRM`·폐기로 잘리면 겹침 계산이 틀어진다. 제외.
- **B. 별도 `camp_stay` 테이블(선택)**: 서버 시각으로 입장·퇴장을 기록하고, 합산할 때 구간 합집합으로 겹침을 처리한다. 원본이 남아 스탠드 결과와 무관하게 맞다. DATA_API의 "reading_session(source=CAMP)" 표기는 이 결정(#65)으로 바꾼다.

## 설계
1. `V14__camp_stay.sql`: `camp_stay(id, user_id → app_user ON DELETE CASCADE, room_id(외래키 없음: 방이 7일 뒤 지워져도 시간은 남는다), entered_at, left_at)`. 사용자당 열린 입장(`left_at is null`)은 하나(부분 유니크). 저장된 입장은 1분 이상이어야 한다(CHECK).
2. `POST /rooms/{id}/stay` (입장, 201 `{roomId, enteredAt}`): 참여 중이고(`NOT_PARTICIPANT` 403) 보관 동의를 했고(`AGREE_REQUIRED` 403) 방이 열려 있어야 한다(예정 409 `ROOM_NOT_OPEN`, 종료 410 `ROOM_CLOSED`, 없음 404). 이 사용자의 **이전 열린 입장은 시간 없이 지운다**(새로고침·다른 방으로 이동 = 시간 인정 안 함).
3. `POST /rooms/{id}/stay/leave` (퇴장, 200 `{roomId, enteredAt, leftAt, minutes, credited}`): 이 방의 열린 입장을 닫는다(없으면 404 `NO_OPEN_STAY`). `leftAt = min(지금, 방 종료 시각)`(`closed_at` 있으면 그것, 없으면 `close_at`). 머문 시간이 **60초 미만이면 행을 지우고** `credited=false, minutes=0`, 아니면 저장하고 `minutes`는 초를 내림한 분.
4. `GET /me/reading-time?date=YYYY-MM-DD` (200 `{date, minutes, serverNow}`): 기본은 한국 시간 오늘. 미래 날짜는 400 `FUTURE`, 형식 오류는 400 `BAD_DATE`. 그 날(한국 시간 0시~24시)과 겹치는 `DONE` 스탠드·직접 기록 구간(`TIMER`/`MANUAL`)과 저장된 모닥불 입장 구간을 하루로 잘라 **구간을 합쳐(합집합)** 초를 더하고 분은 내린다. 열린 입장·진행 중 스탠드는 넣지 않는다.
5. 달력: `readingDays`에 저장된 입장의 `left_at`(한국 날짜)을 더한다 → 독서한 날·연속일에 들어간다.
6. 입장·퇴장 요청은 서버 시각만 쓴다(클라이언트 시각 무시).

## 테스트 (`ApiTestBase`, `TestClock`)
입장 조건 오류들 / 새로고침(재입장)하면 이전 입장 무효 / 1분 미만은 저장 안 됨 / 방 종료 시각으로 잘림 / 스탠드와 겹치면 한 번만 / 자정을 넘으면 날마다 잘림 / 달력 독서한 날 포함 / 합산 API 입력 검증.

## 문서
`DATA_API.md`(테이블·API·남은 일 메모), `DECISIONS.md` #65, `FEATURE_DEFINITION.md` RC-23, `README.md`, `AGENTS.md`.
