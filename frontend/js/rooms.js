// 마을 게시판과 공유방 개설·초대 입장·보관 동의·나가기·닫기 · 서버 연결 모드(?api=)에서는 서버의 방이 기준이다 (서버 연결 5‑1단계).
// ?api가 없으면 아무것도 하지 않는다(체험판 방이 그대로 동작). 서버 연결 모드에서는 GET /rooms로 S.news를 통째로 바꾸고,
// 바꾸는 동작(개설·입장·동의·나가기·닫기)은 서버가 받아들인 뒤 목록을 다시 불러와 맞춘다. 실패하면 서버 문구만 보이고 그대로 둔다.
// 대화·읽음(5‑2), 알림·가져오기(5‑3), 모닥불 머문 시간(5‑4)은 아직 체험판 방식이라 서버 연결 모드에서는 버튼을 숨기거나 안내만 한다.

// 서버의 방 한 줄 → 화면의 방(S.news의 한 항목). 체험판의 가짜 참여자·대화를 채우지 않는다(srv: true, rcNorm이 건드리지 않는다)
const importKey = (id) => (S.user ? S.user.publicId : '') + ':' + id;
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
    done: !!(S.imported || {})[importKey(r.id)], // 가져온 방은 이 브라우저가 기억한다(서버 방 목록에는 표시가 없다)
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
  const old = new Map((S.news || []).map((x) => [x.id, x]));
  S.news = (await API.get('/rooms')).map((r) => {
    const n = roomFromServer(r),
      o = old.get(n.id);
    if (o && o.parts) {
      n.parts = o.parts; // 참여자 명단은 모닥불에 들어갈 때 따로 받는다 (결정 #92)
      n.members = o.members;
      n.myBook = o.myBook;
    }
    return n;
  });
  const camp = VIEW === 'shared' && S.news.find((x) => x.id === CAMP_ID);
  if (camp && camp.parts && camp.parts.length + 1 !== camp.people) loadCampPeople(camp); // 누가 들어오거나 나갔다
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
    alarm: () => (n.alarm ? API.del('/rooms/' + n.sid + '/alarm') : API.put('/rooms/' + n.sid + '/alarm')),
    import: async () => {
      const res = await API.post('/rooms/' + n.sid + '/import');
      (S.imported = S.imported || {})[importKey(n.sid)] = true;
      await loadBooks(); // 새로 담긴 나중에 읽을 책·바뀐 책 상태를 가져온다
      return res;
    },
  }[name];
  return call()
    .then(async (res) => {
      await loadRooms();
      return (
        ok &&
        ok(
          S.news.find((x) => x.sid === n.sid),
          res,
        )
      );
    })
    .catch((e) => {
      toast(e.message);
      if ([403, 404, 409, 410].includes(e.status)) roomsRefresh(); // 방 상태가 서버와 달랐다
    })
    .finally(() => {
      ROOM_BUSY[key] = false;
    });
}

// 책의 [공유방] 탭: 가져온 기록은 책장에서 책을 열 때 서버에서 불러온다 (다른 참여자는 서버가 익명으로 준다)
async function loadBookRooms(id) {
  const b = [S.reading, ...S.finished, ...S.dropped, ...S.later].find((x) => x && x.id === id);
  if (!b) return;
  b.rooms = (await API.get('/books/' + id + '/rooms')).map((x) => ({
    title: x.roomTitle,
    period: timeRange(Date.parse(x.openedAt), Date.parse(x.closedAt)),
    rtype: x.kind,
    messages: x.messages.map((m) => ({
      who: m.mine ? '나' : m.author,
      text: m.content,
      page: m.page == null ? null : m.page,
    })),
  }));
  save();
  if (panelOpen === 'shelf') renderPanel();
}

// 모닥불 머문 시간: 장면에 들어갈 때 서버에 알리고, 나올 때(나가기·시간 종료·방 닫기) 서버가 센 분을 받아 읽은 시간·달력에 반영한다.
// 서버가 거절하면(끝난 방 등) 서버 문구를 보이고 마을로 돌아간다. 창을 그냥 닫으면 퇴장을 못 알려 그 입장은 시간으로 인정되지 않는다.
// 모닥불 참여자 명단(결정 #92): 나를 뺀 실제 참여자를 n.parts에 두고, 모닥불 장면에 있으면 다시 그린다
async function loadCampPeople(n) {
  try {
    const list = await API.get('/rooms/' + n.sid + '/participants');
    n.parts = list.filter((p) => !p.mine);
    n.myBook = (list.find((p) => p.mine) || {}).bookTitle || ''; // 각자 읽기 방에서 내가 고른 책
    n.members = n.parts.map((p) => p.nickname); // 말풍선은 닉네임으로 그 사람을 찾는다 (campBubble)
    n.people = list.length;
    if (VIEW === 'shared' && CAMP_ID === n.id && G3) G3.setView('shared', n);
    render(); // 내 이름표 옆 책 (render.js)
  } catch (e) {
    toast(e.message);
  }
}
function serverStayEnter(n) {
  API.post('/rooms/' + n.sid + '/stay').catch((e) => {
    if (e.status === 401) return;
    toast(e.message);
    if (VIEW === 'shared' && CAMP_ID === n.id) leaveCamp();
    roomsRefresh();
  });
}
function serverStayLeave(n) {
  API.post('/rooms/' + n.sid + '/stay/leave')
    .then(async (r) => {
      if (!r.credited) return;
      await refreshToday();
      calRefresh();
      toast(r.minutes + '분을 읽은 시간에 더했어요');
    })
    .catch((e) => {
      if (e.status !== 404 && e.status !== 401) toast(e.message); // 404: 열린 입장이 없다(입장이 거절됐던 경우)
    });
}

// 다른 기기에서 바뀐 방을 화면으로 돌아올 때 맞춘다
document.addEventListener('visibilitychange', () => {
  if (API.enabled && API.token && document.visibilityState === 'visible') roomsRefresh();
});
