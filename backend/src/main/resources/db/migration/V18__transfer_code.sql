-- 기기 이전 코드 (결정 #85): 로그인한 기기가 만든 일회용 코드로 다른 기기가 같은 계정에 들어온다.
-- 코드 원문은 저장하지 않고 SHA-256(16진수 64자)만 둔다. 계정마다 하나(새로 만들면 바꾼다), 10분 뒤 만료(서버가 시각으로 확인).
CREATE TABLE transfer_code (
    user_id    bigint PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    code_hash  char(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL
);
