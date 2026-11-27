-- 광장 글 한 번에 최대 300자 (결정 #93, 공유방 대화 room_message와 같은 길이). 이전 상한은 40자(V8)였다.
ALTER TABLE plaza_message ALTER COLUMN content TYPE varchar(300);
