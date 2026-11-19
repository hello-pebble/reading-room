// 계정 · 서버 연결 모드(?api=)의 로그인·닉네임 창과 시작 순서 (서버 연결 1단계). ?api가 없으면 아무것도 하지 않는다.
// 지금 로그인은 개발용(서버의 dev 프로파일 POST /dev/login)이다. 구글 로그인으로 바꿀 때는 doLogin의 서버 호출만 바꾼다.
const ACCT = { err: '', busy: false, locked: false, label: '', nick: '' };
// 로그인 창과 처음 닉네임 정하기는 끝낼 때까지 바깥 클릭·Esc로 닫을 수 없다
const accountLocked = () => panelOpen === 'login' || (panelOpen === 'nickname' && ACCT.locked);

function acctHead(title, closable) {
  return `<div class="panel-head"><h2>${title}</h2>${closable ? '<button class="ghost" data-act="close" aria-label="닫기">✕</button>' : ''}</div>`;
}
const acctErr = () =>
  `<p class="muted" id="acctErr" role="alert" style="color:var(--danger);min-height:1.3em">${esc(ACCT.err)}</p>`;
function loginPanel() {
  return (
    acctHead('로그인', false) +
    `<p class="muted">서버(${esc(API.base)})에 이름으로 들어가요. 같은 이름으로 다시 들어오면 같은 계정이에요. (개발용 로그인)</p>
   <label class="muted" for="loginLabel">이름</label>
   <input id="loginLabel" maxlength="40" value="${esc(ACCT.label)}" autocomplete="off">
   ${acctErr()}
   <div class="foot"><button class="primary" data-act="login"${ACCT.busy ? ' disabled' : ''}>로그인</button></div>`
  );
}
function nicknamePanel() {
  return (
    acctHead(ACCT.locked ? '닉네임 정하기' : '닉네임 바꾸기', !ACCT.locked) +
    `<p class="muted">다른 사람에게 보이는 이름이에요. 한글·영문·숫자 1~5자이고 공백·이모티콘·특수문자는 쓸 수 없어요. 나중에 언제든 바꿀 수 있어요.</p>
   <input id="nickInput" maxlength="5" value="${esc(ACCT.nick)}" autocomplete="off" aria-label="닉네임">
   ${acctErr()}
   <div class="foot"><button class="primary" data-act="saveNick"${ACCT.busy ? ' disabled' : ''}>저장</button></div>`
  );
}

function openAccount(name, err = '') {
  ACCT.err = err;
  ACCT.busy = false;
  panelOpen = name;
  panelView = {};
  renderPanel();
  backdrop.classList.add('open');
  panel.scrollTop = 0;
  const input = panel.querySelector('input');
  if (input) input.focus({ preventScroll: true });
}
// 잠긴 창도 우리가 끝낼 때는 닫는다 (panelOpen을 먼저 비워 잠금 확인을 건너뛴다)
function finishAccountPanel() {
  panelOpen = null;
  closePanel();
}
const acctBtn = (id) => document.getElementById(id);
function showAccountButtons(on) {
  acctBtn('nickBtn').hidden = !on;
  acctBtn('logoutBtn').hidden = !on;
}
function applyUser(u) {
  S.user = { nickname: u.nickname, publicId: u.publicId }; // 핸들은 없다 (결정 #69). 다른 사람에게 보이는 번호는 publicId
  save();
  render();
}

// 로그인한 직후와 새로고침 때: 서버의 책·메모(books.js)와 켜진 스탠드·오늘 읽은 시간(sessions.js)을 불러온다
const afterSignIn = () => {
  HOUSE.at = 0; // 계정이 바뀌면 마을의 집을 다시 정한다 (neighbor-server.js)
  HOUSE.next = null;
  refreshNeighborHouses();
  loadIncomingRecommendation();
  startIncomingWatch();
  plazaReset(); // 다른 계정의 광장 글 표시가 남지 않게 (plaza.js)
  calReset(); // 다른 계정의 달력이 남지 않게. 이번 달은 다음 화면 그리기 때 서버에서 받는다 (calendar.js)
  return Promise.all([loadBooks(), loadSession(), loadRooms()])
    .then(() => {
      if (!PENDING_JOIN) return;
      const code = PENDING_JOIN;
      PENDING_JOIN = '';
      serverJoin(code);
    })
    .catch((e) => toast(e.message));
};

async function doLogin() {
  if (ACCT.busy) return;
  ACCT.label = document.getElementById('loginLabel').value.trim();
  ACCT.busy = true;
  try {
    const r = await API.post('/dev/login', { label: ACCT.label });
    API.setToken(r.token);
    applyUser(r.user);
    showAccountButtons(true);
    afterSignIn();
    if (r.user.needsNickname) {
      ACCT.locked = true;
      ACCT.nick = '';
      openAccount('nickname');
    } else {
      ACCT.locked = false;
      finishAccountPanel();
    }
  } catch (e) {
    ACCT.busy = false;
    ACCT.err = e.message;
    renderPanel();
  }
}
async function doSaveNick() {
  if (ACCT.busy) return;
  ACCT.nick = document.getElementById('nickInput').value; // 다듬지 않는다: 공백도 서버 규칙으로 거절된다
  ACCT.busy = true;
  try {
    const u = await API.put('/me/nickname', { nickname: ACCT.nick });
    applyUser(u);
    ACCT.locked = false;
    ACCT.busy = false;
    finishAccountPanel();
    toast('닉네임을 ' + u.nickname + '(으)로 정했어요');
  } catch (e) {
    ACCT.busy = false;
    if (panelOpen !== 'nickname') return; // 만료돼 로그인 창으로 바뀐 경우
    ACCT.err = e.message;
    renderPanel();
  }
}
async function doLogout() {
  try {
    await API.post('/auth/logout');
  } catch (e) {}
  API.setToken(null);
  showAccountButtons(false);
  ACCT.label = '';
  openAccount('login');
}
function accountAction(act) {
  if (act === 'login') doLogin();
  else if (act === 'saveNick') doSaveNick();
  else return false;
  return true;
}

// 시작 순서: 토큰이 없으면 로그인 창, 있으면 내 정보를 불러온다. 닉네임을 아직 안 정했으면 닉네임 정하기가 먼저다.
async function bootAccount() {
  if (!API.enabled) return;
  acctBtn('nickBtn').onclick = () => {
    ACCT.locked = false;
    ACCT.nick = S.user.nickname || '';
    openAccount('nickname');
  };
  acctBtn('logoutBtn').onclick = doLogout;
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'loginLabel') doLogin();
    else if (e.target.id === 'nickInput') doSaveNick();
  });
  API.onUnauthorized = () => {
    showAccountButtons(false);
    openAccount('login', '로그인이 만료됐어요. 다시 로그인해 주세요');
  };
  if (!API.token) return openAccount('login');
  try {
    const u = await API.get('/me');
    applyUser(u);
    showAccountButtons(true);
    afterSignIn();
    if (u.needsNickname) {
      ACCT.locked = true;
      ACCT.nick = '';
      openAccount('nickname');
    }
  } catch (e) {
    if (e.status !== 401) openAccount('login', e.message); // 401은 onUnauthorized가 이미 처리했다
  }
}
