// 공유방: 모닥불 장면·개설·초대·대화·참여자·가져오기.
// 대화 버튼은 rcAct(), 나머지는 sharedRoomAction(), 초기 연결은 bindSharedRoomEvents().
// 이 파일은 공유방의 공용 부분(상수·시간 표기·모닥불 장면·카드·개설 기본값·초대 블록)이다. 대화=shared-chat.js·shared-chat-actions.js, 개설=shared-create.js, 버튼·이벤트 연결=shared-actions.js (같은 전역 범위에서 차례로 읽는다)

const RMAX = 10; // 공유방 최대 인원: 의자 6 + 서 있는 자리 4 (결정 #54, #41의 20명을 대체)

const PUBLIC_ROOMS = false; // 베타는 초대만 (결정 #41, 열린 결정 M ②). 켜면 개설 창에 "마을에 공개" 선택지가 다시 나온다

const shortTitle = (n) =>
  String(n.title || n.book || '')
    .replace(/[『』]/g, '')
    .replace(/\s*(같이 읽기|이야기방)\s*$/, '')
    .trim();
const HOUR = 36e5,
  sameDay = (a, b) => mmdd(a) === mmdd(b);
const clockEnd = (t) => (sameDay(t, Date.now()) ? '' : mmdd(t) + ' ') + fmtClock(t); // 오늘 끝나면 시각만, 다른 날이면 날짜도
const timeRange = (a, b) => mmdd(a) + ' ' + fmtClock(a) + ' ~ ' + (sameDay(a, b) ? '' : mmdd(b) + ' ') + fmtClock(b);
const roomLeft = (n) => (n.deleteAt ? Math.max(0, Math.ceil((n.deleteAt - Date.now()) / DAY)) : 0);
const roomSub = (n) => {
  if (n.kind === 'CLOSED' && n.deleteAt) return (n.done ? '가져옴 · ' : '') + '가져오기 마감 D-' + roomLeft(n);
  if (n.mine && n.kind === 'SOON')
    return mmdd(n.opensAt) + ' ' + fmtClock(n.opensAt) + ' 개방 · ' + n.people + '/' + n.max + '명';
  if (n.mine && n.kind === 'OPEN') return clockEnd(n.closesAt) + ' 종료 · ' + n.people + '/' + n.max + '명 참여 중';
  return n.sub;
};

