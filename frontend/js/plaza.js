// 마을 광장 대화 · 서버 연결 모드(?api=)에서는 서버에 쌓인 글을 함께 본다 (서버 연결 4단계). ?api가 없으면 아무것도 하지 않는다.
// 광장(돌바닥) 안에 있는 동안만 서버에서 최근 글을 받고, 몇 초마다 새 글만 묻는다(SSE는 접속 인원 단계에서 정한다).
// 글을 보내면 서버가 만든 글을 받은 뒤에 보여 준다: 글자 수·도배·같은 글 규칙은 서버가 정하고, 거절 문구를 그대로 보인다.
// 가짜 이웃(NPC)의 대사는 서버 연결 모드에 없다. 접속 인원은 광장에 있는 동안 GET /plaza/presence(SSE)로 받아 다른 사람을 광장에 세운다(결정 #91).
let PLAZA_POLL = 3000; // 새 글을 묻는 간격(ms)
const PZ = { timer: null, last: null, busy: false, sending: false, ctl: null, people: null }; // people: 나를 뺀 접속자 (모르면 null)
let PRESENCE_RETRY = 3000; // 접속 인원 연결이 끊기면 다시 잇는 간격(ms)

const plazaFromServer = (m) => ({
  id: m.id,
  who: m.nickname,
  publicId: m.publicId, // 광장에 서 있는 사람 위에 말풍선을 띄울 때 찾는다 (결정 #91)
  text: m.content,
  ts: Date.parse(m.createdAt),
  at: m.createdAt,
  mine: !!S.user && m.publicId === S.user.publicId,
});
// 새로 온 글만 덧붙이고(번호로 거른다) 보이는 대화창을 맨 아래로 맞춘다
function plazaMerge(list, bubble = PZ.loaded) { // 광장에 들어서며 처음 받는 지난 글은 말풍선으로 다시 띄우지 않는다
  const fresh = list.map(plazaFromServer).filter((m) => !S.plaza.some((x) => x.id === m.id));
  for (const m of list) if (!PZ.last || m.createdAt > PZ.last) PZ.last = m.createdAt;
  if (!fresh.length) return;
  S.plaza = S.plaza.concat(fresh).slice(-60);
  if (bubble)
    fresh.forEach((m) => {
      if (!G3) return;
      if (m.mine) G3.say(-1, m.text);
      else {
        const i = (PZ.people || []).findIndex((p) => p.publicId === m.publicId);
        if (i >= 0) G3.say(i, m.text); // 광장에 서 있는 사람만 말풍선이 뜬다
      }
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
    PZ.loaded = true; // 첫 응답(지난 글) 뒤로 오는 글부터 말풍선을 띄운다 (광장이 비어 있었어도)
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
  PZ.loaded = false;
  lastPlazaErr = '';
  plazaFetch();
  PZ.timer = setInterval(plazaFetch, PLAZA_POLL);
  presenceConnect();
}
function plazaStop() {
  clearInterval(PZ.timer);
  PZ.timer = null;
  if (PZ.ctl) PZ.ctl.abort();
  PZ.ctl = null;
  presenceApply(null);
}

// 광장 접속 인원: 광장에 있는 동안 연결을 유지하고, 끊기면 잠시 뒤 다시 잇는다. 연결 자체가 "나는 광장에 있다"는 표시다.
async function presenceConnect() {
  const ctl = (PZ.ctl = new AbortController());
  while (PZ.ctl === ctl && API.token) {
    try {
      await API.stream('/plaza/presence', (name, list) => name === 'presence' && presenceApply(list), ctl.signal);
    } catch (e) {
      if (ctl.signal.aborted || e.status === 401) return; // 광장을 떠났거나 로그인 창이 처리한다
    }
    await new Promise((r) => setTimeout(r, PRESENCE_RETRY));
  }
}
// 명단(나 포함)을 받으면 나를 빼고 광장에 세우고, 대화창 제목의 인원을 맞춘다. null이면 비운다.
function presenceApply(list) {
  PZ.people = list ? list.filter((p) => !S.user || p.publicId !== S.user.publicId) : null;
  if (G3) G3.setPeople(PZ.people || []);
  if (typeof pzHeadText === 'function' && document.getElementById('pzHead')) pzHeadText();
}
// 로그인·계정을 바꿀 때: 다른 계정의 글 표시가 남지 않게 다시 시작한다
function plazaReset() {
  plazaStop();
  S.plaza = [];
  PZ.last = null;
  PZ.loaded = false;
  if (pzShown) plazaStart();
}

// 광장 안에서 보내기 (village.js의 plazaSend가 부른다)
async function serverPlazaSend(text) {
  if (PZ.sending) return;
  PZ.sending = true;
  const inp = document.getElementById('pz'),
    err = document.getElementById('pzE');
  try {
    plazaMerge([await API.post('/plaza/messages', { content: text })], true);
    err.textContent = '';
    inp.value = '';
    inp.focus();
  } catch (e) {
    err.textContent = e.message; // 쓰던 글은 그대로 둔다
  } finally {
    PZ.sending = false;
  }
}
