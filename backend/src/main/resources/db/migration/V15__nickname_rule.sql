-- 닉네임 규칙을 DB에도 건다 (결정 #67): 한글·영문·숫자만, 공백 없이 1~5자. user.Nickname과 같은 규칙이다.
-- NOT VALID: 이미 있는 행은 검사하지 않고 새로 넣거나 바꾸는 값만 검사한다(옛 개발용 데이터가 30자까지 허용되던 때의 값일 수 있다).
ALTER TABLE app_user ADD CONSTRAINT app_user_nickname_rule CHECK (nickname ~ '^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{1,5}$') NOT VALID;