let campSince = 0;
// 모닥불 장면에 머문 시간은 오늘 읽은 시간에 더한다. 스탠드 기록과 겹치는 구간은 한 번만 센다
function recordCampTime(n, end) {
  const a = campSince;
  campSince = 0;
  if (!a) return 0;
  end = Math.min(end, n && n.closesAt ? n.closesAt : end);
  let ms = Math.max(0, end - a);
  const ov = (s, e) => Math.max(0, Math.min(e, end) - Math.max(s, a));
  S.sessions.forEach((x) => {
    ms -= ov(x.startedAt, x.endedAt || x.startedAt);
  });
  if (S.session) ms -= ov(S.session.startedAt, end);
  const min = Math.floor(Math.max(0, ms) / 60000);
  if (min < 1) return 0;
  S.sessions.push({
    id: end,
    bookId: S.reading ? S.reading.id : null,
    startedAt: end - min * 60000,
    endedAt: end,
    minutes: min,
    source: 'CAMP',
    roomId: n ? n.id : null,
  });
  save();
  return min;
}
function enterCamp(n) {
  if (!n || n.kind !== 'OPEN' || !n.agreed || VIEW !== 'village') return;
  CAMP_ID = n.id;
  campSince = Date.now();
  VIEW = 'shared';
  const i = Math.max(
      0,
      vilOrder().findIndex((x) => x.id === n.id),
    ),
    [x, z] = VSLOTS[Math.min(i, VSLOTS.length - 1)];
  Object.assign(sim, {
    x: -2.24,
    z: -1.28,
    y: 0.18,
    rot: Math.atan2(2.24, 1.28),
    mode: 'sit',
    sit: 1,
    mv: 0,
    after: null,
  });
  const w = document.getElementById('stageWrap');
  w.classList.add('camp');
  w.appendChild(backdrop);
  backdrop.classList.add('camp');
  panel.setAttribute('aria-modal', 'false');

  document.getElementById('campChatToggle').textContent = '💬 대화 열기';
  if (G3) G3.setView('shared', n);
  buildSr();
  render();
  if (panelOpen) renderPanel(); // 장면이 바뀐 뒤 다시 그려야 대화창이 모닥불 장면용(대화만, 탭 없음)으로 나온다
}
// 시간이 다 돼서 모닥불이 꺼지면 장면에 있던 사람을 광장으로 보낸다
function endCampToPlaza(min) {
  closePanel();
  CAMP_ID = null;
  VIEW = 'village';
  Object.assign(sim, {
    x: PLAZA.cx,
    z: PLAZA.cz + 2.3,
    y: 0,
    mode: 'idle',
    sit: 0,
    mv: 0,
    rot: Math.PI / 4,
    after: null,
  });
  document.getElementById('stageWrap').classList.remove('camp', 'min');
  backdrop.classList.remove('camp', 'min');
  document.body.appendChild(backdrop);
  panel.setAttribute('aria-modal', 'true');
  if (G3) G3.setView('village');
  buildSr();
  render();
  toast('모닥불이 꺼졌어요. 광장으로 돌아왔어요' + (min ? ' · ' + min + '분을 읽은 시간에 더했어요' : ''));
}
function leaveCamp() {
  if (VIEW !== 'shared') return;
  recordCampTime(
    S.news.find((x) => x.id === CAMP_ID),
    Date.now(),
  );
  const i = Math.max(
      0,
      vilOrder().findIndex((x) => x.id === CAMP_ID),
    ),
    [x, z] = VSLOTS[Math.min(i, VSLOTS.length - 1)];
  CAMP_ID = null;
  VIEW = 'village';
  Object.assign(sim, { x: x + 0.9, z: z + 0.9, y: 0, mode: 'idle', sit: 0, mv: 0, rot: Math.PI / 4, after: null });
  document.getElementById('stageWrap').classList.remove('camp', 'min');
  backdrop.classList.remove('camp', 'min');
  document.body.appendChild(backdrop);
  panel.setAttribute('aria-modal', 'true');
  if (G3) G3.setView('village');
  buildSr();
  render();
}
// 모닥불 장면에서 ✕·← 마을로·Esc를 누르면 바로 나가지 않고 한 번 묻는다 (접어 둔 상태면 창을 다시 펼쳐서 묻는다)
function askExitCamp() {
  if (VIEW !== 'shared') return closePanel();
  if (backdrop.classList.contains('min')) toggleCampChat();
  panelView.sheet = null;
  panelView.exitAsk = true;
  renderPanel();
}
function toggleCampChat() {
  if (VIEW !== 'shared') return;
  const min = backdrop.classList.toggle('min');
  document.getElementById('stageWrap').classList.toggle('min', min);
  if (!min) focusPanel();
}

// 모닥불 장면의 참여자·방 정보 모달 (대화창과 따로). panelView.sheet가 'members' 또는 'info'일 때만 뜬다
function renderCampModal() {
  const m = document.getElementById('campModal'),
    p = document.getElementById('campModalPanel'),
    v = panelView.sheet,
    n = S.news.find((x) => x.id === CAMP_ID);
  const on = VIEW === 'shared' && !!n && (v === 'members' || v === 'info');
  m.classList.toggle('open', on);
  document
    .querySelectorAll('#campSide [data-camp]')
    .forEach((b) => b.classList.toggle('on', on && v === b.dataset.camp));
  if (!on) {
    p.innerHTML = '';
    return;
  }
  const old = p.querySelector('.cm-body'),
    top = old ? old.scrollTop : 0,
    [body, foot] = v === 'members' ? [rcMembersHtml(n), ''] : rcInfoHtml(n, true);
  p.innerHTML = `<div class="panel-head"><h2>${v === 'members' ? '참여자' : '방 정보'}</h2><button class="ghost" data-act="cmClose" aria-label="닫기">✕</button></div><div class="cm-body">${body}</div>${foot ? `<div class="foot">${foot}</div>` : ''}`;
  const nb = p.querySelector('.cm-body');
  if (nb) nb.scrollTop = top; // 다시 그려도 스크롤 위치를 지킨다
}

