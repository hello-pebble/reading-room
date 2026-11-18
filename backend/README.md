# backend (내 방 API)
실행: `DATABASE_URL=jdbc:postgresql://localhost:5432/readingroom ./gradlew bootRun` (jOOQ는 코드 생성 없이 `DSLContext` + SQL로 쓰고, 스키마는 Flyway `db/migration`이 만든다)
테스트: `./gradlew test` — Docker 없이 zonky embedded-postgres로 실제 PostgreSQL을 띄운다 (루트 사용자는 PostgreSQL이 거부한다. 이때는 `TEST_DATABASE_URL`로 외부 DB를 준다)
설정: DB는 `DATABASE_URL`·`DATABASE_USER`·`DATABASE_PASSWORD`, 비밀 키(VAPID 등)는 환경변수로만 받는다
