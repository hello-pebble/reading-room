// 마을 광장 대화 · 서버 연결 모드(?api=)에서는 서버에 쌓인 글을 함께 본다 (서버 연결 4단계). ?api가 없으면 아무것도 하지 않는다.
// 광장(돌바닥) 안에 있는 동안만 서버에서 최근 글을 받고, 몇 초마다 새 글만 묻는다(SSE는 접속 인원 단계에서 정한다).
// 글을 보내면 서버가 만든 글을 받은 뒤에 보여 준다: 글자 수·도배·같은 글 규칙은 서버가 정하고, 거절 문구를 그대로 보인다.
// 가짜 이웃(NPC)의 대사와 접속 인원은 서버 연결 모드에 없다 (실제 접속자 API가 아직 없다).
let PLAZA_POLL = 3000; // 새 글을 묻는 간격(ms)
const PZ = { timer: null, last: null, busy: false, sending: false };

const plazaFromServer = (m) => ({
  id: m.id,
  who: m.nickname,
  text: m.content,
  ts: Date.parse(m.createdAt),
  at: m.createdAt,
  mine: !!S.user && m.publicId === S.user.publicId,
});
// 새로 온 글만 덧붙이고(번호로 거른다) 보이는 대화창을 맨 아래로 맞춘다
function plazaMerge(list) {
  const fresh = list.map(plazaFromServer).filter((m) => !S.plaza.some((x) => x.id === m.id));
  for (const m of list) if (!PZ.last || m.createdAt > PZ.last) PZ.last = m.createdAt;
  if (!fresh.length) return;
  S.plaza = S.plaza.concat(fresh).slice(-60);
  fresh.forEach((m) => {
    if (m.mine && G3) G3.say(-1, m.text); // 내 말풍선만. 다른 사람은 광장에 그려지지 않는다
  });
  const lg = document.getElementById('pzLog');
  if (pzShown && lg) {
    const atEnd = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 40 || fresh.some((m) => m.mine);
    lg.innerHTML = plazaLogHtml();
    if (atEnd) lg.scrollTop = lg.scrollHeight;
  }
}
async function plazaFetch() {
  if (PZ.busy || !API.token) return;
  PZ.busy = true;
  try {
    plazaMerge(await API.get('/plaza/messages' + (PZ.last ? '?since=' + encodeURIComponent(PZ.last) : '')));
  } catch (e) {
    if (e.status !== 401) toastOnce(e.message); // 401은 로그인 창이 이미 처리한다
  } finally {
    PZ.busy = false;
  }
}
// 같은 오류가 몇 초마다 계속 뜨지 않게 한 번만 알린다
let lastPlazaErr = '';
function toastOnce(msg) {
  if (msg === lastPlazaErr) return;
  lastPlazaErr = msg;
  toast(msg);
}

function plazaStart() {
  if (PZ.timer) return;
  S.plaza = []; // 체험판 대사·지난 글 대신 서버의 글만 보인다
  PZ.last = null;
  lastPlazaErr = '';
  plazaFetch();
  PZ.timer = setInterval(plazaFetch, PLAZA_POLL);
}
function plazaStop() {
  clearInterval(PZ.timer);
  PZ.timer = null;
}
// 로그인·계정을 바꿀 때: 다른 계정의 글 표시가 남지 않게 다시 시작한다
function plazaReset() {
  plazaStop();
  S.plaza = [];
  PZ.last = null;
  if (pzShown) plazaStart();
}

// 광장 안에서 보내기 (village.js의 plazaSend가 부른다)
async function serverPlazaSend(text) {
  if (PZ.sending) return;
  PZ.sending = true;
  const inp = document.getElementById('pz'),
    err = document.getElementById('pzE');
  try {
    plazaMerge([await API.post('/plaza/messages', { content: text })]);
    err.textContent = '';
    inp.value = '';
    inp.focus();
  } catch (e) {
    err.textContent = e.message; // 쓰던 글은 그대로 둔다
  } finally {
    PZ.sending = false;
  }
}
