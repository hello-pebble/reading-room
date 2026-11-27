# 공유방 개방·종료 배치 설계 (짧은 설계)

2026-11-19. 남은 일 순서 3 → 4 → 2 → 1 중 3번. 접속 인원(`/plaza/presence`)은 SSE로 하기로 정했고 별도 단계다.

## 의도
예정(`SCHEDULED`) 방이 `open_at`에 열릴 때 알림을 켠 사람과 개설자에게 푸시를 **한 번만** 보내고, `status` 열을 시각에 맞춘다. 화면·API는 이미 시각으로 상태를 계산하므로 배치가 늦거나 멈춰도 동작은 맞아야 한다(상태는 보조값).

## 하지 않는 것
- 실제 푸시 전송(1번), 푸시 메시지 모양 일반화(2번), 모닥불 머문 시간(4번), 7일 삭제·D-1 알림(별도).
- 화면 연결.

## 접근 (추천 A로 확정)
- A. `shared_room.open_notified_at` 열을 추가하고 1분 배치가 UPDATE ... RETURNING으로 선점(claim). 스탠드 알림(`check_notified_for`)과 같은 방식이라 배치가 겹쳐도 중복이 없다. **선택.**
- B. `status` 변화만으로 판단: 전송 실패·서버 중단 때 재시도 근거가 없어 제외.
- C. `room_alarm`에 `notified_at`: 개설자는 행이 없고 쿼리가 복잡해 제외.

## 설계
`now`는 SQL `now()`가 아니라 `clock.instant()`를 `?::timestamptz`로 바인딩한다(테스트의 `TestClock`이 먹도록, 기존 `NotificationService`·`RoomRepository.countLive`와 같다).

1. `V13__room_open_notify.sql`: `shared_room.open_notified_at timestamptz` 추가. **기존 방은 `update shared_room set open_notified_at = open_at where open_at <= now()`로 채운다**(배포 직후 옛 방에 푸시가 나가지 않게).
2. **즉시 열림 방**(개설 때 `openAt` 생략 = `open_at <= now`)은 푸시 대상이 아니다. `insertRoom`이 `open_at <= now`이면 `open_notified_at = now`로 넣는다(방금 연 개설자에게 "열렸어요"가 가지 않게).
3. 1분 배치(`app.scheduling.enabled`로 끌 수 있게, 기존 `NotificationBatch`와 같은 조건):
   - **개방**: 선점 조건은 `open_notified_at is null and open_at <= now` **뿐**이다(일찍 끝낸 방·시간이 지난 방도 표시되어 매분 다시 검사되지 않게). 선점하면서 `open_notified_at = now`로 쓰고, `status`는 `closed_at is null and close_at > now`일 때만 `'OPEN'`으로 바꾼다(CASE, 끝난 방이 OPEN으로 되돌아가지 않게). **푸시는 RETURNING 결과에서 `closed_at is null and close_at > now and open_at > now - 30분`일 때만** 보낸다(서버가 꺼져 있다 켜졌을 때 옛 알림이 쏟아지는 것을 막는다).
   - 선점과 푸시 대상(알림 켠 사람 + 개설자) 조회는 한 SQL(CTE `with c as (update … returning …) select …`)로 하고, 전송은 트랜잭션 밖에서 한다(기존 `NotificationService`와 같다).
   - **종료**: `status <> 'CLOSED'`이고 `closed_at is null and close_at <= now`인 방의 `status`를 `CLOSED`로 맞춘다. `closed_at`은 건드리지 않는다(`closed_at`은 일찍 끝낸 방만 가지며 보관 7일은 `closed_at` 없으면 `close_at` 기준).
4. 푸시 대상: 선점한 방마다 `room_alarm`에 있는 사용자 + 개설자(`union`, 중복 사용자는 한 번만). 나가면 `room_alarm`이 지워지므로 나간 사람은 이미 빠진다(`left_at is null` 조건은 안전장치). 다시 들어온 사람은 알림이 꺼진 채다(재입장은 `room_alarm`을 복구하지 않는다).
5. 이번에는 대상 목록 `(roomId, title, userId)`을 돌려주고, 전송은 지금의 `PushSender`(로그만 남김)로 한다. 개방 알림용 메시지 모양은 2번에서 일반화하므로 이번에는 대상 목록을 로그로 남기는 데까지만 한다(2번에서 `deliver` 경로에 합친다).
6. 선점 후 전송이 실패해도 다시 보내지 않는다(기존 규칙: 중복보다 누락).
7. **허용하는 누락·경계**: ① `open_at` 직전에 켠 알림이 배치 선점보다 늦게 커밋되면 푸시를 못 받는다. ② 배치가 선점·푸시한 직후, 아직 `open_at` 전이라고 본 취소 요청이 방을 지울 수 있다(경계 몇 초). ③ 30분 안에 서버를 다시 켜면 푸시가 늦게 간다(의도). ④ 개설자가 방을 닫는 `close()`와는 행 잠금으로 순서가 정해지며, 배치가 먼저면 푸시 직후 방이 닫힐 뿐이다.
8. 배치는 `NotificationBatch`에 같이 넣지 않고 같은 `@ConditionalOnProperty`를 단 새 `@Component`(`RoomOpenBatch`)로 둔다. 테스트는 서비스를 직접 부른다.

## 테스트 (`ApiTestBase`, `TestClock`)
- 개방 시각이 지나면 한 번만 선점되고 두 번째 실행은 비어 있다.
- 알림 켠 사람과 개설자만 대상이고, 나간 사람·알림 안 켠 참여자는 아니다. 중복 없음.
- 30분 넘게 지난 방은 대상이 없고 표시만 된다. 일찍 끝낸 방·종료된 방도 푸시 없음.
- 종료 시각이 지난 방의 `status`가 `CLOSED`가 되고 `closed_at`은 그대로다.
- 개방 전 방은 아무것도 안 바뀐다.

## 문서
`docs/DATA_API.md`(배치 표와 "남은 일 메모"), `README.md` 진행 상태, 결정 번호 추가(`docs/DECISIONS.md`: 30분 기준).
