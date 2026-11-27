# 테스트 배포 안내

서버 하나(Spring Boot jar)가 **화면과 API를 함께** 낸다(결정 #86). 필요한 것은 서버 실행 환경과 PostgreSQL 16 하나다.

**지금 운영(2026-11-27):** 오라클 클라우드 우분투 VM의 Docker 컨테이너 + Caddy(HTTPS) + DuckDNS 주소 `https://readingroom.duckdns.org`, DB는 Supabase(서울). 절차는 아래 [오라클 VM + Caddy + Supabase](#오라클-vm--caddy--supabase-지금-운영)(결정 #89).

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
| `DB_POOL_SIZE` | 10 | DB 연결 풀 크기(Supabase 같은 외부 DB는 연결 한도에 맞춘다) |
| `KAKAO_REST_KEY` | 없음 | 제목 검색(카카오 우선). 키가 없으면 국립중앙도서관 |
| `NL_CERT_KEY` | 없음 | 국립중앙도서관. 둘 다 없으면 책 검색은 503 |
| `FORWARD_HEADERS` | none | 프록시(nginx·로드밸런서) 뒤에서는 `native`. 안 하면 모든 접속자가 프록시 IP 하나로 보여 게스트 가입·이전 코드 제한이 한꺼번에 걸린다. 켜면 `X-Forwarded-For`를 믿는다(Tomcat은 오른쪽부터 내부 프록시를 건너뛰어 처음 만나는 바깥 주소를 쓴다). 프록시가 헤더 끝에 접속자 IP를 붙이는 환경(Cloud Run 등)이면 안전하다 |
| `GUEST_SIGNUPS_PER_HOUR_PER_IP` | 30 | IP당 한 시간 새 게스트 수 |
| `TRANSFER_ATTEMPTS_PER_10MIN_PER_IP` | 10 | IP당 10분 이전 코드 입력 횟수 |
| `GOOGLE_CLIENT_ID` | 없음 | 구글 로그인(화면은 쓰지 않음) |
| `VAPID_*` | 없음 | 웹 푸시(실발송은 아직 없음) |
| `CORS_ORIGINS` | 비어 있음 | 화면을 다른 주소에서 열 때만 필요. 같은 서버에서 내면 불필요(운영에서 `null`·`*`는 넣지 않는다) |

키 값은 환경변수로만 준다. 코드·문서·로그에 적지 않는다. 운영에서는 `dev` 프로파일을 켜지 않는다(`/dev/*`, `X-User-Id`가 열린다).

## 배포 전 확인(체크리스트)

- [ ] `cd backend && ./gradlew test` 통과 (DB는 내장 또는 `TEST_DATABASE_*`)
- [ ] `npm run verify`, `npm run e2e` 통과
- [ ] `GET /health` → `{"status":"ok"}`, `GET /` → 화면, `GET /me`(토큰 없이) → 401, `POST /dev/login` → 404
- [ ] 브라우저에서 접속 → 닉네임 정하기 → 책 검색·등록 → 광장 글 → 방 개설·입장
- [ ] HTTPS(프록시/호스팅에서 처리)이면 `FORWARD_HEADERS=native`
- [ ] DB 백업 방법 정해 두기(`pgdata` 볼륨)

## 알려진 한계(테스트 배포에서 감안)

- **IP 제한을 잠시 껐다(2026-11-24, 한도 없이 어디까지 되는지 보려는 테스트).** 게스트 가입·이전 코드 입력 제한은 `AuthService`에서 주석 처리했고 관련 테스트 2개는 `@Disabled`다. 공개 주소에 열어 두는 동안 봇이 가입을 마구 만들거나 책 검색(카카오·국립중앙도서관 호출 한도)을 소진할 수 있다(책 검색은 결정 #88로 IP당 1분 30회 제한을 켜 두었다). 테스트 뒤 주석을 풀어 가입·이전 코드 제한을 다시 켠다. 대화 속도 제한(3초 3건 등, 결정 #61)은 그대로다.
- 모든 응답에 보안 헤더(nosniff, iframe 금지, Referrer 최소, HTTPS에서 HSTS)가 붙는다. 내용 보안 정책(CSP)은 화면의 인라인 스크립트 때문에 아직 없다.

- 푸시 알림은 로그만 남긴다(실발송 없음). 알림은 화면 안 노란 별만.
- 광장 접속 인원 표시, 신고·차단, 초대 코드(가입 제한)는 없다.
- 게스트는 기기가 곧 계정: 브라우저 저장소를 지우면 새 계정이 된다(기기 이전 코드로 옮길 수 있다, 결정 #85).
- 카카오 검색 한도·약관은 아직 확인 전이다.
- 첫 접속은 3D 라이브러리(`vendor/three.min.js`, 약 600KB)를 내려받는다. 정적 파일 캐시·압축은 서버 기본값이다.
- Docker 이미지 빌드·실행은 오라클 VM에서 확인했다(2026-11-27).

## 오라클 VM + Caddy + Supabase (지금 운영)

같은 VM에 다른 서비스와 Caddy가 함께 돈다. 그래서 컨테이너는 **호스트 포트를 열지 않고** Caddy와 같은 Docker 네트워크에 붙인다(다른 서비스가 호스트 8080을 써도 부딪히지 않는다). `docker-compose.yml`은 DB까지 띄우는 구성이라 여기서는 쓰지 않는다.

**1) Supabase 프로젝트**
- 리전은 **Northeast Asia (Seoul)** `ap-northeast-2`. 생성 화면이 넓은 지역(Asia-Pacific 등)만 보이면 특정 리전을 직접 고른다(그냥 두면 싱가포르로 잡힐 수 있다).
- Project Settings → **Data API는 끈다**(서버는 JDBC로만 접속하고, 켜 두면 RLS 없는 `public` 테이블이 anon 키로 읽힐 수 있다).
- Connect → **Session pooler**(포트 5432) 값을 쓴다. Direct는 IPv6 전용, Transaction pooler(6543)는 Flyway와 맞지 않는다.

**2) VM 준비** (Docker와 Caddy는 이미 있다고 본다)
```bash
git clone https://github.com/hello-pebble/reading-room.git ~/reading-room && cd ~/reading-room
nano .env && chmod 600 .env     # 커밋하지 않는다
```
```
DATABASE_URL=jdbc:postgresql://aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require
DATABASE_USER=postgres.<프로젝트 ref>
DATABASE_PASSWORD=<Supabase DB 비밀번호>
DB_POOL_SIZE=5
FORWARD_HEADERS=native
KAKAO_REST_KEY=<카카오 키>
NL_CERT_KEY=<국립중앙도서관 키>
```
`FORWARD_HEADERS=native`가 없으면 모든 접속자가 Caddy 주소 하나로 보여 IP 제한(책 검색 등)이 전체에 한꺼번에 걸린다.

**3) 빌드와 실행** (`<caddy 네트워크>`는 `docker ps --format '{{.Names}}\t{{.Networks}}'`로 확인)
```bash
sudo docker build -t reading-room .
sudo docker run -d --name reading-room --restart unless-stopped --network <caddy 네트워크> --env-file .env reading-room
sudo docker logs -f reading-room     # Started … 가 나오면 끝. 첫 시작 때 Flyway가 V1~V18을 만든다
```

**4) 주소와 Caddy**
- DuckDNS에서 이름을 만들고 VM 공인 IP를 넣는다. VM의 공인 IP는 **예약(Reserved) IP**로 둔다(임시 IP면 VM을 다시 켤 때 바뀐다).
- Caddy 사이트 파일(예: `caddy/sites/readingroom.caddy`, Caddyfile이 `import sites/*.caddy`로 읽는다):
```
readingroom.duckdns.org {
    reverse_proxy reading-room:8080
}
```
```bash
sudo docker exec caddy caddy validate --config /etc/caddy/Caddyfile
sudo docker exec caddy caddy reload --config /etc/caddy/Caddyfile
curl https://readingroom.duckdns.org/health     # {"status":"ok"}
```
인증서는 Caddy가 80/443으로 자동 발급한다(오라클 Security List·iptables에서 80/443이 열려 있어야 한다).

