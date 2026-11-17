-- 웹 푸시 구독 (기기마다 한 행, 같은 endpoint는 덮어쓴다)
CREATE TABLE push_subscription (
    id         bigserial PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    endpoint   varchar(1000) NOT NULL UNIQUE,
    p256dh     varchar(255) NOT NULL,
    auth       varchar(255) NOT NULL,
    user_agent varchar(300),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscription_user ON push_subscription(user_id);

-- 알림 중복 발송 방지: 60분 확인은 last_check_at 값마다 한 번, 확인 필요는 NEEDS_CONFIRM 전환 때 한 번
ALTER TABLE reading_session
    ADD COLUMN check_notified_for  timestamptz,   -- 60분 확인 푸시를 보낸 last_check_at 값
    ADD COLUMN confirm_notified_at timestamptz;   -- 확인 필요 푸시를 보낸 시각
