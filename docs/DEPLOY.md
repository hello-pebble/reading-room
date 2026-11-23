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
| `FORWARD_HEADERS` | none | 프록시(nginx·로드밸런서) 뒤에서는 `native`. 안 하면 모든 접속자가 프록시 IP 하나로 보여 게스트 가입·이전 코드 제한이 한꺼번에 걸린다. 켜면 `X-Forwarded-For`를 믿는다(Tomcat은 오른쪽부터 내부 프록시를 건너뛰어 처음 만나는 바깥 주소를 쓴다). 프록시가 헤더 끝에 접속자 IP를 붙이는 환경(Cloud Run 등)이면 안전하다 |
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
- [ ] HTTPS(프록시/호스팅에서 처리)이면 `FORWARD_HEADERS=native`
- [ ] DB 백업 방법 정해 두기(`pgdata` 볼륨)

## 알려진 한계(테스트 배포에서 감안)

- 푸시 알림은 로그만 남긴다(실발송 없음). 알림은 화면 안 노란 별만.
- 광장 접속 인원 표시, 신고·차단, 초대 코드(가입 제한)는 없다.
- 게스트는 기기가 곧 계정: 브라우저 저장소를 지우면 새 계정이 된다(기기 이전 코드로 옮길 수 있다, 결정 #85).
- 카카오 검색 한도·약관은 아직 확인 전이다.
- 첫 접속은 3D 라이브러리(`vendor/three.min.js`, 약 600KB)를 내려받는다. 정적 파일 캐시·압축은 서버 기본값이다.
- Docker 이미지 빌드는 개발 PC에서 아직 실행해 보지 않았다(jar 실행은 확인).

## 구글 클라우드 배포(Cloud Run + Cloud SQL)

서울 리전(`asia-northeast3`) 기준이다. 절차를 위에서부터 따른다. `PROJECT`·`REGION` 등은 바꿔 쓴다.

**주의(이 서비스 특성)**
- 서버 안에서 배치(알림·공유방 개방·정리)가 `@Scheduled`로 돈다. Cloud Run 기본(요청 때만 CPU)이면 배치가 멈추므로 **`--no-cpu-throttling`과 `--min-instances=1`**이 필요하다.
- IP 제한이 메모리 안에 있고 배치가 중복 실행될 수 있어 **`--max-instances=1`**로 둔다(여러 대가 필요해지면 제한을 DB로 옮긴다).
- `FORWARD_HEADERS=native`로 둔다(Cloud Run이 `X-Forwarded-For` 끝에 접속자 IP를 붙인다).
- HTTPS는 Cloud Run이 처리한다. 포트는 8080 그대로다.

```bash
PROJECT=<프로젝트 id>; REGION=asia-northeast3
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# 1) DB: Cloud SQL PostgreSQL 16 (사설 IP + VPC 연결이 가장 단순하다. 공개 IP를 쓰면 Cloud SQL 소켓 라이브러리가 따로 필요하다)
gcloud sql instances create rr-db --database-version=POSTGRES_16 --region=$REGION --tier=db-f1-micro \
  --network=default --no-assign-ip
gcloud sql databases create readingroom --instance=rr-db
gcloud sql users create readingroom --instance=rr-db --password=<DB 비밀번호>
#   (사설 IP를 쓰려면 한 번 "서비스 연결(private services access)" 설정이 필요하다. 콘솔의 안내를 따른다)

# 2) 키는 Secret Manager에: 값은 명령 기록에 남지 않게 입력한다
printf '%s' "<KAKAO 키>" | gcloud secrets create kakao-rest-key --data-file=-
printf '%s' "<NL 키>"    | gcloud secrets create nl-cert-key --data-file=-
printf '%s' "<DB 비밀번호>" | gcloud secrets create db-password --data-file=-
# 실행 계정(기본 컴퓨트 서비스 계정)에 roles/secretmanager.secretAccessor 를 준다

# 3) 배포: 루트 Dockerfile로 Cloud Build가 이미지를 만든다
DB_IP=$(gcloud sql instances describe rr-db --format='value(ipAddresses[0].ipAddress)')
gcloud run deploy reading-room --source . --region=$REGION --allow-unauthenticated \
  --network=default --subnet=default --vpc-egress=private-ranges-only \
  --no-cpu-throttling --min-instances=1 --max-instances=1 --cpu-boost --memory=1Gi \
  --set-env-vars="DATABASE_URL=jdbc:postgresql://$DB_IP:5432/readingroom,DATABASE_USER=readingroom,FORWARD_HEADERS=native,TZ=Asia/Seoul" \
  --set-secrets="DATABASE_PASSWORD=db-password:latest,KAKAO_REST_KEY=kakao-rest-key:latest,NL_CERT_KEY=nl-cert-key:latest"
```

배포가 끝나면 나오는 `https://….run.app` 주소를 열고 위 체크리스트를 확인한다. 로그는 `gcloud run services logs read reading-room --region=$REGION`.
이 절차는 개발 PC에서 직접 실행해 보지 못했다(명령 옵션은 배포 때 `gcloud run deploy --help`로 확인한다).
