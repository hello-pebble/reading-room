# backend (내 방 API)
실행: `DATABASE_URL=jdbc:postgresql://localhost:5432/readingroom ./gradlew bootRun` (jOOQ는 코드 생성 없이 `DSLContext` + SQL로 쓰고, 스키마는 Flyway `db/migration`이 만든다)
테스트: `./gradlew test` — Docker 없이 zonky embedded-postgres로 실제 PostgreSQL을 띄운다 (루트 사용자는 PostgreSQL이 거부한다. 이때는 `TEST_DATABASE_URL`로 외부 DB를 준다)
설정: DB는 `DATABASE_URL`·`DATABASE_USER`·`DATABASE_PASSWORD`, 비밀 키(VAPID, 국립중앙도서관 `NL_CERT_KEY` 등)는 환경변수로만 받는다

## 책 검색을 화면에서 써 보기 (국립중앙도서관)
1. PostgreSQL을 띄운다. Docker가 있으면: `docker run -d --name rr-pg -e POSTGRES_USER=readingroom -e POSTGRES_PASSWORD=readingroom -e POSTGRES_DB=readingroom -p 5432:5432 postgres:16`
2. 인증키를 환경변수로 넣고 서버를 띄운다 (키는 파일·채팅에 적지 않는다): `NL_CERT_KEY=발급받은키 ./gradlew bootRun`
3. 서버가 뜨면 `curl "http://localhost:8080/books/search?q=소년이 온다"`로 확인한다. 키가 없으면 503이다.
4. 화면은 `prototype`을 `.claude/serve-nocache.py`(8765 포트)로 열고, 처음 한 번만 주소 끝에 `?searchApi=http://localhost:8080/books/search`를 붙여 연다 (저장된다). 다른 주소에서 열면 `CORS_ORIGINS`에 그 주소를 넣는다.
- `GET /books/search`는 사용자 헤더(`X-User-Id`) 없이 열려 있다. 구글 로그인을 붙일 때 로그인 필요 + 호출 제한으로 바꾼다.
