CREATE TABLE book_note (
    id         bigserial PRIMARY KEY,
    book_id    bigint NOT NULL REFERENCES book(id) ON DELETE CASCADE,
    type       varchar(10) NOT NULL CHECK (type IN ('MEMO','QUOTE')),
    content    text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
    page       integer CHECK (page BETWEEN 0 AND 9999),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_note_book ON book_note(book_id, created_at DESC);
