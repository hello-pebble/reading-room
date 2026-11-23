// 계정 · 서버 연결 모드(?api=)의 시작·닉네임 창과 시작 순서 (서버 연결 1단계). ?api가 없으면 아무것도 하지 않는다.
// 기본은 게스트로 시작이다(결정 #84): 가입 없이 기기가 만든 무작위 키로 서버(POST /auth/guest)에 들어가고, 같은 기기는 같은 계정이다.
// 주소 끝에 &dev=1을 붙이면 예전처럼 이름으로 로그인하는 개발용 로그인(서버의 dev 프로파일 POST /dev/login)과 로그아웃을 쓴다.
const ACCT = { err: '', busy: false, locked: false, label: '', nick: '', xfer: null, xin: '' };
const DEV_LOGIN = (() => {
  try {
    return new URLSearchParams(location.search).has('dev');
  } catch (e) {
    return false;
  }
})();
// 로그인 창과 처음 닉네임 정하기는 끝낼 때까지 바깥 클릭·Esc로 닫을 수 없다
const accountLocked = () =>
  panelOpen === 'login' ||
  panelOpen === 'guestFail' ||
  ((panelOpen === 'nickname' || panelOpen === 'transfer') && ACCT.locked);

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
   <div class="foot"><button class="primary" style="width:100%" data-act="login"${ACCT.busy ? ' disabled' : ''}>로그인</button></div>`
  );
}
// 게스트로 시작하지 못했을 때(서버에 닿지 않음 등): 닫을 수 없고 다시 시도만 할 수 있다
function guestFailPanel() {
  return (
    acctHead('시작하지 못했어요', false) +
    `<p class="muted">서버(${esc(API.base)})에 연결해 시작하는 중에 문제가 생겼어요.</p>
   ${acctErr()}
   <div class="foot"><button class="primary" style="width:100%" data-act="guestRetry">다시 시도</button></div>`
  );
}
// 기기 옮기기(결정 #85): 이 기기에서 일회용 코드를 만들어 다른 기기에서 입력하거나, 다른 기기의 코드를 이 기기에 입력한다
const fmtCode = (c) => c.slice(0, 4) + '-' + c.slice(4);
function transferPanel() {
  const x = ACCT.xfer;
  const mine = x
    ? `<div id="xcode" style="font-size:28px;letter-spacing:4px;text-align:center;margin:10px 0">${esc(fmtCode(x.code))}</div>
     <p class="muted" style="text-align:center">${fmtClock(x.expiresAt)}까지 쓸 수 있고, 한 번만 쓸 수 있어요.</p>
     <div class="row"><button data-act="transferCopy">복사</button><button data-act="transferIssue"${ACCT.busy ? ' disabled' : ''}>새 코드</button></div>`
    : `<button class="primary" data-act="transferIssue"${ACCT.busy ? ' disabled' : ''}>코드 만들기</button>`;
  return (
    acctHead('기기 옮기기', !ACCT.locked) +
    `<div class="card"><b>이 기기의 계정을 다른 기기로</b>
     <p class="muted">코드를 만들어 다른 기기에서 입력하면 같은 계정으로 이어서 쓸 수 있어요. 코드는 10분 동안만, 한 번만 쓸 수 있어요.</p>${mine}</div>
   <div class="card"><b>다른 기기의 계정을 이 기기로</b>
     <p class="muted">다른 기기에서 만든 코드를 넣으면 이 기기가 그 계정으로 바뀌어요${ACCT.locked ? '' : '. 이 기기에 있는 지금 기록은 사라져요'}.</p>
     <input id="xin" maxlength="12" value="${esc(ACCT.xin)}" autocomplete="off" autocapitalize="characters" placeholder="ABCD-EFGH" aria-label="이전 코드">
     ${acctErr()}
     <button class="primary" data-act="transferRedeem" style="width:100%"${ACCT.busy ? ' disabled' : ''}>이 기기로 가져오기</button></div>
   ${ACCT.locked ? '<button class="ghost" data-act="openNickname" style="width:100%">← 닉네임 정하기로</button>' : ''}`
  );
}
function nicknamePanel() {
  return (
    acctHead(ACCT.locked ? '닉네임 정하기' : '닉네임 바꾸기', !ACCT.locked) +
    `<p class="muted">다른 사람에게 보이는 이름이에요. 한글·영문·숫자 1~5자이고 공백·이모티콘·특수문자는 쓸 수 없어요. 나중에 언제든 바꿀 수 있어요.</p>
   <input id="nickInput" maxlength="5" value="${esc(ACCT.nick)}" autocomplete="off" aria-label="닉네임">
   ${acctErr()}
   ${ACCT.locked ? '<div style="margin-top:14px"><p class="muted" style="margin:0 0 6px">다른 기기에서 쓰던 계정이 있나요?</p><button data-act="openTransfer" style="width:100%">다른 기기에서 가져오기</button></div>' : ''}
   <div class="foot"><button class="primary" style="width:100%" data-act="saveNick"${ACCT.busy ? ' disabled' : ''}>저장</button></div>`
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
  acctBtn('transferBtn').hidden = !on;
  acctBtn('logoutBtn').hidden = !on || !DEV_LOGIN; // 게스트는 기기가 곧 계정이라 로그아웃이 없다
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

// 게스트로 시작: 기기 키(처음 한 번 만들어 이 기기에만 저장)로 서버에 들어간다. 토큰이 만료돼도 같은 키로 조용히 다시 들어온다.
const DEVICE_KEY = 'myroom-device';
function deviceKey() {
  try {
    let k = localStorage.getItem(DEVICE_KEY);
    if (k && /^[A-Za-z0-9_-]{32,128}$/.test(k)) return k;
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    k = btoa(String.fromCharCode(...b))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    localStorage.setItem(DEVICE_KEY, k);
    return k;
  } catch (e) {
    return null;
  }
}
let guestBusy = false;
async function guestStart() {
  if (guestBusy) return;
  guestBusy = true;
  try {
    const key = deviceKey();
    if (!key) throw new Error('이 브라우저에서는 기기 키를 저장할 수 없어요');
    const r = await API.post('/auth/guest', { deviceKey: key });
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
    openAccount('guestFail', e.message);
  } finally {
    guestBusy = false;
  }
}

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
async function doTransferIssue() {
  if (ACCT.busy) return;
  ACCT.busy = true;
  ACCT.err = '';
  try {
    const r = await API.post('/me/transfer-code');
    ACCT.xfer = { code: r.code, expiresAt: Date.parse(r.expiresAt) };
  } catch (e) {
    ACCT.err = e.message;
  }
  ACCT.busy = false;
  if (panelOpen === 'transfer') renderPanel();
}
async function copyTransferCode() {
  if (!ACCT.xfer) return;
  try {
    await navigator.clipboard.writeText(fmtCode(ACCT.xfer.code));
    toast('코드를 복사했어요');
  } catch (e) {
    toast('코드를 길게 눌러 복사해 주세요');
  }
}
async function doTransferRedeem() {
  if (ACCT.busy) return;
  const el = document.getElementById('xin');
  ACCT.xin = el ? el.value : ACCT.xin;
  if (!ACCT.xin.trim()) {
    ACCT.err = '코드를 입력해 주세요';
    return renderPanel();
  }
  const key = deviceKey();
  if (!key) {
    ACCT.err = '이 브라우저에서는 기기 키를 저장할 수 없어요';
    return renderPanel();
  }
  ACCT.busy = true;
  ACCT.err = '';
  try {
    const r = await API.post('/auth/transfer', { code: ACCT.xin, deviceKey: key });
    API.setToken(r.token);
    applyUser(r.user);
    showAccountButtons(true);
    afterSignIn();
    ACCT.xin = '';
    ACCT.xfer = null;
    ACCT.busy = false;
    if (r.user.needsNickname) {
      ACCT.locked = true;
      ACCT.nick = '';
      openAccount('nickname');
    } else {
      ACCT.locked = false;
      finishAccountPanel();
      toast('다른 기기의 계정으로 바꿨어요');
    }
  } catch (e) {
    ACCT.busy = false;
    if (panelOpen !== 'transfer') return;
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
  else if (act === 'guestRetry') guestStart();
  else if (act === 'openTransfer') {
    ACCT.xfer = null;
    openAccount('transfer');
  } else if (act === 'openNickname') openAccount('nickname');
  else if (act === 'transferIssue') doTransferIssue();
  else if (act === 'transferCopy') copyTransferCode();
  else if (act === 'transferRedeem') doTransferRedeem();
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
  acctBtn('transferBtn').onclick = () => {
    ACCT.locked = false;
    ACCT.xfer = null;
    ACCT.xin = '';
    openAccount('transfer');
  };
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'loginLabel') doLogin();
    else if (e.target.id === 'nickInput') doSaveNick();
    else if (e.target.id === 'xin') doTransferRedeem();
  });
  API.onUnauthorized = () => {
    showAccountButtons(false);
    if (DEV_LOGIN) openAccount('login', '로그인이 만료됐어요. 다시 로그인해 주세요');
    else guestStart(); // 토큰이 만료돼도 같은 기기 키로 조용히 다시 들어온다
  };
  if (!API.token) return DEV_LOGIN ? openAccount('login') : guestStart();
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
    if (e.status !== 401) openAccount(DEV_LOGIN ? 'login' : 'guestFail', e.message); // 401은 onUnauthorized가 이미 처리했다
  }
}
