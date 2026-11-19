// 이웃집 방문과 책 추천. 실제 계정 간 전송은 서버 연결 뒤 제공한다.
const NEIGHBORS = [
  ['나무', 7.2, 0.6, 1.8, 1.6, 1.4, '#d8b27a', '#7d9a6a', 2, 43],
  ['달빛', 11, 0.5, 1.5, 1.3, 1.3, '#caa070', '#a8663d', 1, 47],
  ['구름', 14.6, 0.6, 1.9, 1.7, 1.5, '#d3ad78', '#6f8fa8', 2, 53],
  ['바다', 18.4, 0.5, 1.6, 1.4, 1.3, '#c99e68', '#a85d4a', 1, 59],
  ['모래', 22, 0.6, 1.8, 1.6, 1.4, '#d8b27a', '#8a7aa8', 2, 61],
  ['하늘', 25.8, 0.6, 1.7, 1.5, 1.4, '#d3ad78', '#7a9a6a', 2, 67],
  ['바람', 29.6, 0.5, 1.5, 1.4, 1.3, '#c99e68', '#a8663d', 1, 71],
  ['여울', 33.2, 0.6, 1.7, 1.5, 1.4, '#d8b27a', '#6f8fa8', 2, 73],
].map(([name, ...house], i) => ({ id: 'neighbor-' + i, name, house }));
let visitingNeighbor = null;
const neighborNow = () => NEIGHBORS.find((n) => n.id === visitingNeighbor);
const recommendedBooks = () => [
  ...(S.reading ? [{ key: 'reading', book: S.reading, status: '읽는 중' }] : []),
  ...S.finished.map((b) => ({ key: 'finished:' + b.id, book: b, status: '완독' })),
];
const currentGift = () => S.recommendations[VIEW === 'neighbor' ? visitingNeighbor : 'me'] || null;

function visitNeighbor(id) {
  const n = NEIGHBORS.find((n) => n.id === id);
  if (!n || VIEW !== 'village') return;
  closePanel();
  visitingNeighbor = id;
  VIEW = 'neighbor';
  L = ROOM_L || LAY[MQ.matches ? 'tall' : 'wide'];
  Object.assign(sim, { x: 2.3, z: 1.1, y: 0, rot: Math.PI / 4, mode: 'idle', after: null, mv: 0, sit: 0, k: 0 });
  if (G3) G3.setView('neighbor');
  buildSr();
  render();
}
function leaveNeighbor() {
  if (VIEW !== 'neighbor') return;
  const n = neighborNow();
  closePanel();
  VIEW = 'village';
  L = VIL;
  visitingNeighbor = null;
  Object.assign(sim, {
    x: n.house[0] + n.house[2] / 2,
    z: n.house[1] + n.house[3] + 0.8,
    y: 0,
    mode: 'idle',
    after: null,
    mv: 0,
    sit: 0,
    k: 0,
  });
  if (G3) G3.setView('village');
  buildSr();
  render();
}
function openNeighbor(f) {
  if (f === 'door') {
    leaveNeighbor();
    return;
  }
  if (f !== 'shelf') {
    toast('이웃집 책장을 눌러 책을 추천해 보세요');
    return;
  }
  panelOpen = 'neighborShelf';
  panelView = {};
  renderPanel();
  backdrop.classList.add('open');
  focusPanel();
  walkTo(2, 1.1);
}
function giftCard(g) {
  return `<div class="neighbor-gift">${bthumb(g.book)}<div><b>『${esc(g.book.title)}』</b><p class="muted">${esc(g.book.author || '')}</p></div></div>`;
}
function neighborShelfPanel() {
  const n = neighborNow();
  if (!n) return head('이웃집');
  const gift = S.recommendations[n.id];
  if (gift)
    return (
      head(esc(n.name) + '의 책장') +
      giftCard(gift) +
      `<p class="muted">책장 아래 칸에 꽂아 두었어요. 집 주인이 확인하면 다시 한 권을 추천할 수 있어요.</p>` +
      (panelView.ownerPreview
        ? `<div class="card"><b>집 주인이 되어 책 확인하기</b><p>추천받은 책을 확인했어요. 아래 칸을 비울까요?</p><button class="primary" data-act="giftRead" data-house="${n.id}">확인했어요</button></div>`
        : `<details class="neighbor-demo"><summary>테스트 도구</summary><p class="muted">체험판에서는 집 주인의 확인을 직접 재현할 수 있어요.</p><button data-act="giftOwner">집 주인 시점으로 보기</button></details>`)
    );
  const books = recommendedBooks();
  return (
    head(esc(n.name) + '의 책장') +
    `<p>추천하고 싶은 책을 아래 칸에 꽂아 두세요. 집 주인에게 내 닉네임이 함께 보여요.</p><p class="muted">읽는 중이거나 다 읽은 책만 추천할 수 있어요. 한 집에 확인 전까지 한 권만 둘 수 있어요.</p>` +
    (books.length
      ? books
          .map(
            ({ key, book, status }) =>
              `<div class="neighbor-choice">${bthumb(book)}<div class="grow"><b>『${esc(book.title)}』</b><div class="muted">${esc(book.author || '')} · ${status}</div></div><button data-act="giftPut" data-key="${esc(key)}">책 꽂기</button></div>`,
          )
          .join('')
      : '<p class="muted">아직 추천할 수 있는 책이 없어요. 내 방 소파에 책을 올리거나 한 권을 완독해 주세요.</p>')
  );
}
function putRecommendation(key) {
  const n = neighborNow(),
    chosen = recommendedBooks().find((b) => b.key === key);
  if (VIEW !== 'neighbor' || !n) return false;
  if (S.recommendations[n.id]) {
    toast('아직 집 주인이 책을 확인하지 않았어요');
    return false;
  }
  if (!chosen) {
    toast('읽는 중이거나 다 읽은 책만 추천할 수 있어요');
    return false;
  }
  const b = chosen.book;
  S.recommendations[n.id] = {
    from: 'me',
    book: { title: b.title, author: b.author || '', cover: b.cover || '', isbn: b.isbn || '' },
    at: Date.now(),
  };
  save();
  closePanel();
  render();
  if (G3) G3.animateGift();
  toast('책장 아래 칸에 책을 꽂아 두었어요');
  return true;
}
function incomingGiftHtml() {
  const g = S.recommendations.me;
  return g
    ? `<div class="card"><b>이웃이 꽂아 둔 책 ✦</b>${giftCard(g)}<button data-act="giftRead" data-house="me">확인했어요</button></div>`
    : '';
}
function neighborAction(act, b) {
  if (act === 'giftPut') {
    putRecommendation(b.dataset.key);
    return true;
  }
  if (act === 'giftOwner') {
    if (VIEW === 'neighbor' && panelOpen === 'neighborShelf') {
      panelView.ownerPreview = true;
      renderPanel();
    }
    return true;
  }
  if (act === 'giftRead') {
    const id = b.dataset.house,
      own = id === 'me' && VIEW === 'room' && panelOpen === 'shelf';
    const preview =
      VIEW === 'neighbor' && id === visitingNeighbor && panelOpen === 'neighborShelf' && panelView.ownerPreview;
    if ((own || preview) && S.recommendations[id]) {
      delete S.recommendations[id];
      save();
      render();
      renderPanel();
      toast('추천받은 책을 확인했어요. 아래 칸을 비웠어요');
    }
    return true;
  }
  return false;
}
function bindNeighborEvents() {
  document.getElementById('neighborExit').addEventListener('click', leaveNeighbor);
}
