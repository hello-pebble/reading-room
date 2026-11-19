// 마을: 지도·이웃·이동·미니맵·게시판·광장 대화.
// 버튼은 villageAction(), 초기 연결은 bindVillageEvents(). 3D는 scene.js.

// 마을: 문으로 나가면 들어가는 장면. 방과 같이 크기가 고정이다.
// 마을은 두 구역으로 나뉜다: 가운데 돌바닥 "광장"(누구와도 짧게 대화)과 동쪽 흙바닥 "모닥불 구역"(공유방, 대화는 방 안에서만)
const VSLOTS = [
  [26.0, 6.2],
  [32.0, 8.7],
  [26.0, 11.2],
  [32.0, 13.7],
  [26.0, 16.2],
  [32.0, 18.7],
  [26.0, 21.2],
  [32.0, 23.7],
]; // 공유방 모닥불 자리 (빈 자리 하나는 "모닥불 피우기")
const PLAZA = { x0: 1.6, z0: 10.0, x1: 14.6, z1: 20.0, cx: 8.1, cz: 15.0 }; // 대화 가능 구역 (13×10칸). 이 안에 있을 때만 말풍선으로 말할 수 있다
const VMAX = 100; // 마을 동시 접속 정원 (결정 #41, 조정 가능)
const ZONE = { x0: 23.0, z0: 4.0, x1: 35.4, z1: 25.6, g0: 4.5, g1: 6.7 }; // 모닥불 구역 (12×21.6칸). g0~g1은 울타리 입구 (위쪽 길이 닿는 북서쪽)
const inPlaza = (x, z) => x > PLAZA.x0 && x < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1;
// 체험판용 가짜 이웃. 서버가 생기면 그날 광장에 온 실제 사람으로 바뀐다
const NPCS = [
  { name: '나무', x: 4.6, z: 12.6, av: { color: '#e6f4e0', expr: 'happy', face: 'none', head: 'sprout', prop: 'mug' } },
  {
    name: '달빛',
    x: 12.0,
    z: 12.8,
    av: { color: '#e8e4ff', expr: 'sleepy', face: 'glasses', head: 'none', prop: 'book' },
  },
  { name: '구름', x: 5.6, z: 17.8, av: { color: '#ffe6ec', expr: 'wink', face: 'none', head: 'bow', prop: 'balloon' } },
  {
    name: '바다',
    x: 11.6,
    z: 17.6,
    av: { color: '#e0f0fb', expr: 'normal', face: 'sunglasses', head: 'none', prop: 'lantern' },
  },
  {
    name: '모래',
    x: 8.4,
    z: 11.6,
    av: { color: '#fbeed6', expr: 'surprised', face: 'none', head: 'beanie', prop: 'none' },
  },
];
const NPC_SAY = [
  '오늘 몇 쪽 읽었어요?',
  '방금 한 권 완독했어요!',
  '비 오는 날엔 스탠드 켜고 읽는 게 최고예요',
  '『아몬드』 읽어 본 분 계세요?',
  '저는 지금 150쪽쯤이에요',
  '모닥불에서 같이 읽을 분~',
  '30분만 읽어도 오늘은 성공이죠',
  '다음엔 어떤 책 읽을지 고민 중이에요',
];
const NPC_REPLY = ['저도요!', '오, 좋은데요', '어떤 책이에요?', '화이팅이에요', '같이 읽어요'];
const VIL = { X: 36, Y: 27, minX: 1.2, minZ: 3.4, start: [4.0, 4.0], home: [4.0, 3.8] }; // 걸어 다니는 큰 마을. 카메라가 유령을 따라간다

// 모닥불 자리는 8개뿐이라 열린 방 → 곧 열릴 방 → 종료된 방 순으로 자리를 준다 (종료된 방은 게시판에는 계속 보인다)
const vilOrder = () =>
  [...S.news]
    .filter((n) => n.kind !== 'CLOSED')
    .sort((a, b) => (a.kind === 'OPEN' ? 0 : 1) - (b.kind === 'OPEN' ? 0 : 1)); // 종료된 방은 마을에 모닥불이 없고 게시판(지난 방)에만 7일 남는다
