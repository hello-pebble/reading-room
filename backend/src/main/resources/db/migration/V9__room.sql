-- 공유방(모닥불) 개설 (docs/DATA_API.md 공유방, 결정 #32·#41·#53·#54)

-- 초대 코드는 8자리이고 헷갈리는 글자 I O 0 1 을 쓰지 않는다
ALTER TABLE shared_room ADD CONSTRAINT shared_room_invite_code_format CHECK (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$');
-- 방 이름은 비울 수 없다 (비우면 서비스가 자동 이름을 넣는다)
ALTER TABLE shared_room ADD CONSTRAINT shared_room_title_not_blank CHECK (length(btrim(title)) > 0);

-- 개설 기록: 하루 3번 제한은 취소해도 센다. 예정 방을 취소하면 shared_room 행이 지워지므로
-- 세려면 방과 따로 남긴 기록이 있어야 한다. room_id는 방이 지워져도 남기려고 외래키를 걸지 않는다.
CREATE TABLE room_open_log (
    id        bigserial PRIMARY KEY,
    user_id   bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    room_id   bigint NOT NULL,
    opened_at timestamptz NOT NULL
);
CREATE INDEX room_open_log_user_day ON room_open_log(user_id, opened_at);
