// 이웃집 책 추천 · 서버 연결 모드(?api=)에서는 마을의 집에 실제 사람이 살고, 추천은 서버가 받는다 (서버 연결 6단계).
// ?api가 없으면 아무것도 하지 않는다(체험판 이웃·추천이 그대로 동작).
// 집 8채의 주인은 "최근 광장에서 말한 사람(나 제외)"을 무작위로 뽑아 채운다(서버에 마을 사람 목록 API가 아직 없어서, 결정 #81).
// 사람이 모자라면 남는 집은 빈 집이다. 집을 채우는 일은 마을에 들어가는 순간에만 하고(장면의 이름표와 같은 사람이어야 해서),
// 마을에 있는 동안에는 바꾸지 않는다. 내 집에 온 추천은 서버에서 받아 와 보여 주고, [확인했어요]는 서버가 받아들인 뒤 지운다.
let HOUSE_RANDOM = Math.random; // 테스트가 바꿀 수 있다
const HOUSE = { next: null, at: 0, p: null };
const NB_EMPTY = '빈 집';
let incomingTimer = null;

// 다음에 마을에 들어갈 때 쓸 집 주인 명단을 서버의 광장 글에서 뽑아 둔다
function refreshNeighborHouses() {
  if (HOUSE.p) return HOUSE.p;
  HOUSE.p = pickNeighborHouses().finally(() => {
    HOUSE.p = null;
  });
  return HOUSE.p;
}
async function pickNeighborHouses() {
  try {
    if (!API.token || !S.user) return;
    const seen = new Map();
    for (const m of await API.get('/plaza/messages'))
      if (m.publicId && m.publicId !== S.user.publicId) seen.set(m.publicId, m.nickname);
    const people = [...seen].map(([pid, name]) => ({ pid, name }));
    for (let i = people.length - 1; i > 0; i--) {
      const j = Math.floor(HOUSE_RANDOM() * (i + 1));
      [people[i], people[j]] = [people[j], people[i]];
    }
    HOUSE.next = NEIGHBORS.map((_, i) => people[i] || null);
    HOUSE.at = Date.now();
  } catch (e) {
    HOUSE.at = Date.now(); // 집을 못 채워도 마을은 열린다(빈 집으로 보인다)
  }
}
// 마을 장면을 만들기 직전에 부른다: 명단을 집에 적용한다 (village.js의 enterVillage)
function applyNeighborHouses() {
  const list = HOUSE.next || NEIGHBORS.map(() => null);
  NEIGHBORS.forEach((n, i) => {
    n.pid = list[i] ? list[i].pid : null;
    n.name = list[i] ? list[i].name : NB_EMPTY;
  });
  if (Date.now() - HOUSE.at > 30000) refreshNeighborHouses(); // 다음 입장을 위해 새로 뽑아 둔다
}

const bookFromRec = (b) => ({ title: b.title, author: b.author || '', cover: b.coverUrl || '', isbn: b.isbn || '' });

// 이웃집 방문: 사는 사람이 있어야 하고, 서버가 집 정보(확인 전 추천이 있는지, 내가 꽂은 책)를 준다
async function serverVisitNeighbor(id) {
  const n = NEIGHBORS.find((x) => x.id === id);
  if (!n) return;
  if (!n.pid) return toast('아직 이웃이 살지 않는 집이에요');
  let info;
  try {
    info = await API.get('/neighbors/' + n.pid);
  } catch (e) {
    return toast(e.message);
  }
  n.name = info.nickname;
  n.occupied = !!info.occupied;
  if (info.mine && info.book) S.recommendations[n.id] = { from: 'me', book: bookFromRec(info.book), at: Date.now() };
  else delete S.recommendations[n.id];
  enterNeighborHouse(id);
}

// 책 꽂기: 서버가 받아들이면(한 집에 하나, 읽는 중·완독만) 아래 칸에 보인다
async function serverPutRecommendation(n, book) {
  try {
    const r = await API.post('/neighbors/' + n.pid + '/recommendation', { bookId: book.id });
    S.recommendations[n.id] = { from: 'me', book: bookFromRec(r.book), at: Date.now() };
    n.occupied = true;
    save();
    closePanel();
    render();
    if (G3) G3.animateGift();
    toast('책장 아래 칸에 책을 꽂아 두었어요');
  } catch (e) {
    toast(e.message);
    if (e.status === 409) {
      n.occupied = true; // 그 사이 다른 이웃이 먼저 꽂았다
      renderPanel();
    }
  }
}

// 내 집에 도착한 추천을 서버에서 받아 온다 (없으면 204)
async function loadIncomingRecommendation() {
  if (!API.enabled || !API.token) return;
  try {
    const r = await API.get('/me/recommendation');
    if (!r) delete S.recommendations.me;
    else S.recommendations.me = { from: r.fromNickname, book: bookFromRec(r.book), at: Date.parse(r.createdAt) };
    save();
    render();
    if (panelOpen === 'shelf') renderPanel();
  } catch (e) {
    // 조용히 넘긴다: 다음에 다시 확인한다
  }
}
// 집 주인이 [확인했어요]: 서버가 받아들인 뒤 아래 칸을 비운다
async function serverConfirmRecommendation() {
  try {
    await API.post('/me/recommendation/confirm');
    delete S.recommendations.me;
    save();
    render();
    renderPanel();
    toast('추천받은 책을 확인했어요. 아래 칸을 비웠어요');
  } catch (e) {
    toast(e.message);
    if (e.status === 404) loadIncomingRecommendation(); // 이미 확인된 추천이었다
  }
}
// 내 방에 있는 동안 이웃이 책을 꽂았는지 가끔 확인한다
function startIncomingWatch() {
  if (incomingTimer) return;
  incomingTimer = setInterval(() => {
    if (VIEW === 'room') loadIncomingRecommendation();
  }, 30000);
}
document.addEventListener('visibilitychange', () => {
  if (API.enabled && document.visibilityState === 'visible') loadIncomingRecommendation();
});
