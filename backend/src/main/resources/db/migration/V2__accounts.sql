-- 계정 (DATA_API.md '계정' 절)
CREATE TABLE app_user (
    id          bigserial PRIMARY KEY,
    handle      varchar(15) NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9_]{3,15}$'),
    nickname    varchar(30) NOT NULL,
    avatar      jsonb NOT NULL DEFAULT '{"color":"#f6f3ff","expr":"normal","face":"none","head":"none","prop":"book"}',
    status      varchar(20) NOT NULL DEFAULT 'ACTIVE',
    beta_tester boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_identity (
    id               bigserial PRIMARY KEY,
    user_id          bigint NOT NULL REFERENCES app_user(id),
    provider         varchar(20) NOT NULL,
    provider_user_id varchar(100) NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);

CREATE TABLE invite_code (
    code       varchar(32) PRIMARY KEY,
    created_by bigint REFERENCES app_user(id),
    max_uses   integer NOT NULL DEFAULT 1,
    used_count integer NOT NULL DEFAULT 0,
    expires_at timestamptz
);
