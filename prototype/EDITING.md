# 화면 직접 수정하기

`index.html`을 크롬·엣지에서 열고, 파일을 저장한 뒤 새로고침하면 반영된다. 다른 곳으로 옮길 때는 `prototype` 폴더 전체를 함께 옮긴다.

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
| 소파·스탠드·책장·거울·달력의 문구 | `room.js` | `sofaPanel`, `lampPanel`, `shelfPanel`, `mirrorPanel`, `calendarPanel` |
| 창문의 소식 문구 | `room.js` | `windowPanel` |
| 내 방 버튼을 눌렀을 때 동작 | `room.js` | `roomAction` 안의 `act` 이름 |
| 입력칸 값 처리 | `room.js` | `bindRoomEvents` |
| 독서 시간 계산·종료 | `room.js` | `startTimer`, `endSession`, `checkSession` |
| 마을로·참여자·방 정보 버튼, 대화창 | `shared-room.css` | `.camp-exit`, `.camp-side`, `.backdrop.camp`, `.rlog` |
| 마을 광장 채팅·미니맵 | `village.css` | `#plazaChat`, `#minimap` |
| 마을 이동·구역·이웃·게시판·광장 대화 | `village.js` | `VIL`, `PLAZA`, `NPCS`, `boardPanel`, `plazaSend` |
| 공유방 개설·초대·대화·참여자·정보창 | `shared-room.js` | `createPanel`, `createRoom`, `joinByCode`, `roomPanel`, `rcMembersHtml`, `rcInfoHtml` |
| 공유방 버튼 동작·기록 가져오기 | `shared-room.js` | `rcAct`, `sharedRoomAction`, `rcSnapshot` |
| 마을·모닥불 이름표와 말풍선 | `common.css` | `.vlab`, `.vbub` |
| 이웃집 방문·추천 조건·확인 | `neighbor.js` | `NEIGHBORS`, `neighborShelfPanel`, `putRecommendation`, `neighborAction` |
| 추천 책 카드·선택 목록 | `neighbor.css` | `.neighbor-choice`, `.neighbor-gift` |
| 방·가구·유령의 3D 모양 | `scene.js` | `buildRoom`, `build`, `buildVillage`, `buildCamp` |
| 저장·공통 모달·기능 연결 | `app.js` | `save`, `renderPanel`, `onPanelClick` |

예: 메모 배경색을 바꾸려면 `room.css`에서 `.note`의 `background`를 수정한다. 모든 버튼 색을 바꾸려면 `common.css`의 `button` 또는 `button.primary`를 수정한다.

CSS는 `common.css` → `room.css` → `village.css` → `shared-room.css` → `neighbor.css` 순서로 적용된다. 각 전용 CSS에는 해당 화면의 선택자를 두고, 전체 화면에 영향을 주는 `button`·`body` 같은 선택자는 `common.css`에서 고친다. 작은 배치 보정 중 일부는 아직 각 기능 JS의 HTML 안 `style` 속성에 있다.

## 수정할 때 유지할 것

- 화면의 `id`, `data-act`는 기능 연결에 사용한다. 문구만 바꿀 때는 그대로 둔다.
- 스크립트는 `room.js` → `village.js` → `shared-room.js` → `neighbor.js` → `scene.js` → `app.js` 순서로 읽는다. 앞의 파일들은 기능을 정의하고, `app.js`가 상태를 불러온 뒤 각 `bind*` 함수를 한 번씩 호출해 이벤트와 타이머를 시작한다. 빌드 도구나 서버 없이 열 수 있도록 기존 일반 스크립트 방식을 유지한다.
- 현재 프론트 저장소는 `localStorage`의 `myroom-proto-v1`이다. 백엔드 API는 구현돼 있지만 이 화면에 연결하는 작업은 별도다.
- 수정 후 저장소 루트에서 `npm run verify`를 실행한다. 화면 모양도 바꿨다면 `npm run e2e`와 브라우저에서 PC·폰 폭을 확인한다.
