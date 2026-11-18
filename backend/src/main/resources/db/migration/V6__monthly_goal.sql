-- 월 완독 목표 이력 (결정 #39, DATA_API.md 그대로)
CREATE TABLE monthly_goal (user_id bigint NOT NULL REFERENCES app_user(id), year_month char(7) NOT NULL, goal smallint NOT NULL CHECK (goal BETWEEN 1 AND 99), changes jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, year_month));