const vilList = () =>
  vilOrder().map((n) => ({
    unread: rcUnread(n),
    id: n.id,
    kind: n.kind,
    short: shortTitle(n),
    done: !!n.done,
    alarm: !!n.alarm,
    left: roomLeft(n),
    opens: n.opensAt ? mmdd(n.opensAt) : '',
  }));
function enterVillage() {
  if (VIEW === 'village') return;
  closePanel();
  const w = document.getElementById('stageWrap');
  w.classList.add('fading');
  setTimeout(() => {
    ROOM_L = L;
    VIEW = 'village';
    L = VIL;
    Object.assign(sim, {
      x: VIL.start[0],
      z: VIL.start[1],
      y: 0,
      mode: 'idle',
      after: null,
      mv: 0,
      sit: 0,
      k: 0,
      rot: Math.PI / 4,
    });
    if (G3) G3.setView('village');
    buildSr();
    render();
    w.classList.remove('fading');
  }, 260);
}
function leaveVillage() {
  if (VIEW !== 'village') return;
  closePanel();
  const w = document.getElementById('stageWrap');
  w.classList.add('fading');
  setTimeout(() => {
    VIEW = 'room';
    L = ROOM_L;
    Object.assign(sim, {
      x: TARGET.door[0],
      z: TARGET.door[1] + 0.3,
      y: 0,
      mode: 'idle',
      after: null,
      mv: 0,
      sit: 0,
      k: 0,
      rot: Math.PI / 4,
    });
    if (G3) G3.setView('room');
    buildSr();
    render();
    w.classList.remove('fading');
  }, 260);
}

// 마을 미니맵: 정사각형 상자에 마을 전체를 위에서 내려다본 모양으로 보여준다 (x는 오른쪽, z는 아래). 위아래 남는 자리는 바깥 숲 색. 노란 점이 나
const mini = document.getElementById('minimap'),
  mctx = mini.getContext('2d');
function drawMini() {
  if (VIEW !== 'village' || !G3) return;
  const W = mini.width,
    H = mini.height,
    pad = 8,
    k = (W - 2 * pad) / VIL.X,
    ox = pad,
    oy = (H - VIL.Y * k) / 2;
  const P = (x, z) => [ox + x * k, oy + z * k];
  const quad = (x0, z0, x1, z1, c) => {
    const [a, b] = P(x0, z0),
      [e, f] = P(x1, z1);
    mctx.fillStyle = c;
    mctx.fillRect(a, b, e - a, f - b);
  };
  const dot = (x, z, c, r, ring) => {
    const [a, b] = P(x, z);
    mctx.beginPath();
    mctx.arc(a, b, r, 0, 7);
    if (ring) {
      mctx.strokeStyle = c;
      mctx.lineWidth = 2;
      mctx.stroke();
    } else {
      mctx.fillStyle = c;
      mctx.fill();
    }
  };
  const txt = (s, x, z) => {
    const [a, b] = P(x, z);
    mctx.fillText(s, a, b);
  };
  mctx.fillStyle = '#8fbf78';
  mctx.fillRect(0, 0, W, H);
  quad(0, 0, VIL.X, VIL.Y, '#a9d48c');
  quad(16.4, 19.6, 21.6, 23.8, '#7fb6d8');
  [
    [3.6, 3.0, 4.6, 10.0],
    [PLAZA.x1, 11.0, 22.7, 13.2],
    [4.6, 4.6, 22.7, 5.6],
    [22.0, 4.6, 22.7, 13.2],
  ].forEach((r) => quad(...r, '#cdb890')); // 길 (갈림길 포함)
  quad(PLAZA.x0, PLAZA.z0, PLAZA.x1, PLAZA.z1, '#e6dcc4');
  quad(ZONE.x0, ZONE.z0, ZONE.x1, ZONE.z1, '#a88f68');
  G3.houses().forEach(([x, y, w, d, m]) => quad(x, y, x + w, y + d, m ? '#c0542f' : '#8a6a45'));
  mctx.font = 'bold 20px sans-serif';
  mctx.textAlign = 'center';
  mctx.textBaseline = 'middle';
  mctx.fillStyle = '#6b5f4c';
  txt('광장', PLAZA.cx, PLAZA.z1 - 1.6);
  vilOrder()
    .slice(0, VSLOTS.length)
    .forEach((n, i) =>
      dot(
        VSLOTS[i][0],
        VSLOTS[i][1],
        n.kind === 'OPEN' ? '#e8764a' : n.kind === 'SOON' ? '#f3f0e8' : n.done ? '#7aa7e0' : '#6d665e',
        5,
      ),
    );
  if (vilOrder().length < VSLOTS.length) {
    const s = VSLOTS[vilOrder().length];
    dot(s[0], s[1], '#f3f0e8', 4.5, true);
  }
  G3.npcs().forEach(([x, z]) => dot(x, z, '#5f9a5a', 3));
  dot(sim.x, sim.z, '#3b3226', 7);
  dot(sim.x, sim.z, '#ffd23f', 4.6);
}

