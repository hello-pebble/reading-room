# 테스트 배포 안내

서버 하나(Spring Boot jar)가 **화면과 API를 함께** 낸다(결정 #86). 필요한 것은 서버 실행 환경과 PostgreSQL 16 하나다.

## 실행

**Docker(권장)** — 저장소 루트에서:

```bash
export DB_PASSWORD=<정한 비밀번호>
export KAKAO_REST_KEY=<카카오 REST 키>      # 제목 검색. 없으면 국립중앙도서관으로 대신한다
export NL_CERT_KEY=<국립중앙도서관 인증키>   # ISBN·저자 검색과 제목 검색 보조
docker compose up -d --build
```

접속은 `http://<서버>:8080/`. 주소 끝에 `?api=`를 붙일 필요가 없다(화면이 열린 주소의 서버에 바로 연결된다).

**jar로 직접**: `cd backend && ./gradlew bootJar` → `java -jar build/libs/reading-room-backend-0.0.1.jar` (환경변수는 아래 표).

## 환경변수

| 이름 | 기본 | 설명 |
|---|---|---|
| `DATABASE_URL` / `DATABASE_USER` / `DATABASE_PASSWORD` | localhost:5432 / readingroom / readingroom | PostgreSQL. 시작할 때 Flyway가 스키마를 자동으로 만든다 |
| `SERVER_PORT` | 8080 | 포트 |
| `KAKAO_REST_KEY` | 없음 | 제목 검색(카카오 우선). 키가 없으면 국립중앙도서관 |
| `NL_CERT_KEY` | 없음 | 국립중앙도서관. 둘 다 없으면 책 검색은 503 |
| `FORWARD_HEADERS` | none | 프록시(nginx·로드밸런서) 뒤에서는 `framework`. 안 하면 모든 접속자가 프록시 IP 하나로 보여 게스트 가입·이전 코드 제한이 한꺼번에 걸린다. 켜면 `X-Forwarded-For`를 믿으므로 프록시가 이 헤더를 덮어써야 한다(아니면 IP를 속여 제한을 피할 수 있다) |
| `GUEST_SIGNUPS_PER_HOUR_PER_IP` | 30 | IP당 한 시간 새 게스트 수 |
| `TRANSFER_ATTEMPTS_PER_10MIN_PER_IP` | 10 | IP당 10분 이전 코드 입력 횟수 |
| `GOOGLE_CLIENT_ID` | 없음 | 구글 로그인(화면은 쓰지 않음) |
| `VAPID_*` | 없음 | 웹 푸시(실발송은 아직 없음) |
| `CORS_ORIGINS` | 로컬 주소들 | 화면을 다른 주소에서 열 때만 필요. 같은 서버에서 내면 불필요 |

키 값은 환경변수로만 준다. 코드·문서·로그에 적지 않는다. 운영에서는 `dev` 프로파일을 켜지 않는다(`/dev/*`, `X-User-Id`가 열린다).

## 배포 전 확인(체크리스트)

- [ ] `cd backend && ./gradlew test` 통과 (DB는 내장 또는 `TEST_DATABASE_*`)
- [ ] `npm run verify`, `npm run e2e` 통과
- [ ] `GET /health` → `{"status":"ok"}`, `GET /` → 화면, `GET /me`(토큰 없이) → 401, `POST /dev/login` → 404
- [ ] 브라우저에서 접속 → 닉네임 정하기 → 책 검색·등록 → 광장 글 → 방 개설·입장
- [ ] HTTPS(프록시/호스팅에서 처리)이면 `FORWARD_HEADERS=framework`
- [ ] DB 백업 방법 정해 두기(`pgdata` 볼륨)

## 알려진 한계(테스트 배포에서 감안)

- 푸시 알림은 로그만 남긴다(실발송 없음). 알림은 화면 안 노란 별만.
- 광장 접속 인원 표시, 신고·차단, 초대 코드(가입 제한)는 없다.
- 게스트는 기기가 곧 계정: 브라우저 저장소를 지우면 새 계정이 된다(기기 이전 코드로 옮길 수 있다, 결정 #85).
- 카카오 검색 한도·약관은 아직 확인 전이다.
- 첫 접속은 3D 라이브러리(`vendor/three.min.js`, 약 600KB)를 내려받는다. 정적 파일 캐시·압축은 서버 기본값이다.
- Docker 이미지 빌드는 개발 PC에서 아직 실행해 보지 않았다(jar 실행은 확인).