// 공유방 카드: 마을 게시판, 모닥불 창이 함께 쓴다
function roomCard(n, noAct, hideTitle) {
  const K = { OPEN: ['진행 중', ''], SOON: ['예정', 'gray'], CLOSED: ['종료', 'warn'] }[n.kind];
  let act = '';
  if (n.kind === 'OPEN') act = `<button class="primary" data-act="enterRoom" data-id="${n.id}">들어가기</button>`;
  if (n.kind === 'SOON')
    act = `<button data-act="alarm" data-id="${n.id}">${n.alarm ? '알림 받는 중 ✓' : '알림 받기'}</button>`;
  if (n.kind === 'CLOSED')
    act = n.done
      ? `<span class="muted">내 서재로 가져옴 ✓</span>`
      : rcEmpty(n)
        ? `<span class="muted">가져올 대화가 없어요</span>`
        : `<button class="primary" data-act="import" data-id="${n.id}">내 서재로 가져오기</button>`;
  if (noAct) act = '';
  const tag = n.rtype ? `<span class="badge gray">${n.rtype === 'OWN' ? '각자 읽기' : '같은 책'}</span>` : '';
  return `<div class="card"><div class="row"><span class="badge ${K[1]}">${K[0]}</span>${tag}${rcUnread(n) ? '<span class="badge">새 글</span>' : ''}${hideTitle ? '' : `<b class="grow" style="font-weight:normal">${esc(n.title)}</b>`}</div><div class="muted" style="margin:6px 0 8px">${esc(roomSub(n))}${n.period ? ' · ' + esc(n.period) : ''}</div>${act}</div>`;
}

// ===== 모닥불 피우기 (공유방 개설) =====
const RDEF = () => ({
  kind: 'SAME',
  bookSel: S.reading ? 'sofa' : '',
  bookTitle: '',
  name: '',
  start: 'now',
  when: '',
  hours: 3,
  vis: 'invite',
  max: 8,
});
const nfBook = (nf) => {
  if (nf.bookSel === 'sofa' && S.reading) {
    const r = S.reading;
    return { title: r.title, author: r.author, cover: r.cover || '', isbn: r.isbn || '' };
  }
  if (nf.bookSel && nf.bookSel.startsWith('shelf:')) {
    const b = S.finished[+nf.bookSel.slice(6)];
    return b ? { title: b.title, author: b.author, cover: b.cover || '', isbn: b.isbn || '' } : null;
  }
  if (nf.bookSel === 'typed' && nf.bookTitle.trim())
    return { title: nf.bookTitle.trim(), author: '', cover: '', isbn: '' };
  return null;
};
const defaultRoomName = (nf) => {
  const b = nfBook(nf);
  return nf.kind === 'SAME' ? (b ? '『' + b.title + '』 같이 읽기' : '같이 읽기') : S.user.nickname + '의 모닥불';
};
const inviteLink = (n) => location.href.split('#')[0] + '#join=' + n.inviteCode;
const genCode = () => {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
};
// 직접 그린 단순한 아이콘 (복사: 겹친 사각형, 확인: 체크, 공유: 점 셋을 이은 모양)
const ICON_COPY =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="8.5" width="12" height="13" rx="2.6"/><path d="M8.5 4.4h9a2.6 2.6 0 0 1 2.6 2.6v9.2"/></svg>',
  ICON_CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  ICON_SHARE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.3 10.9l7.4-3.8M8.3 13.1l7.4 3.8"/></svg>';
// 초대 링크: 링크 칸 옆에 복사(공유) 아이콘 버튼. 상자로 감싸지 않고 참여자 창처럼 글자 중심으로 보인다
function inviteBlock(n) {
  return `<div class="rinv"><div class="rlbl">초대 링크</div><div class="rcopy"><input id="invLink" readonly value="${esc(inviteLink(n))}" aria-label="초대 링크"><button class="ibtn" data-act="copyLink" data-id="${n.id}" aria-label="링크 복사" title="링크 복사">${ICON_COPY}</button>${navigator.share ? `<button class="ibtn" data-act="shareLink" data-id="${n.id}" aria-label="공유" title="공유">${ICON_SHARE}</button>` : ''}</div><div class="muted" style="margin-top:6px">초대 코드 ${n.inviteCode}${n.vis === 'public' ? ' · 마을 게시판에도 보여요' : ''}</div><div class="muted">${API.enabled ? '링크를 받은 사람이 로그인한 뒤 열면 이 방에 들어올 수 있어요.' : '체험판에서는 이 브라우저에서 만든 모닥불만 열려요.'}</div></div>`;
}
