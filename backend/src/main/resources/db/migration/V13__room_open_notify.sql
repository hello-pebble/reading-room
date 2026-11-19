-- 공유방 개방 알림을 한 번만 보내기 위한 표시 (docs/superpowers/specs/2026-11-19-room-open-batch-design.md)
-- 개방 배치(1분)가 이 열을 먼저 채워(claim) 중복 알림을 막는다. 개설 때 이미 열려 있는 방은 개설 시각으로 채운다.
ALTER TABLE shared_room ADD COLUMN open_notified_at timestamptz;

-- 이미 열린 기존 방은 배포 직후 옛 알림이 나가지 않게 채워 둔다
UPDATE shared_room SET open_notified_at = open_at WHERE open_at <= now();
