# 화면 직접 수정하기

`index.html`을 크롬·엣지에서 열고, 파일을 저장한 뒤 새로고침하면 반영된다. 다른 곳으로 옮길 때는 `frontend` 폴더 전체를 함께 옮긴다. 스크립트는 `js/`, 스타일은 `css/` 폴더에 있다(아래 표의 `room-panels.js`는 `js/room-panels.js`, `common.css`는 `css/common.css`).

## 무엇을 고칠지에 따라 파일 고르기

| 수정할 것 | 파일 | 찾을 이름 |
|---|---|---|
| 전체 색상·글꼴 | `common.css` | 맨 위 `:root`, `body` |
| 모든 화면의 기본 버튼·입력칸 | `common.css` | `button`, `input,textarea`, `select` |
| 공통 팝업 크기·제목·아래 버튼 영역 | `common.css` | `aside.panel`, `.panel-head`, `.foot` |
| 내 방 책 카드·메모·별점 | `room.css` | `.book`, `.note`, `.stars` |
| 책장 탭·진행 막대 | `room.css` | `.tabs`, `.progress` |
| 달력 | `room.css` | `.cal` |
| 거울 미리보기·색상·장식 버튼 | `room.css` | `.mir`, `.sw`, `.acc`, `.shuffle` |
| 책 찾기(제목·저자 검색, 서버 검색 주소는 주소 끝 `?searchApi=…`로 저장) | `room-search.js` | `toIsbn13`, `searchBooks`, `runSearch` |
| 소파·스탠드·책장·거울·달력의 문구 | `room-panels.js` | `sofaPanel`, `lampPanel`, `shelfPanel`, `mirrorPanel`, `calendarPanel` |
| 창문의 소식 문구 | `room-panels.js` | `windowPanel` |
| 내 방 버튼을 눌렀을 때 동작 | `room-actions.js` | `roomAction` 안의 `act` 이름 |
| 입력칸 값 처리 | `room-actions.js` | `bindRoomEvents` |
| 독서 시간 계산·종료 | `room-timer.js` | `startTimer`, `endSession`, `checkSession` |
| 마을로·참여자·방 정보 버튼, 대화창 | `shared-room.css` | `.camp-exit`, `.camp-side`, `.backdrop.camp`, `.rlog` |
| 마을 광장 채팅·미니맵 | `village.css` | `#plazaChat`, `#minimap` |
| 마을 이동·구역·이웃·게시판·광장 대화 | `village.js` | `VIL`, `PLAZA`, `NPCS`, `boardPanel`, `plazaSend` |
| 공유방 개설(시간·하루 3번)·초대 코드로 들어가기 | `shared-create.js` | `createPanel`, `createRoom`, `joinByCode` |
| 공유방 대화·참여자·정보창 | `shared-chat.js` | `roomPanel`, `rcMembersHtml`, `rcInfoHtml` |
| 공유방 대화 화면 버튼 동작 | `shared-chat-actions.js` | `rcAct` |
| 공유방 개설·초대·보관·알림 버튼 동작 | `shared-actions.js` | `sharedRoomAction` |
| 기록 가져오기(대화 스냅샷) | `shared-chat.js` | `rcSnapshot` |
| 모닥불 진행 시간(버튼)·자동 종료 | `shared-actions.js` | `rhours`, `fireSharedRoomsDue` |
| 하루 개설 횟수 | `shared-create.js` | `roomsMadeToday` |
| 모닥불 장면 읽은 시간·시간 다 되면 광장으로 | `shared-room.js` | `rhours`, `roomsMadeToday`, `fireSharedRoomsDue`, `recordCampTime`, `endCampToPlaza` |
| 마을·모닥불 이름표와 말풍선 | `common.css` | `.vlab`, `.vbub` |
| 이웃집 방문·추천 조건·확인 | `neighbor.js` | `NEIGHBORS`, `neighborShelfPanel`, `putRecommendation`, `neighborAction` |
| 추천 책 카드·선택 목록 | `neighbor.css` | `.neighbor-choice`, `.neighbor-gift` |
| 모닥불 장면 말풍선 간격(이름표 위) | `scene.js` | `frame` 안 `vilBub` 줄의 `place(b.el,…)` (내 캐릭터 -22, 참여자 -25) |
| 내 방의 화면 위치(가운데 맞춤) | `scene.js` | `fit`의 `T.set(X/2,2.1,Y/2)` |
| 방·가구·유령의 3D 모양 | `scene.js` | `buildRoom`, `build`, `buildVillage`, `buildCamp` |
| 서버 호출(주소 `?api=`, Bearer 토큰, 오류 처리) | `api.js` | `API.request`, `API.get·post·put·patch·del` |
| 로그인·닉네임 창과 시작 순서 | `account.js` | `loginPanel`, `nicknamePanel`, `doLogin`, `bootAccount` |
| 책·메모·완독/포기의 서버 연결(불러오기, 쪽수 저장, 메모, 완독) | `books.js` | `loadBooks`, `serverAddBook`, `queueBookSave`, `serverEndBook` |
| 스탠드 켜기·끄기·계속·확인·직접 기록의 서버 연결, 오늘 읽은 시간 | `sessions.js` | `loadSession`, `serverStop`, `serverConfirm`, `serverManual` |
| 달력·월 목표의 서버 연결 | `calendar.js` | `calDataServer`, `calLoad`, `serverSetGoal` |
| 마을 광장 대화의 서버 연결(글 받기·보내기) | `plaza.js` | `plazaStart`, `plazaMerge`, `serverPlazaSend` |
| 저장 | `state.js` | `save`, `defaultState` |
| 공통 창(모달) 열고 닫기·버튼 연결 | `panel.js` | `renderPanel`, `onPanelClick` |
| 시작 순서·알림·채팅 도배 방지 | `app.js` | `bind*` 호출, `fireDue`, `chatGate` |

