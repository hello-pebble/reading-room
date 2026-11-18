# 독서 공유방 작업 지침 (AI 에이전트용)

독서 기록·공유 웹서비스의 프로토타입. `prototype/index.html`은 화면 뼈대, `room.js`는 내 방, `village.js`는 마을, `shared-room.js`는 공유방, `neighbor.js`는 이웃집 방문·책 추천 기능이다. `scene.js`는 공용 3D, `app.js`는 공용 상태·저장·모달과 시작 순서다. CSS는 `common.css`(공용), `room.css`(내 방), `village.css`(마을), `shared-room.css`(공유방), `neighbor.css`(이웃집)로 나뉜다. 수정 위치는 `prototype/EDITING.md`를 본다. 설명과 결정은 한국어 문서에 있다.

## 검사 — 코드를 바꾸면 반드시 돌린다

```bash
npm install        # 처음 한 번 (jsdom 설치)
npm run verify     # 문법 검사 + 시나리오 테스트. 통과해야 커밋한다
```

| 명령 | 하는 일 |
|---|---|
| `npm run check` | `prototype/*.js`와 `prototype/*.html`의 인라인 스크립트가 문법 오류 없이 컴파일되는지 본다 |
| `npm test` | `tests/scenarios.test.js` — 페이지를 가상 브라우저(jsdom)에 올려 패널·버튼·저장 상태를 실제로 조작한다 (약 2초) |

- **실제 브라우저 테스트(Playwright)**: `npx playwright install chromium`(처음 한 번) 뒤 `npm run e2e`. 데스크톱과 폰 두 화면에서 3D가 그려지는지, 화면이 넘치거나 겹치지 않는지, 실제 클릭·키보드 흐름(방, 마을, 미니맵, 광장 채팅창)을 본다. 느려서(약 2분) 화면을 바꾼 작업에서만 돌린다. 좌표는 `PLAZA` 같은 상수를 읽어 쓴다.
- jsdom 테스트는 3D(three.js)를 올리지 않는다. 그래서 **3D 그림, 실제 터치, 알림 팝업, 화면 겹침**은 테스트가 못 본다. 화면이 바뀌는 일이면 브라우저로 직접 확인한다.
- 테스트는 페이지 안의 변수와 함수(`S`, `openF`, `endSession`, `plazaSend` …)를 `a.ev('...')`로 직접 부른다. 새 기능에는 같은 방식으로 테스트를 한두 개 추가한다 (`tests/load.js`의 `load()`가 로더).
- 결함을 고칠 때는 그 결함을 재현하는 테스트를 먼저 추가하고 고친다.

## 지킬 것

- **확정된 결정은 되돌리지 않는다.** `DECISIONS.md`의 확정 표를 먼저 읽는다. 새로 확정하면 번호와 날짜를 붙여 추가한다.
- 기능을 바꾸면 문서를 같이 고친다: `SPEC.md`, `FEATURE_DEFINITION.md`, `FEATURE_GUIDE.md`, 데이터·API가 바뀌면 `DATA_API.md`, 진행 상태는 `README.md`.
- 가구는 6개 + 문, 방 크기는 사용 중 바뀌지 않는다, 알림은 노란 별만 쓴다 (빨간 점·숫자 금지).
- 상태는 `localStorage` 키 `myroom-proto-v1`의 객체 `S`. 저장 구조를 바꾸면 로드 직후에 이관 코드를 넣는다 (예: `if(!S.later)S.later=[]`).
- 날짜·시간은 한국 시간(`Asia/Seoul`) 기준이다 (달력, 오늘 읽은 시간, 완독일).
- 커밋 메시지와 사용자 응답은 한국어. 한 번에 하나의 작은 변경을 하고, 검사를 통과한 뒤에만 커밋한다.
