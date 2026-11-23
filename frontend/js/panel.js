// 공용 · 토스트, 가운데 창(panel) 열고 닫기, 데모 초기화

// toast
let tt;
function toast(m) {
  const t = document.getElementById('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('show'), 2200);
}

// panel
const panel = document.getElementById('panel'),
  backdrop = document.getElementById('backdrop');
backdrop.addEventListener('click', (e) => {
  if (e.target === backdrop) closePanel();
});
const FIRST = {
  plaza:
    '광장에서는 방에 들어가지 않아도 이웃과 짧게 이야기해요. 한 줄로 말하면 머리 위에 말풍선이 떠요. 글은 하루 뒤에 사라져요.',
  mirror: '거울에서 캐릭터를 꾸밀 수 있어요. 꾸민 모습은 마을과 공유방에서도 보여요.',
  window: '열린 공유방과 가져오기 마감일이 여기 떠요.',
  board: '공유방 일정과 지난 방을 한눈에 봐요. 종료된 방은 7일 안에 내 서재로 가져오세요.',
  'fire:new': '친구와 함께할 모닥불을 직접 피워요. 만들면 초대 링크가 생겨요.',
  lamp: '스탠드는 책을 읽는 동안 켜져 있어요.',
  calendar: '독서한 날이 표시되고, 이번 달 완독 목표를 정할 수 있어요.',
  shelf: '다 읽은 책이 꽂혀요. 책을 누르면 기록과 공유방 대화를 다시 볼 수 있어요.',
};
// 키보드로 창을 열면 포커스를 창 제목으로 옮기고, 닫으면 열었던 버튼으로 돌려놓는다
let focusBack = null;
function focusPanel() {
  const a = document.activeElement;
  if (!focusBack && a && a !== document.body) focusBack = a;
  const h = panel.querySelector('.panel-head h2');
  if (h) {
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}
function closePanel() {
  if (accountLocked()) return; // 로그인·처음 닉네임 정하기는 끝낼 때까지 닫지 않는다 (account.js)
  if (panelOpen === 'mirror') cancelMirror();
  panelOpen = null;
  backdrop.classList.remove('open');
  panelView = {};
  panel.innerHTML = '';
  renderCampModal();
  if (VIEW === 'shared') leaveCamp();
  if (focusBack && document.contains(focusBack)) focusBack.focus({ preventScroll: true });
  focusBack = null;
}
function zoom() {}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panelOpen) {
    if (VIEW === 'shared' && panelView.sheet) {
      panelView.sheet = null;
      renderPanel();
      return;
    }
    VIEW === 'shared' ? askExitCamp() : closePanel();
  }
});

function head(title, camp = false) {
  const ft = FIRST[panelOpen] && !S.seen[panelOpen] ? `<div class="firsttip">${FIRST[panelOpen]}</div>` : '';
  if (FIRST[panelOpen] && !S.seen[panelOpen]) {
    S.seen[panelOpen] = true;
    save();
  }
  return `<button class="handle" aria-label="패널 크기 바꾸기" data-act="handle"></button><div class="panel-head"><h2>${title}</h2>${camp ? '<button class="camp-collapse" data-act="campToggle" aria-label="대화창 접기">접기 ▾</button>' : ''}<button class="ghost" data-act="close" aria-label="닫기">✕</button></div>${ft}`;
}
function renderPanel() {
  const f = panelOpen;
  let h = '';
  panel.classList.toggle('wide', f === 'mirror');
  if (!f) {
    panel.innerHTML = '';
    return;
  }
  if (f === 'sofa') h = sofaPanel();
  if (f === 'lamp') h = lampPanel();
  if (f === 'shelf') h = shelfPanel();
  if (f === 'calendar') h = calendarPanel();
  if (f === 'board') h = boardPanel();
  if (f === 'fire:new') h = createPanel();
  if (f && f.startsWith('room:')) h = roomPanel(f.slice(5));
  if (f === 'mirror') h = mirrorPanel();
  if (f === 'window') h = windowPanel();
  if (f === 'neighborShelf') h = neighborShelfPanel();
  if (f === 'login') h = loginPanel();
  if (f === 'guestFail') h = guestFailPanel();
  if (f === 'transfer') h = transferPanel();
  if (f === 'nickname') h = nicknamePanel();
  panel.classList.toggle('rcchat', h.includes('id="rcLog"'));
  panel.innerHTML = h;
  if (f.startsWith('room:')) rcAfter(f.slice(5));
  renderCampModal();
}
const onPanelClick = (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'close') return VIEW === 'shared' ? askExitCamp() : closePanel();
  if (act === 'home') {
    openF(b.dataset.f);
    return;
  }
  if (act === 'handle') return panel.classList.toggle('full');
  if (act === 'askNotify') {
    askNotify();
    return;
  }
  if (
    accountAction(act) ||
    neighborAction(act, b) ||
    roomAction(act, b) ||
    villageAction(act, b) ||
    sharedRoomAction(act, b)
  )
    return;
};
panel.addEventListener('click', onPanelClick);
// 데모 초기화는 기록을 모두 지우므로 4초 안에 한 번 더 눌러야 실행된다
let resetArm = 0,
  resetT;
const resetBtn = document.getElementById('resetBtn');
if (API.enabled) resetBtn.style.display = 'none'; // 서버 연결 모드에서는 기록이 서버에 있어 지우는 버튼을 숨긴다
resetBtn.onclick = () => {
  if (!resetArm) {
    resetArm = 1;
    resetBtn.textContent = '한 번 더 누르면 모두 지워요';
    resetBtn.classList.add('armed');
    clearTimeout(resetT);
    resetT = setTimeout(() => {
      resetArm = 0;
      resetBtn.textContent = '데모 초기화';
      resetBtn.classList.remove('armed');
    }, 4000);
    return;
  }
  resetArm = 0;
  clearTimeout(resetT);
  resetBtn.textContent = '데모 초기화';
  resetBtn.classList.remove('armed');
  try {
    localStorage.removeItem('myroom-proto-v1');
  } catch (e) {}
  S = defaultState();
  S.onboard = 1;
  Object.assign(sim, {
    x: L.start[0],
    z: L.start[1],
    y: 0,
    mode: 'idle',
    after: null,
    mv: 0,
    sit: 0,
    k: 0,
    rot: Math.PI / 4,
  });
  tempAvatar = null;
  closePanel();
  render();
  toast('처음 상태로 되돌렸어요');
  entryFlash();
};
