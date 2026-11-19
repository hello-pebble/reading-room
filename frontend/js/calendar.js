// 달력·월 목표 · 서버 연결 모드(?api=)에서는 독서한 날·연속일·완독 수·목표를 서버가 센 값으로 보여 준다 (서버 연결 3단계).
// ?api가 없으면 아무것도 하지 않는다(calData·setGoal이 그대로 localStorage로 계산한다). 달마다 서버 응답을 CAL에 담아 두고,
// 아직 없으면 불러오는 동안 빈 달력을 보인다. 목표는 서버 응답을 받은 뒤에 바꾼다: 실패하면 서버 문구만 보이고 그대로 둔다.
const CAL = { months: {}, busy: {}, failed: {}, goalBusy: false, ready: false }; // ready: 로그인이 확인된 뒤에만 서버에 묻는다
const CAL_BACK = 12; // 이전 달 버튼은 1년 전까지 (서버는 더 옛날도 주지만 화면은 여기까지만 연다)

function calReset() {
  CAL.ready = true;
  CAL.months = {};
  CAL.busy = {};
  CAL.failed = {};
}

async function calLoad(ym) {
  if (CAL.busy[ym]) return;
  CAL.busy[ym] = true;
  try {
    CAL.months[ym] = await API.get('/me/calendar?month=' + ym);
    delete CAL.failed[ym];
  } catch (e) {
    CAL.failed[ym] = true; // 다시 부르다 계속 실패하며 반복되지 않게, 달을 바꾸거나 새로 고칠 때까지 멈춘다
    toast(e.message);
  } finally {
    CAL.busy[ym] = false;
  }
  render();
  if (panelOpen === 'calendar') renderPanel();
}
// 스탠드를 끄거나 완독한 뒤처럼 이번 달 값이 바뀌었을 때
const calRefresh = () => {
  if (API.enabled && API.token && CAL.ready) calLoad(curYM());
};

// calData()와 같은 모양 (room.js)
function calDataServer(off = 0) {
  const [ty, tm, td] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).split('-').map(Number),
    pad = (n) => String(n).padStart(2, '0');
  const tg = new Date(Date.UTC(ty, tm - 1 + off, 1)),
    Y = tg.getUTCFullYear(),
    Mo = tg.getUTCMonth() + 1,
    ym = Y + '-' + pad(Mo);
  const r = CAL.months[ym];
  if (!r && CAL.ready && !CAL.busy[ym] && !CAL.failed[ym] && API.token) calLoad(ym);
  const days = r ? r.days : [];
  return {
    y: Y,
    m: Mo,
    ym,
    off,
    today: off === 0 ? td : 0,
    dim: new Date(Date.UTC(Y, Mo, 0)).getUTCDate(),
    first: new Date(Date.UTC(Y, Mo - 1, 1)).getUTCDay(),
    marks: days.map((d) => +d.slice(8)),
    streak: (r && r.streak) || 0,
    done: (r && r.finishedCount) || 0,
    goal: r ? (r.goal == null && off === 0 ? 1 : r.goal) : off === 0 ? 1 : null, // 서버도 처음 쓰는 사람에게 이번 달 기본 1권을 준다
    goalSet: !!r && !r.goalInherited,
    changes: r ? r.goalChanges.map((c) => ({ at: Date.parse(c.at + 'T12:00:00+09:00'), from: c.from, to: c.to })) : [],
    canPrev: off > -CAL_BACK,
    canNext: off < 0,
  };
}

function serverSetGoal(v) {
  v = Math.min(99, Math.max(1, Math.round(+v) || 1));
  const ym = curYM();
  if (CAL.goalBusy || v === calDataServer(0).goal) return;
  CAL.goalBusy = true;
  API.put('/me/goal', { monthlyGoal: v })
    .then((g) => {
      CAL.months[ym] = {
        ...(CAL.months[ym] || { days: [], streak: 0, finishedCount: 0 }),
        goal: g.goal,
        goalChanges: g.goalChanges,
        goalInherited: g.goalInherited,
      };
    })
    .catch((e) => toast(e.message))
    .finally(() => {
      CAL.goalBusy = false;
      render();
      if (panelOpen === 'calendar') renderPanel(); // 서버가 받아들인 값(실패면 원래 값)으로 칸을 맞춘다
    });
}