예: 메모 배경색을 바꾸려면 `room.css`에서 `.note`의 `background`를 수정한다. 모든 버튼 색을 바꾸려면 `common.css`의 `button` 또는 `button.primary`를 수정한다.

CSS는 `common.css` → `room.css` → `village.css` → `shared-room.css` → `neighbor.css` 순서로 적용된다. 각 전용 CSS에는 해당 화면의 선택자를 두고, 전체 화면에 영향을 주는 `button`·`body` 같은 선택자는 `common.css`에서 고친다. 작은 배치 보정 중 일부는 아직 각 기능 JS의 HTML 안 `style` 속성에 있다.

## 수정할 때 유지할 것

- 화면의 `id`, `data-act`는 기능 연결에 사용한다. 문구만 바꿀 때는 그대로 둔다.
- 스크립트는 `api.js` → `room.js` → `room-search.js` → `room-panels.js` → `room-actions.js` → `room-timer.js` → `village.js` → `shared-room.js` → `shared-chat.js` → `shared-chat-actions.js` → `shared-create.js` → `shared-actions.js` → `neighbor.js` → `scene.js` → `base.js` → `state.js` → `stage.js` → `render.js` → `panel.js` → `account.js` → `app.js` 순서로 읽는다(`index.html`의 순서). 큰 파일을 줄 단위로 구역별로 나눈 것이라 한 파일처럼 같은 전역 범위를 쓰고, 새 파일을 만들면 `index.html`에 같은 자리에 태그를 더한다. 앞의 파일들은 기능을 정의하고, `state.js`가 상태를 불러오고, 마지막 `app.js`가 각 `bind*` 함수를 한 번씩 호출해 이벤트와 타이머를 시작한다. 빌드 도구나 서버 없이 열 수 있도록 기존 일반 스크립트 방식을 유지한다.
- 현재 프론트 저장소는 `localStorage`의 `myroom-proto-v1`이다. 서버 연결은 주소 끝 `?api=http://localhost:8080`으로 켜는 "서버 연결 모드"이고(1단계: 개발용 로그인·닉네임·내 정보, 결정 #71 / 4단계: 책·메모·완독/포기 #72, 스탠드 타이머 #73, 달력·월 목표 #75, 광장 대화 #76), 나머지 기능은 아직 `localStorage`로 동작한다. 서버 확인 방법은 `backend/README.md`의 "화면과 함께 실행"을 본다.
- 코드 모양은 한 줄이 120자를 넘지 않게 Prettier로 정리해 둔 상태다. 고친 뒤 모양이 흐트러졌으면 저장소 루트에서 `npx prettier@3 --single-quote --print-width 120 --write "frontend/js/*.js" "frontend/css/*.css"`로 다시 정리한다(저장소에 설치하지 않고 그때그때 내려받아 쓴다). 긴 문자열·HTML 조각은 그대로 길 수 있다.
- 수정 후 저장소 루트에서 `npm run verify`를 실행한다. 화면 모양도 바꿨다면 `npm run e2e`와 브라우저에서 PC·폰 폭을 확인한다.
