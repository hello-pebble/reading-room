// 공용 · 화면 그리기(render), 접근성 버튼, 코치, 툴팁·클릭, 지도 끌기

function bookColor(t) {
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SPINE[h % SPINE.length];
}

// 공통 날짜·시간 표시
const hhmm = (ts) => new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
const DAY = 864e5;
const mmdd = (ts) => {
  const [, m, d] = new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).split('-');
  return +m + '.' + d;
};
function hdrText(extra) {
  const c = calData();
  return (
    (S.user.handle ? '@' + S.user.handle + ' · ' : '') + // 서버 모드에는 핸들이 없다 (결정 #69)
    '읽은 책 ' +
    S.finished.length +
    '권' +
    (c.streak ? ' · ' + c.streak + '일 연속 기록' : '') +
    ' · 오늘 ' +
    todayMin() +
    '분' +
    (extra || '')
  );
}
function render() {
  const a = avatarNow();
  const cal = calData();
  const reading = !!S.reading;
  const ses = S.session,
    lampOn = !!ses && ses.status === 'RUNNING',
    lampWarn = !!ses && ses.status === 'NEEDS_CONFIRM';
  const sitting = isSit();
  const onboardDim = (f) => (S.onboard === 1 ? f !== 'sofa' : S.onboard === 2 ? f !== 'lamp' : false);
  const winNew =
    S.news.some((n) => n.kind === 'CLOSED' && !n.done && !rcEmpty(n) && !S.newsSeen[n.id]) || S.news.some(rcUnread); // 가구는 움직이지 않고, 신규 알림은 노란 별로만 알린다. 참여 중인 방의 안 읽은 글도 별 (RC-16)
  const openRooms = S.news.filter((n) => n.kind === 'OPEN').length;
  const visiting = VIEW === 'neighbor',
    gift = currentGift();
  if (G3)
    G3.sync({
      a,
      reading: visiting ? false : reading,
      title: reading ? S.reading.title : '',
      sitting,
      lampOn: !visiting && lampOn,
      lampWarn: !visiting && lampWarn,
      dim: visiting ? () => false : onboardDim,
      openRooms,
      newItem: S.newItem,
      winNew,
      gift,
      books: visiting ? ['모모', '데미안', '어린 왕자'] : S.finished.slice(-((L.K || 7) * 4)).map((b) => b.title),
      cal: visiting ? { ...cal, marks: [], done: 0, goal: 1 } : cal,
      win: windowScene(),
      vil: vilList(),
    });
  document.getElementById('stageWrap').classList.toggle('neighbor', visiting);
  document.getElementById('giftMark').style.display = VIEW === 'room' && gift ? 'block' : 'none';
  // 화면 위 표시
  const nt = document.getElementById('nameTag');
  {
    const r = VIEW === 'shared' ? S.news.find((n) => n.id === CAMP_ID) : null;
    nt.textContent = S.user.nickname + (r && r.book ? rcBookTag(r, '나') : '');
  }
  const ll = document.getElementById('lampLabel');
  ll.style.display = VIEW === 'room' && (lampOn || lampWarn) ? 'block' : 'none';
  ll.className = 'ov' + (lampWarn ? ' warn spark' : '');
  ll.innerHTML = `<span id="lampTime">${lampWarn ? '확인 필요' : fmtHMS(elapsed())}</span>`;
  document.getElementById('newMark').style.display = VIEW === 'room' && S.newItem ? 'block' : 'none';
  document.getElementById('newMarkWin').style.display = VIEW === 'room' && winNew ? 'block' : 'none';
  document.getElementById('newMarkSofa').style.display = VIEW === 'room' && !reading ? 'block' : 'none';
  // header
  document.getElementById('hdrName').textContent = visiting
    ? neighborNow().name + '의 집'
    : VIEW === 'village'
      ? S.user.nickname + ' · 마을'
      : VIEW === 'shared'
        ? '모닥불 · ' + (S.news.find((n) => n.id === CAMP_ID)?.title || '공유방')
        : S.user.nickname + '의 방';
  document
    .getElementById('stage')
    .setAttribute(
      'aria-label',
      visiting ? '이웃집 책장' : VIEW === 'shared' ? '공유방 모닥불' : VIEW === 'village' ? '마을' : '내 방',
    );
  document.getElementById('online').textContent =
    '접속 (' + String(NPCS.length + 1).padStart(2, '0') + '/' + VMAX + ')'; // 마을 접속 인원/정원. 체험판은 보이는 이웃 수 + 나
  document.getElementById('hdrStats').textContent = hdrText(lampOn ? ' · ⏱ ' + fmtHMS(elapsed()) : '');
  renderNotice();
  document.getElementById('hdrAvatar').innerHTML = G3
    ? `<img src="${G3.snap(a, 'head')}" alt="" width="40" height="40">`
    : '';
  const hint = document.getElementById('hint');
  if (sitting) {
    hint.style.display = 'block';
    hint.textContent = reading
      ? '소파에 앉아 『' + S.reading.title + '』 읽는 중'
      : '소파에 앉았어요 · 읽을 책을 올려보세요';
  } else {
    hint.textContent = '가구를 눌러 사용 · 바닥을 눌러 이동';
    hint.style.display = 'none';
  }
  if (S.onboard) hint.style.display = 'none';
  if (VIEW !== 'room') hint.style.display = 'none'; // 마을과 모닥불은 설명문 없이
  renderCoach();
}

