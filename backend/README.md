# backend (내 방 API)
실행: `DATABASE_URL=jdbc:postgresql://localhost:5432/readingroom ./gradlew bootRun` (jOOQ는 코드 생성 없이 `DSLContext` + SQL로 쓰고, 스키마는 Flyway `db/migration`이 만든다)
테스트: `./gradlew test` — Docker 없이 zonky embedded-postgres로 실제 PostgreSQL을 띄운다 (루트 사용자는 PostgreSQL이 거부한다. 이때는 `TEST_DATABASE_URL`로 외부 DB를 준다)
설정: DB는 `DATABASE_URL`·`DATABASE_USER`·`DATABASE_PASSWORD`, 비밀 키(VAPID, 국립중앙도서관 `NL_CERT_KEY` 등)는 환경변수로만 받는다

## 코드 수정 위치

요청은 `Controller → Service → Repository` 순서로 흐른다. 각 기능 패키지의 `dto/`에 요청·응답 record를 둔다.

| 바꾸려는 내용 | 수정 위치 |
|---|---|
| URL·HTTP 상태·헤더 | `*Controller` |
| 요청 필드·응답 필드 | `dto/*Request`, `dto/*Response` |
| 소유권·진행률·완독·시간 제한·트랜잭션 | `*Service` |
| 조회·저장 SQL | `*Repository` |
| 테이블·제약 조건 | `src/main/resources/db/migration/` |

## 패키지
| 패키지 | 내용 |
|---|---|
| `book` | 책·메모·완독/포기, 책 검색(`/books/search`, 국립중앙도서관) |
| `session` | 스탠드 타이머, 직접 기록, 3시간 초과 배치 |
| `calendar` | 달력·월 목표 |
| `push` | 푸시 구독, 알림 대상 선정 |
| `user` | 계정·아바타·닉네임(`PUT /me/nickname`, 한글·영문·숫자 1~5자) |
| `village` | 마을 게시판 읽기(`GET /rooms`), 광장 채팅(`/plaza/messages`, 24시간 삭제 배치). 방 한 줄 응답(`RoomResponse`)과 시각 상태 계산(`BoardService.state`)은 `room`도 쓴다 |
| `room` | 공유방(모닥불) 개설 `POST /rooms`, 초대 미리보기 `GET /rooms/invite/{code}`, 닫기 `POST /rooms/{id}/close`, 입장 `POST /rooms/join`, 나가기 `DELETE /rooms/{id}/participants/me`, 보관 동의 `POST /rooms/{id}/agree` (V9: 초대 코드·방 이름 제약, 개설 기록 `room_open_log`), 대화 `GET·POST /rooms/{id}/messages`·읽음 `POST /rooms/{id}/read` (V10: `room_message`, `RoomMessage*`). 알림 켜기·끄기 `PUT·DELETE /rooms/{id}/alarm`, 가져오기 `POST /rooms/{id}/import`·책의 공유방 탭 `GET /books/{id}/rooms` (V12: `room_alarm`, `book_room_archive`, `RoomArchive*`). 개방/종료·삭제 배치는 다음 단계(`docs/DATA_API.md` 끝 메모) |
| `neighbor` | 이웃집 책 추천: 방문 `GET /neighbors/{handle}`, 꽂기 `POST /neighbors/{handle}/recommendation`, 내 집 추천 `GET /me/recommendation`, 확인 `POST /me/recommendation/confirm` (V11: `neighbor_recommendation`, 집마다 확인 전 한 권은 부분 유니크 인덱스) |
| `common` | 오류·CORS·멱등키·공통 설정 |

예: 책 등록은 `BookController → BookService.create → BookRepository.insert`이며, 입력은 `CreateBookRequest`, 출력은 `BookResponse`다. Repository는 인터페이스 없이 구체 클래스로 두고 jOOQ의 `fetchOne(SQL, 값...)`을 사용한다. 사용자 입력은 SQL 문자열에 붙이지 않고 `?`에 바인딩한다. JPA와 jOOQ 코드 생성은 사용하지 않는다.

기존 입력 규칙을 유지하려고 숫자·불리언 요청 필드 일부는 DTO 안에서 `JsonNode`로 받는다. 숫자 문자열을 임의 변환하지 않고 기존 서비스가 검사·반올림한다. 특히 `PatchBookRequest.totalPages`의 Java `null`은 필드 생략(유지), JSON null은 비우기다. 이 구분은 `RequestJson`이 보존한다. 응답은 명시적인 record이며 DB의 `Record`는 HTTP로 직접 반환하지 않는다.

API 경로·JSON 필드·DB 스키마는 이번 역할 분리에서 변경하지 않았다. 책 검색의 외부 API 호출은 기존 `BookSearchSource`가 담당한다.

## 책 검색을 화면에서 써 보기 (국립중앙도서관)
1. PostgreSQL을 띄운다. Docker가 있으면: `docker run -d --name rr-pg -e POSTGRES_USER=readingroom -e POSTGRES_PASSWORD=readingroom -e POSTGRES_DB=readingroom -p 5432:5432 postgres:16`
2. 인증키를 환경변수로 넣고 서버를 띄운다 (키는 파일·채팅에 적지 않는다): `NL_CERT_KEY=발급받은키 ./gradlew bootRun`
3. 서버가 뜨면 `curl "http://localhost:8080/books/search?q=소년이 온다"`로 확인한다. 키가 없으면 503이다.
4. 화면은 `frontend` 폴더를 `.claude/serve-nocache.py`(8765 포트)로 열고, 처음 한 번만 주소 끝에 `?searchApi=http://localhost:8080/books/search`를 붙여 연다 (저장된다). 다른 주소에서 열면 `CORS_ORIGINS`에 그 주소를 넣는다.
- `GET /books/search`는 사용자 헤더(`X-User-Id`) 없이 열려 있다. 구글 로그인을 붙일 때 로그인 필요 + 호출 제한으로 바꾼다.
