-- 책 (DATA_API.md '책과 기록'). 퍼센트는 저장하지 않고 current_page ÷ total_pages로 계산한다.
CREATE TABLE book (
    id              bigserial PRIMARY KEY,
    user_id         bigint NOT NULL REFERENCES app_user(id),
    isbn            varchar(20),
    title           varchar(200) NOT NULL,
    author          varchar(200),
    cover_url       varchar(1000),
    total_pages     integer CHECK (total_pages BETWEEN 1 AND 9999),
    current_page    integer NOT NULL DEFAULT 0 CHECK (current_page >= 0),
    status          varchar(10) NOT NULL CHECK (status IN ('READING','DONE','DROPPED','LATER')),
    rating          smallint CHECK (rating BETWEEN 1 AND 5),
    one_line_review varchar(500),
    started_at      timestamptz,
    finished_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_user_status ON book(user_id, status);
-- READING은 사용자당 1개
CREATE UNIQUE INDEX book_one_reading_per_user ON book(user_id) WHERE status = 'READING';
