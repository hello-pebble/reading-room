// 마을 게시판과 공유방 개설·초대 입장·보관 동의·나가기·닫기 · 서버 연결 모드(?api=)에서는 서버의 방이 기준이다 (서버 연결 5‑1단계).
// ?api가 없으면 아무것도 하지 않는다(체험판 방이 그대로 동작). 서버 연결 모드에서는 GET /rooms로 S.news를 통째로 바꾸고,
// 바꾸는 동작(개설·입장·동의·나가기·닫기)은 서버가 받아들인 뒤 목록을 다시 불러와 맞춘다. 실패하면 서버 문구만 보이고 그대로 둔다.
// 대화·읽음(5‑2), 알림·가져오기(5‑3), 모닥불 머문 시간(5‑4)은 아직 체험판 방식이라 서버 연결 모드에서는 버튼을 숨기거나 안내만 한다.

// 서버의 방 한 줄 → 화면의 방(S.news의 한 항목). 체험판의 가짜 참여자·대화를 채우지 않는다(srv: true, rcNorm이 건드리지 않는다)
function roomFromServer(r) {
  const opens = Date.parse(r.openAt),
    closes = Date.parse(r.closedAt || r.closeAt);
  const room = {
    id: 'r' + r.id,
    sid: r.id,
    srv: true,
    kind: r.status === 'SCHEDULED' ? 'SOON' : r.status,
    title: r.title,
    sub: '',
    author: '',
    cover: '',
    isbn: r.isbn || '',
    rtype: r.kind,
    mine: r.mine,
    people: r.participants,
    max: r.maxParticipants,
    vis: 'invite',
    inviteCode: r.inviteCode || '',
    opensAt: opens,
    closesAt: closes,
    alarm: !!r.alarm,
    done: false,
    messages: [],
    members: [],
    owner: r.mine ? '나' : r.ownerNickname,
    agreed: r.agreed,
    unread: r.unread,
    lastRead: 0,
    seeded: true,
    period: timeRange(opens, closes),
  };
  if (r.deleteAt) room.deleteAt = Date.parse(r.deleteAt);
  room.book = shortTitle(room);
  return room;
}

async function loadRooms() {
  S.news = (await API.get('/rooms')).map(roomFromServer);
  save();
  render();
  if (panelOpen) renderPanel();
  buildSr();
}
const roomsRefresh = () => loadRooms().catch((e) => toast(e.message));

const ROOM_BUSY = {};
let PENDING_JOIN = ''; // 초대 링크(#join=)로 열었을 때 로그인 뒤에 들어갈 코드

// 모닥불 피우기: 책은 소파·책장에서 골랐으면 책 번호(bookId)로, 직접 적었으면 ISBN 없이 보낸다(서버가 같은 책 방에는 책이 필요하다고 답한다)
async function serverCreateRoom(nf, err) {
  if (ROOM_BUSY.create) return;
  const body = { kind: nf.kind, visibility: 'INVITE', maxParticipants: Math.round(+nf.max), hours: nf.hours };
  const name = (nf.name || '').trim();
  if (name) body.title = name;
  const b = nfBook(nf);
  if (nf.kind === 'SAME' && b) {
    if (b.isbn) body.isbn = b.isbn;
    const own =
      nf.bookSel === 'sofa' ? S.reading : nf.bookSel.startsWith('shelf:') ? S.finished[+nf.bookSel.slice(6)] : null;
    if (own && own.id) body.bookId = own.id;
  }
  if (nf.start === 'later') {
    const opens = new Date(nf.when).getTime();
    if (!(opens > Date.now() + 60000)) return err('시작 시각은 지금보다 뒤로 정해 주세요');
    body.openAt = new Date(opens).toISOString();
  }
  ROOM_BUSY.create = true;
  try {
    const made = await API.post('/rooms', body);
    await loadRooms();
    panelView.created = 'r' + made.id;
    renderPanel();
    toast('모닥불을 피웠어요');
  } catch (e) {
    err(e.message);
  } finally {
    ROOM_BUSY.create = false;
  }
}

// 초대 코드(또는 #join= 링크)로 들어가기. 들어오면 그 방의 안내 창을 연다
async function serverJoin(raw) {
  if (ROOM_BUSY.join) return;
  let code = String(raw || '').trim();
  const m = /join=([A-Za-z0-9]+)/i.exec(code);
  if (m) code = m[1];
  ROOM_BUSY.join = true;
  try {
    const row = await API.post('/rooms/join', { code });
    await loadRooms();
    const id = 'r' + row.id;
    if (VIEW !== 'village') {
      enterVillage();
      setTimeout(() => openV('room:' + id), 900);
    } else openV('room:' + id);
  } catch (e) {
    toast(e.message);
  } finally {
    ROOM_BUSY.join = false;
  }
}

// 방 하나에 대한 서버 동작(동의·나가기·닫기). 끝나면 목록을 다시 불러오고, 성공하면 새 방 객체로 ok를 부른다
function serverRoomAct(n, name, ok) {
  const key = n.sid + ':' + name;
  if (ROOM_BUSY[key]) return;
  ROOM_BUSY[key] = true;
  const call = {
    agree: () => API.post('/rooms/' + n.sid + '/agree'),
    leave: () => API.del('/rooms/' + n.sid + '/participants/me'),
    close: () => API.post('/rooms/' + n.sid + '/close'),
  }[name];
  return call()
    .then(() => loadRooms())
    .then(() => ok && ok(S.news.find((x) => x.sid === n.sid)))
    .catch((e) => toast(e.message))
    .finally(() => {
      ROOM_BUSY[key] = false;
    });
}

// 다른 기기에서 바뀐 방을 화면으로 돌아올 때 맞춘다
document.addEventListener('visibilitychange', () => {
  if (API.enabled && API.token && document.visibilityState === 'visible') roomsRefresh();
});
