// 내 방 · 스탠드 타이머, 바탕화면 띄우기, 60분·3시간 확인과 알림 줄 (room.js에서 이어진다)

const CAP = 3 * 3600000,
  CHECK = 3600000;
let pipWin = null;
function pipOK() {
  return 'documentPictureInPicture' in window;
}
function pipScene(on = true) {
  return flat(() => pipScene0(on));
}
function pipScene0(on) {
  const a = S.avatar,
    bc = S.reading ? bookColor(S.reading.title) : '#6d8f6b';
  let g = `<polygon points="${pts(
    Array.from({ length: 28 }, (_, j) => {
      const t = (j / 28) * Math.PI * 2;
      return P(4.9 + 1.6 * Math.cos(t), 5.2 + 1.6 * Math.sin(t), 0);
    }),
  )}" fill="#ffd46b" opacity="${on ? 0.35 : 0}" style="transition:opacity .4s"/>`;
  g +=
    box(4, 3.8, 0, 1.8, 1.8, 0.55, '#c9784c') +
    box(4, 3.8, 0.55, 0.45, 1.8, 0.95, '#c9784c') +
    box(4.45, 3.8, 0.55, 1.35, 0.35, 0.42, '#d48555') +
    box(4.45, 4.15, 0.55, 1.3, 1.1, 0.18, '#e39a68');
  g += G3 ? `<image href="${G3.snap(a, 'pip')}" x="-42" y="48" width="104" height="104"/>` : '';
  g += box(4.45, 5.25, 0.55, 1.35, 0.35, 0.42, '#d48555');
  const [gx, gy] = P(4.43, 6.23, 2.55);
  g +=
    `<g id="plamp" style="cursor:pointer">${hull(4.0, 5.8, 0, 0.9, 0.9, 3.3)}` +
    (on ? `<ellipse cx="${gx}" cy="${gy}" rx="26" ry="12" fill="#ffe08a" opacity=".5"/>` : '') +
    box(4.25, 6.05, 0, 0.36, 0.36, 0.08, '#6b5a48') +
    box(4.4, 6.2, 0.08, 0.06, 0.06, 2.6, '#6b5a48') +
    box(4.15, 5.95, 2.6, 0.56, 0.56, 0.55, on ? '#ffd46b' : '#e9dcc0') +
    `</g>`;
  return `<svg viewBox="-105 45 210 150" width="100%" style="display:block">${g}</svg>`;
}
async function openPip() {
  if (!pipOK()) {
    toast('이 브라우저는 바탕화면 띄우기를 지원하지 않아요');
    return;
  }
  if (pipWin) {
    pipWin.focus();
    return;
  }
  try {
    pipWin = await documentPictureInPicture.requestWindow({ width: 240, height: 250 });
  } catch (e) {
    toast('이 화면에서는 띄울 수 없어요. 파일로 열어서 크롬에서 해보세요');
    return;
  }
  const d = pipWin.document;
  d.title = '읽는 중';
  d.body.innerHTML = `<style>body{margin:0;background:#efe9da;font-family:"Gowun Dodum",system-ui,sans-serif;color:#3b3226;display:flex;flex-direction:column;height:100vh}
 #plamp .hull{fill:transparent;stroke:transparent;stroke-width:3}#plamp:hover .hull{stroke:#fff6d8}#plamp:hover{filter:brightness(1.08)}
 .t{font-size:26px;text-align:center;letter-spacing:1px}.b{display:flex;gap:6px;padding:0 10px 10px}
 button{flex:1;font:inherit;border:0;border-radius:10px;padding:8px;background:#4f7a5a;color:#fff;cursor:pointer;font-size:15px}
 .s{font-size:12px;text-align:center;color:#8a7d6a;margin-top:-2px}</style>
 <div id="scene" style="flex:1;min-height:0">${pipScene()}</div>
 <div class="t" id="pt">${fmtHMS(elapsed())}</div><div class="s" id="ps">『${esc(S.reading ? S.reading.title : '')}』</div>
 <div class="s" id="ph" style="margin:2px 0 10px">스탠드를 누르면 끝나요</div>`;
  d.getElementById('plamp').addEventListener('click', () => {
    if (!(S.session && S.session.status === 'RUNNING')) return;
    const sc = d.getElementById('scene');
    if (sc) sc.innerHTML = pipScene(false);
    setTimeout(() => (API.enabled ? serverStop('PIP') : endSession(Date.now(), 'PIP')), 450);
  });
  pipWin.addEventListener('pagehide', () => {
    pipWin = null;
  });
}
function pipDone(min) {
  const w = pipWin;
  if (!w) return;
  const d = w.document;
  const t = d.getElementById('pt'),
    s = d.getElementById('ps'),
    h = d.getElementById('ph'),
    sc = d.getElementById('scene');
  if (sc) sc.innerHTML = pipScene(false);
  if (t) t.textContent = min >= 1 ? min + '분 기록' : '기록 안 함';
  if (s) s.textContent = '스탠드를 껐어요';
  if (h) h.textContent = '';
  setTimeout(() => {
    try {
      w.close();
    } catch (e) {}
  }, 1800);
}
function elapsed() {
  return S.session ? Date.now() - S.session.startedAt : 0;
}
function fmtHMS(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    x = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0');
}
function fmtClock(e) {
  const d = new Date(e);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function fmtDay(e) {
  const d = new Date(e);
  return d.getMonth() + 1 + '.' + String(d.getDate()).padStart(2, '0');
}
function minOfBook(id) {
  return S.sessions.filter((x) => x.bookId === id).reduce((a, x) => a + x.minutes, 0);
}
const fmtMin = (m) => (m >= 60 ? Math.floor(m / 60) + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : '') : m + '분');
function todayMin() {
  const k = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
    t = k(Date.now());
  const base = API.enabled ? SES.todayBase : 0; // 서버 연결 모드: 로그인 때 서버가 센 오늘 분에 이 화면에서 끝낸 기록을 더한다
  return base + S.sessions.filter((x) => k(x.endedAt || x.startedAt) === t).reduce((a, x) => a + x.minutes, 0);
} // 달력과 같은 기준: 한국 시간, 종료일에 세션 전체를 센다
function startTimer() {
  if (!S.reading || S.session) return;
  if (API.enabled) return serverStartTimer(); // 서버가 기록을 만든다 (sessions.js)
  const now = Date.now();
  S.session = { id: now, bookId: S.reading.id, startedAt: now, lastCheckAt: now, status: 'RUNNING' };
  timerStarted();
}
function timerStarted() {
  save();
  panelView = {};
  render();
  renderPanel();
  toast('스탠드를 켰어요. 읽기 시작!');
  if (notifyState() === 'ask') askNotify();
  if (!isSit()) walkTo(...TARGET.sofa, sitDown);
}
function endSession(end, by, quiet) {
  if (S.session && S.session.status === 'NEEDS_CONFIRM' && by !== 'CONFIRM') end = S.session.lastCheckAt; // 확인 전에는 마지막으로 확인한 시각까지만 기록한다
  if (pipWin) {
    const mm = S.session ? Math.floor((end - S.session.startedAt) / 60000) : 0;
    pipDone(mm);
  }
  const ses = S.session;
  if (!ses) return;
  const min = Math.floor((end - ses.startedAt) / 60000);
  S.session = null; // 1분 미만(59초까지)은 기록하지 않는다
  if (min < 1) {
    if (!quiet) toast('1분 미만은 기록하지 않아요');
  } else {
    S.sessions.push({
      id: ses.id,
      bookId: ses.bookId,
      startedAt: ses.startedAt,
      endedAt: end,
      minutes: min,
      source: 'TIMER',
      endedBy: by,
    });
    if (!quiet) toast(min + '분 읽었어요. 스탠드를 껐어요');
  }
  save();
  panelView = {};
  render();
  renderPanel();
}
function checkSession(force) {
  const ses = S.session;
  if (!ses) return;
  if (ses.status === 'RUNNING' && Date.now() - ses.startedAt > CAP) {
    ses.status = 'NEEDS_CONFIRM';
    save();
    render();
    if (panelOpen === 'lamp') renderPanel();
    return;
  }
  if (force) {
    render();
    if (panelOpen === 'lamp' || !panelOpen) renderPanel();
  }
}