const LABEL = {
  sofa: '소파',
  lamp: '스탠드',
  shelf: '책장',
  calendar: '달력',
  mirror: '전신거울',
  window: '창문',
  door: '문',
};
function stateLabel(f) {
  if (VIEW === 'neighbor') return f === 'shelf' ? '이웃집 책장 · 추천 책 꽂기' : '마을로 돌아가기';
  if (f && f.startsWith('neighbor:'))
    return (NEIGHBORS.find((n) => n.id === f.slice(9))?.name || '이웃') + '의 집 방문';
  if (f === 'sofa') return S.reading ? '소파 · 『' + S.reading.title + '』 읽는 중' : '소파 · 읽을 책 올리기';
  if (f === 'lamp')
    return S.session
      ? S.session.status === 'RUNNING'
        ? '스탠드 · 켜짐 ' + fmtHMS(elapsed())
        : '스탠드 · 확인 필요'
      : '스탠드 · 꺼짐';
  if (f === 'shelf') return '책장 · ' + S.finished.length + '권';
  if (f === 'calendar') {
    const c = calData();
    return '달력 · 이번 달 완독 ' + c.done + '/' + c.goal + '권';
  }
  if (f === 'mirror') return S.newItem ? '전신거울 · 새 아이템' : '전신거울 · 꾸미기';
  if (f === 'window') return '창문';
  if (f === 'door') return '문 · 마을로 나가기';
  if (f === 'board') return '마을 게시판 · 열린 방 ' + S.news.filter((n) => n.kind === 'OPEN').length + '개';
  if (f === 'home') return '내 방으로 들어가기';
  if (f === 'plaza') return '마을 광장 · 이웃과 이야기하기';
  if (f === 'fire:new') return '빈 모닥불 자리 · 모닥불 피우기';
  if (f && f.startsWith('room:')) {
    const n = S.news.find((x) => x.id === f.slice(5));
    return n
      ? shortTitle(n) + ' · ' + { OPEN: '열려 있어요', SOON: '곧 열려요', CLOSED: '종료 · ' + roomSub(n) }[n.kind]
      : '';
  }
}
// sr buttons in tab order
const ORDER = ['sofa', 'lamp', 'shelf', 'calendar', 'mirror', 'window', 'door'];
const srWrap = document.getElementById('srBtns');
const curOrder = () =>
  VIEW === 'neighbor'
    ? ['shelf', 'door']
    : VIEW === 'shared'
      ? []
      : VIEW === 'village'
        ? [
            'board',
            'plaza',
            ...NEIGHBORS.map((n) => 'neighbor:' + n.id),
            ...vilOrder()
              .slice(0, VSLOTS.length)
              .map((n) => 'room:' + n.id),
            ...(vilOrder().length < VSLOTS.length ? ['fire:new'] : []),
            'home',
          ]
        : ORDER;
const labelOf = (f) =>
  f === 'board'
    ? '마을 게시판'
    : f === 'plaza'
      ? '광장 이야기'
      : f === 'home'
        ? '내 방으로'
        : f === 'fire:new'
          ? '모닥불 피우기'
          : f.startsWith('room:')
            ? shortTitle(S.news.find((n) => n.id === f.slice(5)) || {}) + ' 모닥불'
            : LABEL[f];