**5) 새 버전 반영** (`main` 머지 뒤)
```bash
cd ~/reading-room && git pull && sudo docker build -t reading-room .
sudo docker rm -f reading-room
sudo docker run -d --name reading-room --restart unless-stopped --network <caddy 네트워크> --env-file .env reading-room
sudo docker image prune -f     # 가끔: 이름 없는 옛 이미지 정리
```
교체하는 수십 초 동안 접속이 끊긴다. 데이터는 Supabase에 있어 그대로다. 컨테이너를 다시 만들어야(`rm` 뒤 `run`) 바뀐 `.env`도 읽는다.

**확인한 것(2026-11-27):** `/health`, `/`(화면·3D), 토큰 없는 `/me` 401, `/dev/login`·`/dev/users` 404, 보안 헤더와 HTTPS의 HSTS, 게스트 시작·닉네임·책 검색(카카오)·등록·광장 글(한국 시간)·모닥불 개설·초대 미리보기·입장(같은 사람 다시 입장은 200)·보관 동의·대화·나가기·닫기. 확인 못 한 것: 스탠드 타이머, 달력, 기기 이전 코드, 이웃집, 폰 화면. 고른 책의 전체 쪽수가 비어 있던 경우가 있어 `NL_CERT_KEY`를 확인한다.

