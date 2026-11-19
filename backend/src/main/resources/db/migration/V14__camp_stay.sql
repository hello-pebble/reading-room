-- 모닥불(공유방 장면)에 머문 시간 (docs/superpowers/specs/2026-11-19-camp-stay-design.md, 결정 #65)
-- 서버 시각으로 입장·퇴장을 적고, 합산할 때 스탠드 기록과 구간 합집합으로 겹침을 한 번만 센다.
-- room_id에는 외래키를 걸지 않는다: 방이 종료 7일 뒤 지워져도 읽은 시간은 남아야 한다.
CREATE TABLE camp_stay (
    id         bigserial PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    room_id    bigint NOT NULL,
    entered_at timestamptz NOT NULL,
    left_at    timestamptz,                      -- 비어 있으면 아직 머무는 중(열린 입장)
    -- 저장된(닫힌) 입장은 1분 이상이다. 1분 미만은 행을 지운다
    CHECK (left_at IS NULL OR left_at >= entered_at + interval '1 minute')
);
-- 열린 입장은 사용자당 하나: 새로고침·다른 방 이동은 이전 입장을 시간 없이 지우고 새로 연다
CREATE UNIQUE INDEX camp_stay_one_open_per_user ON camp_stay(user_id) WHERE left_at IS NULL;
CREATE INDEX camp_stay_user_left ON camp_stay(user_id, left_at);
