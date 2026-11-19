-- 이웃집 책 추천 (docs/DATA_API.md 이웃집 책 추천, 결정 #49·#62)
-- 추천은 책의 제목·저자·표지·ISBN만 복사해 둔다(원본 책을 바꾸거나 지워도 영향 없음, 메모·평점·진행률은 복사하지 않는다).
-- to_user가 집 주인이다. 확인하면 confirmed_at을 기록하고(행은 남긴다) 집이 비어 다시 추천받을 수 있다.
CREATE TABLE neighbor_recommendation (
    id           bigserial PRIMARY KEY,
    to_user      bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    from_user    bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    isbn         varchar(20),
    title        varchar(200) NOT NULL CHECK (length(btrim(title)) > 0),
    author       varchar(200),
    cover_url    varchar(1000),
    created_at   timestamptz NOT NULL,
    confirmed_at timestamptz,
    CHECK (from_user <> to_user),
    CHECK (confirmed_at IS NULL OR confirmed_at >= created_at)
);
-- 집마다 미확인 추천은 한 권만: 동시에 두 사람이 꽂아도 하나만 들어간다
CREATE UNIQUE INDEX neighbor_recommendation_one_open ON neighbor_recommendation(to_user) WHERE confirmed_at IS NULL;
CREATE INDEX neighbor_recommendation_from ON neighbor_recommendation(from_user, created_at);
