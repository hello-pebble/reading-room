// 공유방 대화·읽음 · 서버 연결 모드(?api=)에서는 서버에 쌓인 글을 보고 보낸다 (서버 연결 5‑2단계). ?api가 없으면 아무것도 하지 않는다.
// 대화창이 열려 있는 방(모닥불 장면의 대화창 포함)이 있는 동안만 서버에 묻는다: 처음에는 최근 글, 그 뒤로는 마지막 글 번호(after) 다음 글만.
// 글을 보내면 서버가 만든 글을 받은 뒤에 보이고, 글자 수·도배·같은 글·쪽수 규칙은 서버가 정해 거절 문구를 그대로 보인다.
// 대화창을 보고 있으면 읽음을 서버에 알려 새 글 별(✦)을 끈다. 종료된 방도 보관 기간 안에는 읽을 수 있다(보내기 칸은 없다).
let ROOM_POLL = 3000; // 새 글을 묻는 간격(ms)
const RC = { timer: null, busy: false, sending: false };

// 서버의 글 → 화면의 글(shared-chat.js의 모양). 내 글은 who가 '나', 나간 사람의 글은 left
const roomMsgFromServer = (m) => ({
  id: m.id,
  who: m.mine ? '나' : m.nickname,
  text: m.content,
  page: m.page == null ? null : m.page,
  ts: Date.parse(m.createdAt),
  left: !!m.left,
});
// 지금 대화창이 열려 있는 서버 방 (보관 동의까지 한 방만)
const activeServerRoom = () => {
  const n = S.news.find((x) => 'room:' + x.id === panelOpen);
  return n && n.srv && n.agreed ? n : null;
};

const viewingChat = (n) => panelOpen === 'room:' + n.id && (VIEW === 'shared' || (panelView.tab || 'chat') === 'chat');
// 새로 온 글을 덧붙이고(번호로 중복을 거른다) 보이는 대화창을 맞춘다. 대화를 보고 있으면 읽음도 알린다
function roomMerge(n, list) {
  const fresh = list.map(roomMsgFromServer).filter((m) => !n.messages.some((x) => x.id === m.id));
  n.msgLast = list.reduce((a, m) => Math.max(a, m.id), n.msgLast || 0);
  n.msgLoaded = true;
  if (!fresh.length) return;
  n.messages = n.messages.concat(fresh).slice(-300);
  fresh.forEach((m) => campBubble(n, m));
  save();
  if (viewingChat(n)) {
    rcRefresh(
      n,
      fresh.some((m) => m.who === '나'),
    );
    serverMarkRead(n);
  }
  render();
}
async function roomFetch() {
  const n = activeServerRoom();
  if (!n || RC.busy || !API.token || (n.kind === 'CLOSED' && n.msgLoaded)) return; // 끝난 방은 한 번만 읽는다
  RC.busy = true;
  try {
    roomMerge(
      n,
      await API.get('/rooms/' + n.sid + '/messages' + (n.msgLoaded && n.msgLast ? '?after=' + n.msgLast : '')),
    );
    if (n.unread && viewingChat(n)) serverMarkRead(n); // 열어 보면 읽음
  } catch (e) {
    if (e.status === 403 || e.status === 404)
      roomsRefresh(); // 참여가 바뀌었거나 방이 사라졌다
    else if (e.status !== 401) toast(e.message);
  } finally {
    RC.busy = false;
  }
}
// 읽음 알리기: 서버가 받아들이면 별을 끈다 (실패는 조용히 넘긴다: 다음에 다시 알린다)
function serverMarkRead(n) {
  if (n.markBusy) return;
  n.markBusy = true;
  API.post('/rooms/' + n.sid + '/read')
    .then(() => {
      n.unread = false;
      render();
    })
    .catch(() => {})
    .finally(() => {
      n.markBusy = false;
    });
}
function roomChatStart() {
  if (RC.timer) return;
  RC.timer = setInterval(roomFetch, ROOM_POLL);
}
// 대화창이 열릴 때 바로 한 번 불러온다 (shared-chat.js의 rcAfter가 방 창을 그린 뒤 부른다)
function roomChatOpened(n) {
  if (!API.enabled || !n.srv || !n.agreed) return;
  roomChatStart();
  if (!n.msgLoaded) roomFetch();
}

// 글 보내기 (shared-chat.js의 rcSend가 부른다)
async function serverRoomSend(n) {
  if (RC.sending) return;
  const ta = document.getElementById('rc'),
    err = document.getElementById('rcE'),
    t = ta.value.trim().slice(0, MAXMSG);
  if (!t) return;
  const body = { content: t };
  const pg = n.rtype === 'OWN' ? null : rcPage(n);
  if (pg != null) body.page = pg;
  RC.sending = true;
  try {
    roomMerge(n, [await API.post('/rooms/' + n.sid + '/messages', body)]);
    panelView.draft = '';
    ta.value = '';
    err.textContent = '';
    ta.focus();
  } catch (e) {
    err.textContent = e.message; // 쓰던 글은 그대로 둔다
  } finally {
    RC.sending = false;
  }
}
