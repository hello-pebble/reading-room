-- 공유방 알림과 가져오기 (docs/DATA_API.md 공유방 room_alarm·book_room_archive, 결정 #36·#63)

-- 창문 [알림 받기]: 예정 방이 열릴 때 알려 받을 사용자. 방이 지워지면(취소·7일 삭제) 함께 지워진다.
CREATE TABLE room_alarm (
    user_id    bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    room_id    bigint NOT NULL REFERENCES shared_room(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (user_id, room_id)
);
CREATE INDEX room_alarm_room ON room_alarm(room_id);

-- 내 서재로 가져오기: 종료된 공유방 대화의 스냅샷. 영구 보관이라 방(room_id)이 7일 뒤 지워져도 남도록 방에는 외래키를 걸지 않는다.
-- 다른 참여자는 스냅샷 안에서 "참여자 A"처럼 익명이라 사용자 id가 들어 있지 않다. 책이 지워지면 함께 지워진다.
CREATE TABLE book_room_archive (
    id          bigserial PRIMARY KEY,
    user_id     bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    book_id     bigint NOT NULL REFERENCES book(id) ON DELETE CASCADE,
    room_id     bigint NOT NULL,
    room_title  varchar(100) NOT NULL CHECK (length(btrim(room_title)) > 0),
    opened_at   timestamptz NOT NULL,
    closed_at   timestamptz NOT NULL,
    snapshot    jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
    imported_at timestamptz NOT NULL,
    UNIQUE (book_id, room_id),
    -- 한 사람은 한 방을 한 번만 가져온다 (다시 요청하면 이미 가져온 것을 돌려준다)
    UNIQUE (user_id, room_id)
);
CREATE INDEX book_room_archive_book ON book_room_archive(book_id, imported_at DESC);