function buildSr() {
  srWrap.innerHTML = '';
  curOrder().forEach((f) => {
    const b = document.createElement('button');
    b.dataset.f = f;
    b.textContent = labelOf(f);
    b.addEventListener('focus', () => {
      b.setAttribute('aria-label', stateLabel(f));
      hl(f, true);
    });
    b.addEventListener('blur', () => hl(f, false));
    if (f.startsWith('neighbor:')) b.textContent = stateLabel(f);
    b.addEventListener('click', () =>
      VIEW === 'neighbor' ? openNeighbor(f) : VIEW === 'village' ? openV(f) : openF(f),
    );
    srWrap.appendChild(b);
  });
}
buildSr();
function hl(f, on) {
  if (G3) G3.setHover(on ? f : null);
}

// coach
function renderCoach() {
  const c = document.getElementById('coach');
  if (S.onboard === 1) {
    c.style.display = 'flex';
    c.innerHTML = '<span>소파를 눌러 지금 읽는 책을 올려보세요</span><button id="skipOb">건너뛰기</button>';
  } else if (S.onboard === 2) {
    c.style.display = 'flex';
    c.innerHTML = '<span>책을 올렸어요. 스탠드를 켜면 읽는 시간이 기록돼요</span><button id="okOb">확인</button>';
  } else c.style.display = 'none';
  const sk = document.getElementById('skipOb');
  if (sk)
    sk.onclick = (e) => {
      e.stopPropagation();
      S.onboard = 0;
      save();
      render();
    };
  const ok = document.getElementById('okOb');
  if (ok)
    ok.onclick = (e) => {
      e.stopPropagation();
      S.onboard = 0;
      save();
      render();
    };
}

// tooltip + click
const tip = document.getElementById('tip');
const canHover = window.matchMedia('(hover: hover)').matches;
canvas.addEventListener('pointermove', (e) => {
  if (!G3 || drag.on) return;
  const p = G3.pick(e);
  const f = (p && p.f) || null;
  if (canHover) G3.setHover(f);
  canvas.style.cursor = p && (p.f || p.floor) ? 'pointer' : 'default';
  if (!canHover || !f) {
    tip.style.display = 'none';
    return;
  }
  tip.textContent = stateLabel(f);
  tip.style.display = 'block';
  tip.style.left = e.clientX + 14 + 'px';
  tip.style.top = e.clientY + 14 + 'px';
});
canvas.addEventListener('pointerleave', () => {
  tip.style.display = 'none';
  if (G3) G3.setHover(null);
});
// 지도 끌기(마을): 누르고 끌면 지도(카메라)가 움직인다. 캐릭터는 그대로이고, 걸어가라고 하면 다시 캐릭터를 따라간다. 6px 넘게 움직였을 때만 끌기로 보고, 짧은 클릭은 기존대로
const drag = { id: null, x: 0, y: 0, on: false };
let suppressClick = false;
canvas.addEventListener('pointerdown', (e) => {
  if (!G3 || VIEW !== 'village' || e.button > 0) return;
  if (!G3.panStart(e)) return;
  drag.id = e.pointerId;
  drag.x = e.clientX;
  drag.y = e.clientY;
  drag.on = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== drag.id) return;
  if (!drag.on) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag.on = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    tip.style.display = 'none';
    canvas.style.cursor = 'grabbing';
  }
  G3.panMove(e);
});
const dragEnd = (e) => {
  if (e.pointerId !== drag.id) return;
  drag.id = null;
  G3.panEnd();
  if (drag.on) {
    drag.on = false;
    canvas.style.cursor = 'default';
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 80);
  }
}; // 끌었으면 뒤따르는 클릭은 무시한다
canvas.addEventListener('pointerup', dragEnd);
canvas.addEventListener('pointercancel', dragEnd);
canvas.addEventListener('contextmenu', (e) => {
  if (drag.on || drag.id !== null) e.preventDefault();
});
canvas.addEventListener('click', (e) => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (!G3) return;
  const p = G3.pick(e);
  if (VIEW === 'shared') return;
  if (p && p.f) {
    VIEW === 'neighbor' ? openNeighbor(p.f) : VIEW === 'village' ? openV(p.f) : openF(p.f);
    return;
  }
  if (p && p.floor) {
    walkTo(Math.max(L.minX || 1.1, Math.min(L.X - 0.4, p.x)), Math.max(L.minZ || 0.8, Math.min(L.Y - 0.4, p.z)));
    return;
  }
  if (panelOpen && panelOpen !== 'mirror') closePanel();
});
