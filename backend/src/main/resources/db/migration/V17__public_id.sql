-- 핸들을 없애고 사용자를 가리키는 공개용 번호(무작위 UUID)를 둔다 (결정 #69).
-- 다른 사람에게 보이는 값(광장·공유방 글 작성자, 이웃집 주소)은 이 번호이고, 순번인 내부 id와 사용자가 정한 핸들은 밖으로 나가지 않는다.
-- 기존 사용자도 이 문장으로 각자 다른 무작위 번호를 받는다(gen_random_uuid()는 행마다 새로 만든다).
ALTER TABLE app_user ADD COLUMN public_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX app_user_public_id ON app_user(public_id);

-- 핸들 열을 지운다. 유일 제약과 형식 CHECK도 함께 사라진다.
ALTER TABLE app_user DROP COLUMN handle;
