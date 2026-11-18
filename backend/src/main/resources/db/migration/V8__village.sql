-- 공유방(모닥불)과 참여자, 마을 광장 대화 (docs/DATA_API.md 공유방, 마을 광장)
CREATE TABLE shared_room (
    id               bigserial PRIMARY KEY,
    created_by       bigint NOT NULL REFERENCES app_user(id),
    kind             varchar(4) NOT NULL CHECK (kind IN ('SAME', 'OWN')),
    isbn             varchar(20),
    title            varchar(100) NOT NULL,
    visibility       varchar(10) NOT NULL DEFAULT 'INVITE' CHECK (visibility IN ('INVITE', 'PUBLIC')),
    max_participants integer NOT NULL DEFAULT 8 CHECK (max_participants BETWEEN 2 AND 10),
    invite_code      varchar(8) NOT NULL UNIQUE,
    open_at          timestamptz NOT NULL,
    close_at         timestamptz NOT NULL,
    status           varchar(10) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'OPEN', 'CLOSED')),
    closed_at        timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (close_at - open_at BETWEEN interval '1 hour' AND interval '7 hours'),
    CHECK (kind <> 'SAME' OR isbn IS NOT NULL)
);
CREATE INDEX shared_room_created_by ON shared_room(created_by);

CREATE TABLE room_participant (
    room_id      bigint NOT NULL REFERENCES shared_room(id) ON DELETE CASCADE,
    user_id      bigint NOT NULL REFERENCES app_user(id),
    book_id      bigint REFERENCES book(id) ON DELETE SET NULL,
    joined_at    timestamptz NOT NULL DEFAULT now(),
    agreed_at    timestamptz,
    last_read_at timestamptz,
    left_at      timestamptz,
    PRIMARY KEY (room_id, user_id)
);
CREATE INDEX room_participant_user ON room_participant(user_id);

CREATE TABLE plaza_message (
    id         bigserial PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    content    varchar(40) NOT NULL,
    created_at timestamptz NOT NULL
);
CREATE INDEX plaza_message_created ON plaza_message(created_at);