// 마을의 게시판·모닥불·내 방
function vTarget(f) {
  if (f === 'board') return [PLAZA.x0 + 7.3, PLAZA.z0 + 0.7];
  if (f === 'plaza') return [PLAZA.cx, PLAZA.cz + 2.3];
  const i =
      f === 'fire:new'
        ? vilOrder().length
        : Math.max(
            0,
            vilOrder().findIndex((n) => 'room:' + n.id === f),
          ),
    s = VSLOTS[Math.min(i, VSLOTS.length - 1)];
  return [Math.min(VIL.X - 0.8, s[0] + 0.9), Math.min(VIL.Y - 0.8, s[1] + 0.9)];
}
function openV(f) {
  if (f.startsWith('neighbor:')) {
    visitNeighbor(f.slice(9));
    return;
  }
  if (f === 'home') {
    closePanel();
    walkTo(VIL.home[0], VIL.home[1], () => leaveVillage());
    return;
  }
  if (f === 'plaza') {
    closePanel();
    walkTo(...vTarget(f), () => {
      if (canHover) {
        const i = document.getElementById('pz');
        if (i && pzShown) i.focus();
      }
    });
    return;
  } // 광장 단상을 누르면 걸어가고, 도착하면 대화창이 저절로 뜬다 (창을 따로 열지 않는다)
  panelOpen = f;
  panelView = {};
  renderPanel();
  backdrop.classList.add('open');
  panel.scrollTop = 0;
  tip.style.display = 'none';
  focusPanel();
  if (f.startsWith('room:')) {
    const n = S.news.find((x) => x.id === f.slice(5));
    if (n && n.kind === 'OPEN' && n.agreed) {
      enterCamp(n);
      return;
    }
  }
  if (f.startsWith('room:')) {
    const n = S.news.find((x) => x.id === f.slice(5));
    if (n && n.kind === 'CLOSED') return;
  } // 종료된 방은 마을에 모닥불이 없어 걸어가지 않는다
  walkTo(...vTarget(f));
}

function boardPanel() {
  const sec = (t, k) => {
    const l = S.news.filter((n) => n.kind === k);
    return l.length ? `<label>${t}</label>` + l.map(roomCard).join('') : '';
  };
  return (
    head('마을 게시판') +
    (S.news.length
      ? sec('열린 방', 'OPEN') + sec('곧 열릴 방', 'SOON') + sec('지난 방', 'CLOSED')
      : '<p class="muted">지금 열린 공유방이 없어요.</p>') +
    '<button class="primary" data-act="newRoom" style="width:100%;margin-top:10px">모닥불 피우기</button>' +
    '<label for="jl">초대 링크로 들어가기</label><div class="row"><input id="jl" placeholder="초대 링크나 코드"><button data-act="joinLink">들어가기</button></div>' +
    '<p class="muted" style="margin-top:10px">공유방 기록은 종료 후 7일 동안만 보관돼요. 모닥불이 작아지다 꺼지면 사라져요.</p>'
  );
}
// ===== 마을 광장: 방에 들어가지 않고 하는 짧은 대화. 하루 뒤 사라진다 =====
const plazaLogHtml = () =>
  S.plaza.length
    ? S.plaza
        .slice(-30)
        .map(
          (m) => `<div class="msg ${m.mine ? 'me' : ''}"><b>${esc(m.who)}</b>${esc(m.text)}<i>${hhmm(m.ts)}</i></div>`,
        )
        .join('')
    : '<p class="muted">아직 아무도 말하지 않았어요. 첫 마디를 남겨 보세요.</p>';
