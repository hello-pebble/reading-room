// 공용 · 방 배치(LAY), 캐릭터 움직임(sim), 3D 장면 시작(createScene)

let tempAvatar = null;
let panelOpen = null,
  panelView = {};
const avatarNow = () => tempAvatar || S.avatar;
const canvas = document.getElementById('stage');
const flat = (fn) => fn();
const angDiff = (a, b) => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

// 레이아웃: wide=데스크톱 10×8 방, tall=모바일 7×6.5 방. 가구는 d만큼 평행이동. 방 크기는 사용 중에 바뀌지 않는다.
const BASE_T = { sofa: [6.4, 4.7], lamp: [5.3, 6.9], mirror: [6.5, 1.25], window: [3.6, 1.5], door: [9, 1.1] };
const LAY = {
  wide: {
    X: 10,
    Y: 8,
    d: { win: [0, 0], mir: [0, 0], door: [0, 0], sofa: [0, 0] },
    shelfEnd: 3.7,
    K: 7,
    shelf: [1.7, 2.2],
    cal: { y: 4.4, t: 5.3 },
    start: [7.6, 6.2],
  },
  tall: {
    X: 7,
    Y: 6.5,
    d: { win: [-1.2, 0], mir: [-2.05, 0], door: [-2.8, 0], sofa: [-0.9, -1.2] },
    shelfEnd: 3.3,
    K: 6,
    shelf: [1.7, 1.9],
    cal: { y: 3.7, t: 4.6 },
    start: [5.6, 5.2],
  },
};
let L, TARGET, SIT, STAND;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
let VIEW = 'room',
  ROOM_L = null,
  CAMP_ID = null;
const sim = {
  x: 0,
  y: 0,
  z: 0,
  rot: Math.PI / 4,
  mode: 'idle',
  tx: 0,
  tz: 0,
  after: null,
  t: 0,
  mv: 0,
  sit: 0,
  k: 0,
  fx: 0,
  fz: 0,
};
function setLayout(n) {
  L = LAY[n];
  const d = L.d;
  TARGET = {
    sofa: add(BASE_T.sofa, d.sofa),
    lamp: add(BASE_T.lamp, d.sofa),
    shelf: L.shelf,
    calendar: [1.7, L.cal.t],
    mirror: add(BASE_T.mirror, d.mir),
    window: add(BASE_T.window, d.win),
    door: add(BASE_T.door, d.door),
  };
  STAND = TARGET.sofa;
  SIT = add([5.0, 4.7], d.sofa);
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
}
const isSit = () => sim.mode === 'sit' || sim.mode === 'sitting';
const MQ = matchMedia('(max-width:760px)');
setLayout(MQ.matches ? 'tall' : 'wide');
function walkTo(tx, tz, done) {
  if (G3) G3.follow(); // 걸어가라고 하면 지도 끌기를 풀고 다시 캐릭터를 따라간다
  if (isSit()) {
    sim.x = STAND[0];
    sim.z = STAND[1];
    sim.y = 0;
    sim.mode = 'idle';
    sim.sit = 0;
    render();
  }
  sim.tx = tx;
  sim.tz = tz;
  sim.after = done || null;
  sim.mode = 'walk';
}
function sitDown() {
  sim.mode = 'sitting';
  sim.k = 0;
  sim.fx = sim.x;
  sim.fz = sim.z;
  render();
}
function stepSim(dt) {
  sim.t += dt;
  let moving = 0;
  if (sim.mode === 'walk') {
    const dx = sim.tx - sim.x,
      dz = sim.tz - sim.z,
      dd = Math.hypot(dx, dz);
    if (dd < 0.06) {
      sim.mode = 'idle';
      const f = sim.after;
      sim.after = null;
      if (f) f();
    } else {
      const v = Math.min(dd, (VIEW === 'village' ? 4.6 : 3.4) * dt);
      sim.x += (dx / dd) * v;
      sim.z += (dz / dd) * v;
      sim.rot += angDiff(sim.rot, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
      moving = 1;
    }
  }
  if (sim.mode === 'sitting') {
    sim.k = Math.min(1, sim.k + dt / 0.45);
    const k = sim.k;
    sim.x = sim.fx + (SIT[0] - sim.fx) * k;
    sim.z = sim.fz + (SIT[1] - sim.fz) * k;
    sim.y = 0.18 * k + Math.sin(Math.PI * k) * 0.25;
    sim.rot += angDiff(sim.rot, Math.PI / 2) * Math.min(1, dt * 12);
    if (k >= 1) sim.mode = 'sit';
  }
  sim.mv += (moving - sim.mv) * Math.min(1, dt * 12);
  sim.sit += ((isSit() ? 1 : 0) - sim.sit) * Math.min(1, dt * 9);
}

const G3 = createScene();
document.getElementById('fail').style.display = G3 ? 'none' : 'flex';
MQ.addEventListener('change', () => {
  closePanel();
  if (VIEW !== 'room') {
    VIEW = 'room';
    L = ROOM_L || L;
    if (G3) G3.setView('room');
  }
  setLayout(MQ.matches ? 'tall' : 'wide');
  if (G3) G3.relayout();
  buildSr();
  render();
});