## 구글 클라우드 배포(Cloud Run) + Supabase DB

DB는 Supabase PostgreSQL을 쓴다. Cloud SQL·VPC는 필요 없고, Cloud Run이 인터넷으로 Supabase에 바로 연결한다.

**Supabase 연결 주소 (중요)**
- Supabase 대시보드 → Connect → **Session pooler**의 주소를 쓴다. 호스트는 `aws-0-<리전>.pooler.supabase.com`, 포트 **5432**, 사용자는 `postgres.<프로젝트ref>`.
- Direct connection(`db.<ref>.supabase.co`)은 IPv6 전용이라 Cloud Run(IPv4)에서 안 닿는다. Transaction pooler(6543)는 Flyway·준비된 문장과 맞지 않으니 쓰지 않는다.
- JDBC 주소는 `jdbc:postgresql://aws-0-<리전>.pooler.supabase.com:5432/postgres?sslmode=require`.
- 스키마는 서버가 시작할 때 Flyway가 `public`에 만든다. 비밀번호는 Supabase 프로젝트의 DB 비밀번호다.
- 연결 수 한도가 작으니 `DB_POOL_SIZE`(기본 10)로 맞춘다(무료는 5 정도).

**주의(이 서비스 특성)**
- 서버 안에서 배치(알림·공유방 개방·정리)가 `@Scheduled`로 돈다. Cloud Run 기본(요청 때만 CPU)이면 배치가 멈추므로 **`--no-cpu-throttling`과 `--min-instances=1`**이 필요하다.
- IP 제한이 메모리 안에 있고 배치가 중복 실행될 수 있어 **`--max-instances=1`**로 둔다.
- `FORWARD_HEADERS=native`(Cloud Run이 `X-Forwarded-For` 끝에 접속자 IP를 붙인다). HTTPS는 Cloud Run이 처리하고 포트는 8080 그대로다.

```bash
PROJECT=<프로젝트 id>; REGION=asia-northeast3
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# 1) 키는 Secret Manager에(값은 명령 기록에 남지 않게 입력한다). 실행 계정(기본 컴퓨트 서비스 계정)에 roles/secretmanager.secretAccessor 를 준다
printf '%s' "<Supabase DB 비밀번호>" | gcloud secrets create db-password --data-file=-
printf '%s' "<KAKAO 키>" | gcloud secrets create kakao-rest-key --data-file=-
printf '%s' "<NL 키>"    | gcloud secrets create nl-cert-key --data-file=-

# 2) 배포: 루트 Dockerfile로 Cloud Build가 이미지를 만든다
gcloud run deploy reading-room --source . --region=$REGION --allow-unauthenticated   --no-cpu-throttling --min-instances=1 --max-instances=1 --cpu-boost --memory=1Gi   --set-env-vars="DATABASE_URL=jdbc:postgresql://aws-0-<리전>.pooler.supabase.com:5432/postgres?sslmode=require,DATABASE_USER=postgres.<프로젝트ref>,DB_POOL_SIZE=5,FORWARD_HEADERS=native,TZ=Asia/Seoul"   --set-secrets="DATABASE_PASSWORD=db-password:latest,KAKAO_REST_KEY=kakao-rest-key:latest,NL_CERT_KEY=nl-cert-key:latest"
```

배포가 끝나면 나오는 `https://….run.app` 주소를 열고 위 체크리스트를 확인한다. 로그는 `gcloud run services logs read reading-room --region=$REGION`.
이 절차는 개발 PC에서 직접 실행해 보지 못했다(명령 옵션은 배포 때 `gcloud run deploy --help`로 확인한다).
