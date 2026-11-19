-- 구글 로그인 세션 토큰과 닉네임 정함 표시 (docs/superpowers/specs/2026-11-19-google-login-design.md, 결정 #68)
-- 토큰 원문은 저장하지 않고 SHA-256 해시(16진수 64자)만 둔다. 30일 뒤 만료(고정).
CREATE TABLE auth_session (
    token_hash char(64) PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE INDEX auth_session_user ON auth_session(user_id);

-- 닉네임을 직접 정한 시각. 비어 있으면 아직 안 정한 것(구글로 막 가입해 임시 닉네임인 사용자)이라 화면이 닉네임 정하기로 보낸다.
ALTER TABLE app_user ADD COLUMN nickname_chosen_at timestamptz;
UPDATE app_user SET nickname_chosen_at = created_at;