function plazaSay(who, text, i, mine) {
  S.plaza.push({ who, text, ts: Date.now(), mine: !!mine });
  S.plaza = S.plaza.slice(-60);
  save();
  if (G3) G3.say(i, text);
  const lg = document.getElementById('pzLog');
  if (pzShown && lg) {
    const atEnd = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 40 || mine;
    lg.innerHTML = plazaLogHtml();
    if (atEnd) lg.scrollTop = lg.scrollHeight;
  }
}
// 광장 대화창: 광장(돌바닥) 안에 있을 때만 보이고, 밖으로 나가면 사라진다. 제목을 누르면 접어 둘 수 있다.
let pzShown = false;
const pzBox = document.getElementById('plazaChat');
const pzHeadText = () => {
  document.getElementById('pzHead').textContent =
    '💬 광장 이야기 · 접속 (' +
    String(NPCS.length + 1).padStart(2, '0') +
    '/' +
    VMAX +
    ') ' +
    (pzBox.classList.contains('min') ? '▴' : '▾');
};
function syncPlazaChat() {
  const on = VIEW === 'village' && inPlaza(sim.x, sim.z);
  if (on === pzShown) return;
  pzShown = on;
  document.getElementById('stageWrap').classList.toggle('pz', on);
  if (on) {
    const lg = document.getElementById('pzLog');
    lg.innerHTML = plazaLogHtml();
    lg.scrollTop = lg.scrollHeight;
    pzHeadText();
  }
}
// 폰 키보드가 올라오면 하단 채팅창이 키보드 위로 올라오게 한다
function plazaSend() {
  const inp = document.getElementById('pz'),
    e = document.getElementById('pzE'),
    t = inp.value.trim().slice(0, 40);
  if (!t) {
    inp.value = '';
    return;
  }
  if (!inPlaza(sim.x, sim.z)) {
    e.textContent = '광장 안으로 걸어가는 중이에요. 도착하면 보낼 수 있어요';
    return;
  }
  const gate = chatGate('plaza', t);
  if (gate) {
    e.textContent = gate;
    return;
  }
  chatMark('plaza', t);
  e.textContent = '';
  inp.value = '';
  inp.focus();
  plazaSay('나', t, -1, true);
  setTimeout(
    () => {
      if (VIEW === 'village') plazaSay('@' + NPCS[1].name, NPC_REPLY[Math.floor(Math.random() * NPC_REPLY.length)], 1);
    },
    2200 + Math.random() * 2000,
  );
}
// 체험판: 가짜 이웃이 가끔 말을 건다

// ===== 마을 버튼 =====
function villageAction(act, b) {
  if (act === 'plazaSend') {
    plazaSend();
    return true;
  }
  if (act === 'goVillage') {
    closePanel();
    openF('door');
    return true;
  }
  return false;
}

function bindVillageEvents() {
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'pz' && !e.isComposing) {
      e.preventDefault();
      plazaSend();
    }
  });

  setInterval(() => {
    drawMini();
    syncPlazaChat();
  }, 120);

  pzBox.addEventListener('click', (e) => {
    if (e.target.closest('#pzHead')) {
      pzBox.classList.toggle('min');
      pzHeadText();
    }
    if (e.target.closest('#pzSend')) plazaSend();
  });

  pzBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && e.target.id === 'pz') {
      e.preventDefault();
      plazaSend();
    }
  });

  if (window.visualViewport) {
    const vv = visualViewport,
      adj = () =>
        document.documentElement.style.setProperty('--kb', Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px');
    vv.addEventListener('resize', adj);
    vv.addEventListener('scroll', adj);
  }

  setInterval(() => {
    S.plaza = (S.plaza || []).filter((m) => Date.now() - m.ts < 864e5);
    if (VIEW !== 'village' || Math.random() < 0.4) return;
    const i = Math.floor(Math.random() * NPCS.length);
    plazaSay('@' + NPCS[i].name, NPC_SAY[Math.floor(Math.random() * NPC_SAY.length)], i);
  }, 9000);
}
