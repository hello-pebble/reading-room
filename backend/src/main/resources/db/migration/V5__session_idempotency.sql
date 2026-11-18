-- 스탠드 타이머 세션 (DATA_API.md reading_session)
CREATE TABLE reading_session (
    id               bigserial PRIMARY KEY,
    user_id          bigint NOT NULL REFERENCES app_user(id),
    book_id          bigint NOT NULL REFERENCES book(id),
    started_at       timestamptz NOT NULL,
    ended_at         timestamptz,
    last_check_at    timestamptz NOT NULL,
    status           varchar(15) NOT NULL CHECK (status IN ('RUNNING','DONE','NEEDS_CONFIRM','DISCARDED')),
    source           varchar(10) NOT NULL CHECK (source IN ('TIMER','MANUAL')),
    ended_by         varchar(15) CHECK (ended_by IN ('LAMP','PIP','NOTIFICATION','CONFIRM','FINISH','MANUAL')),
    start_page       integer,
    end_page         integer,
    memo             varchar(500),
    needs_confirm_at timestamptz,          -- NEEDS_CONFIRM으로 바뀐 시각 (푸시 중복 방지에 쓴다, US-012·US-013)
    created_at       timestamptz NOT NULL DEFAULT now()
);
-- 켜진 스탠드는 사용자당 1개. 3시간을 넘겨 확인이 필요한 세션(NEEDS_CONFIRM)도 켜진 것으로 보므로 함께 막는다 (SPEC: 확인 필요 상태에서도 켜진 것)
CREATE UNIQUE INDEX reading_session_one_active_per_user ON reading_session(user_id) WHERE status IN ('RUNNING','NEEDS_CONFIRM');
CREATE INDEX reading_session_user_ended ON reading_session(user_id, ended_at);
CREATE INDEX reading_session_book ON reading_session(book_id);

-- 멱등키: 같은 (사용자, 키)의 성공 응답을 저장해 재전송 때 그대로 돌려준다
CREATE TABLE idempotency_key (
    user_id    bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    key        varchar(100) NOT NULL,
    path       varchar(200) NOT NULL,
    status     integer NOT NULL,
    body       jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, key)
);
