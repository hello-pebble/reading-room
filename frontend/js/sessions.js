// 스탠드 타이머 · 서버 연결 모드(?api=)의 스탠드 켜기·끄기·계속·확인·직접 기록과 오늘 읽은 시간 (서버 연결 2‑2단계).
// ?api가 없으면 아무것도 하지 않는다. 서버 시각이 기준이다: 화면 시계와의 차이(skew)를 재서 켠 시각을 화면 시계로 바꿔 쓰고,
// 실패하면 서버 문구를 보이고 화면 상태는 그대로 둔다. 서버에 목록 API가 없어 S.sessions에는 이 화면에서 끝낸 기록만 쌓인다.
const SES = { skew: 0, todayBase: 0, busy: {} };

const sesMs = (iso) => (iso ? Date.parse(iso) - SES.skew : null); // 서버 시각 → 화면 시계(ms)
const sesFromServer = (s) => ({
  id: s.id,
  bookId: s.bookId,
  startedAt: sesMs(s.startedAt),
  lastCheckAt: sesMs(s.lastCheckAt),
  status: s.status,
});
const recordFromServer = (s) => ({
  id: s.id,
  bookId: s.bookId,
  startedAt: sesMs(s.startedAt),
  endedAt: sesMs(s.endedAt),
  minutes: s.minutes,
  source: s.source,
  endedBy: s.endedBy,
});
function sesRefresh() {
  calRefresh(); // 독서한 날·연속일이 바뀐다 (calendar.js)
  save();
  panelView = {};
  render();
  renderPanel();
}

// 로그인한 직후·새로고침·화면으로 돌아왔을 때: 켜져 있는 스탠드와 오늘 읽은 시간을 서버에서 받는다
async function loadSession() {
  const [cur, today] = await Promise.all([API.get('/sessions/current'), API.get('/me/reading-time')]);
  SES.skew = Date.parse(cur.serverNow) - Date.now();
  SES.todayBase = today.minutes;
  S.sessions = [];
  S.session = cur.session ? sesFromServer(cur.session) : null;
  save();
  render();
  if (panelOpen) renderPanel();
}

// 서버가 거절했는데 화면이 어긋나 있을 수 있는 경우(409 등)는 서버 상태로 다시 맞춘다
async function sesFail(e) {
  toast(e.message);
  if (e.status === 409 || e.status === 404) await loadSession().catch(() => {});
}
// 한 번에 하나만: 누르는 동안 같은 동작을 또 누르면 무시한다
async function sesRun(name, fn) {
  if (SES.busy[name]) return;
  SES.busy[name] = true;
  try {
    await fn();
  } catch (e) {
    await sesFail(e);
  } finally {
    SES.busy[name] = false;
  }
}

function serverStartTimer() {
  return sesRun('start', async () => {
    try {
      S.session = sesFromServer(await API.post('/sessions/start'));
    } catch (e) {
      if (e.code === 'ALREADY_RUNNING') {
        await loadSession(); // 다른 기기에서 켠 스탠드를 이어받는다
        return toast(e.message);
      }
      throw e;
    }
    timerStarted();
  });
}

// 끝난 기록을 화면에 반영한다 (1분 미만은 서버가 버린다)
function sesClosed(res, quiet) {
  if (pipWin) pipDone(res.minutes || 0);
  S.session = null;
  if (res.status === 'DONE') {
    S.sessions.push(recordFromServer(res));
    if (!quiet) toast(res.minutes + '분 읽었어요. 스탠드를 껐어요');
  } else if (!quiet) toast('1분 미만은 기록하지 않아요');
}

// 끄기 화면의 쪽수·메모는 스탠드 끄기에 실어 보낸다. endedBy: LAMP(끄는 화면) | PIP(바탕화면 창의 스탠드)
function serverStop(by, form) {
  return sesRun('stop', async () => {
    const r = S.reading,
      ses = S.session;
    if (!ses) return;
    await flushBookSave();
    const body = { endedBy: by };
    const page = form && form.page !== '' ? Math.max(0, Math.round(+form.page)) : null;
    const total = form && form.total ? Math.round(+form.total) : 0;
    if (page != null && !isNaN(page)) body.endPage = page;
    if (total >= 1) body.totalPages = Math.min(9999, total);
    if (form && form.memo) body.memo = form.memo;
    const res = await API.post('/sessions/' + ses.id + '/stop', body);
    if (r) {
      if (body.totalPages && !r.totalPages) r.totalPages = body.totalPages;
      if (res.endPage != null) r.page = Math.max(r.page || 0, res.endPage);
      updProgress(r);
      if (body.memo) r.notes = (await API.get('/books/' + r.id + '/notes')).slice().reverse().map(noteFromServer);
    }
    sesClosed(res);
    sesRefresh();
  });
}
const serverStopSave = () => {
  const el = (id) => document.getElementById(id);
  return serverStop('LAMP', {
    page: el('sp') ? el('sp').value : '',
    total: el('stp') ? el('stp').value : '',
    memo: (panelView.memo || '').trim(),
  });
};

// 60분 알림의 [계속]
function serverCheck() {
  return sesRun('check', async () => {
    if (!S.session) return;
    S.session.lastCheckAt = sesMs((await API.post('/sessions/' + S.session.id + '/check')).lastCheckAt);
    save();
    render();
    toast('계속 기록할게요');
  });
}

// 3시간을 넘겨 확인이 필요한 스탠드: {until:'LAST_CHECK'} | {until:'MINUTES', minutes} | {discard:true}
function serverConfirm(body) {
  return sesRun('confirm', async () => {
    if (!S.session) return;
    const res = await API.post('/sessions/' + S.session.id + '/confirm', body);
    if (body.discard) {
      if (pipWin) pipDone(0);
      S.session = null;
      toast('기록하지 않고 스탠드를 껐어요');
    } else sesClosed(res);
    sesRefresh();
  });
}

// 직접 기록 (daysAgo 0=오늘, 1=어제)
function serverManual(minutes, daysAgo) {
  return sesRun('manual', async () => {
    S.sessions.push(recordFromServer(await API.post('/sessions/manual', { minutes, daysAgo })));
    sesRefresh();
    toast(minutes + '분을 기록했어요');
  });
}

// 다른 기기에서 켜고 끈 것을 화면으로 돌아올 때 맞춘다
document.addEventListener('visibilitychange', () => {
  if (API.enabled && API.token && document.visibilityState === 'visible') loadSession().catch(() => {});
});