function notifyRow() {
  const st = notifyState();
  if (st === 'ask')
    return `<div class="row" style="margin-top:8px"><span class="muted grow">60분마다 읽고 있는지 알림으로 물어봐요</span><button data-act="askNotify">알림 켜기</button></div>`;
  if (st === 'on')
    return '<p class="muted">알림이 켜져 있어요. 60분마다 읽고 있는지 물어봐요. 이 페이지를 열어 둘 때 와요.</p>';
  if (st === 'off')
    return '<p class="muted">브라우저에서 알림이 꺼져 있어요. 주소창 옆 자물쇠에서 알림을 허용해 주세요.</p>';
  return '<p class="muted">이 브라우저는 알림을 지원하지 않아요. 화면의 안내로만 알려드려요.</p>';
}

function renderNotice() {
  const n = document.getElementById('notice');
  const ses = S.session;
  if (ses && ses.status === 'NEEDS_CONFIRM') {
    n.style.display = 'flex';
    n.innerHTML = `<span>${fmtClock(ses.startedAt)}에 켠 스탠드가 아직 켜져 있어요</span><button data-n="confirm">확인하기</button>`;
  } else if (ses && Date.now() - ses.lastCheckAt >= CHECK) {
    n.style.display = 'flex';
    n.innerHTML = `<span>아직 읽고 있어요? <small style="opacity:.7">(알림 예시)</small></span><button data-n="cont">계속</button><button data-n="stop">스탠드 끄기</button>`;
  } else n.style.display = 'none';
}

function bindRoomTimer() {
  document.getElementById('notice').addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.n === 'cont' && API.enabled) serverCheck();
    else if (b.dataset.n === 'cont') {
      S.session.lastCheckAt = Date.now();
      save();
      render();
      toast('계속 기록할게요');
    }
    if (b.dataset.n === 'stop') {
      openF('lamp');
      panelView = { mode: 'stop' };
      renderPanel();
    }
    if (b.dataset.n === 'confirm') {
      openF('lamp');
    }
  });
  setInterval(() => {
    if (!S.session) return;
    if (pipWin) {
      const el = pipWin.document.getElementById('pt');
      if (el) el.textContent = fmtHMS(elapsed());
    }
    checkSession();
    if (S.session && S.session.status === 'RUNNING') {
      const t = fmtHMS(elapsed());
      const a = document.getElementById('lampTime');
      if (a) a.textContent = t;
      const big = document.getElementById('timerBig');
      if (big) big.textContent = t;
      const ht = document.getElementById('homeT');
      if (ht) ht.textContent = t;
      document.getElementById('hdrStats').textContent = hdrText(' · ⏱ ' + t);
      const n = document.getElementById('notice');
      if (n.style.display === 'none' && Date.now() - S.session.lastCheckAt >= CHECK) renderNotice();
    }
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkSession(true);
  });
  addEventListener('pageshow', (e) => {
    if (e.persisted) checkSession(true);
  }); // 모바일 뒤로가기 캐시 복귀
}
