-- 공유방 대화 (docs/DATA_API.md 공유방 room_message, 결정 #38·#53)
-- 보낸 글은 삭제·수정하지 않으므로 수정 시각·삭제 표시 컬럼이 없다. 나간 사람의 글도 남긴다(user_id를 지우지 않는다).
CREATE TABLE room_message (
    id         bigserial PRIMARY KEY,
    room_id    bigint NOT NULL REFERENCES shared_room(id) ON DELETE CASCADE,
    user_id    bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    content    varchar(300) NOT NULL CHECK (length(btrim(content)) > 0),
    page       integer CHECK (page BETWEEN 1 AND 9999),
    created_at timestamptz NOT NULL
);
CREATE INDEX room_message_room ON room_message(room_id, id);
-- 사용자당 5초 1건 제한이 마지막 글을 빨리 찾도록
CREATE INDEX room_message_sender ON room_message(user_id, created_at DESC);
