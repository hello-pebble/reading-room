// 내 방 기능. 화면 문구는 각 *Panel(), 버튼 동작은 roomAction()에서 수정한다.
// 공유 상태 S·저장·모달은 app.js, 3D 모양은 scene.js를 함께 사용한다.
// 이 파일은 내 방의 공용 부분(월 목표·달력 데이터·창밖 풍경·패널 열기·진행률)이다. 책 찾기=room-search.js, 화면 문구=room-panels.js, 버튼 동작·입력칸=room-actions.js, 스탠드 타이머=room-timer.js (같은 전역 범위에서 차례로 읽는다)

// 월 목표 (결정 #39): 달마다 따로 보관한다. 정해 둔 값이 없으면 직전에 정한 값을 이어받고, 첫 기록 이전 달은 null(목표 기록 없음).
// 지난 달 목표는 바뀌지 않는다(이어받기는 앞으로만 간다). 이번 달에만 고칠 수 있고, 고치면 "목표를 바꿨어요" 기록(changes)이 남는다.
const curYM = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(0, 7);
function goalFor(ym) {
  const e = S.goals[ym];
  if (e) return { goal: e.goal, changes: e.changes || [], set: true };
  const ks = Object.keys(S.goals)
    .filter((k) => k < ym)
    .sort();
  return { goal: ks.length ? S.goals[ks[ks.length - 1]].goal : null, changes: [], set: false };
}
function setGoal(v) {
  const ym = curYM(),
    prev = goalFor(ym);
  v = Math.min(99, Math.max(1, Math.round(+v) || 1));
  const e = S.goals[ym] || (S.goals[ym] = { goal: prev.goal == null ? v : prev.goal, changes: [] });
  if (e.goal === v) return;
  const day = (ts) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
    last = e.changes[e.changes.length - 1];
  if (last && day(last.at) === day(Date.now())) {
    last.to = v;
    last.at = Date.now();
    if (last.from === v) e.changes.pop();
  } // 같은 날 여러 번 눌러도 한 번의 변경으로 본다
  else e.changes.push({ at: Date.now(), from: e.goal, to: v });
  e.goal = v;
  save();
}
// 달력: 한국 시간 기준. 독서등을 끄며 저장한 날과 완독한 날을 독서한 날로 센다. off는 이번 달 기준으로 몇 달 전인지(0=이번 달, -1=지난 달).
function calData(off = 0) {
  const kst = (ts) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const todayS = kst(Date.now()),
    [ty, tm, td] = todayS.split('-').map(Number),
    pad = (n) => String(n).padStart(2, '0');
  const tg = new Date(Date.UTC(ty, tm - 1 + off, 1)),
    Y = tg.getUTCFullYear(),
    Mo = tg.getUTCMonth() + 1,
    ym = Y + '-' + pad(Mo);
  const days = new Set(),
    RE = /^(?:(\d{4})\.)?(\d+)\.(\d+)$/,
    finY = (m) => (m[1] ? +m[1] : +m[2] > tm || (+m[2] === tm && +m[3] > td) ? ty - 1 : ty); // 연도 없는 예전 값은 오늘 기준으로 연도를 짐작
  S.sessions.forEach((x) => days.add(kst(x.endedAt || x.startedAt)));
  S.finished.forEach((b) => {
    const m = RE.exec(b.finishedAt || '');
    if (!m) return;
    days.add(finY(m) + '-' + pad(+m[2]) + '-' + pad(+m[3]));
  });
  let streak = 0;
  if (off === 0) {
    const dt = new Date(Date.UTC(ty, tm - 1, td));
    if (!days.has(todayS)) dt.setUTCDate(dt.getUTCDate() - 1);
    while (days.has(dt.toISOString().slice(0, 10))) {
      streak++;
      dt.setUTCDate(dt.getUTCDate() - 1);
    }
  }
  const dim = new Date(Date.UTC(Y, Mo, 0)).getUTCDate(),
    first = new Date(Date.UTC(Y, Mo - 1, 1)).getUTCDay();
  const marks = [];
  for (let d = 1; d <= dim; d++) if (days.has(ym + '-' + pad(d))) marks.push(d);
  const done = S.finished.filter((b) => {
    const m = RE.exec(b.finishedAt || '');
    return m && finY(m) === Y && +m[2] === Mo;
  }).length;
  if (off === 0 && !S.goals[ym] && goalFor(ym).goal == null) {
    S.goals[ym] = { goal: 1, changes: [] };
    save();
  } // 처음 쓰는 사람은 기본 1권
  const g = goalFor(ym),
    earliest = [...Object.keys(S.goals), ...[...days].map((d) => d.slice(0, 7))].sort()[0] || ym;
  return {
    y: Y,
    m: Mo,
    ym,
    off,
    today: off === 0 ? td : 0,
    dim,
    first,
    marks,
    streak,
    done,
    goal: g.goal,
    goalSet: g.set,
    changes: g.changes,
    canPrev: earliest < ym,
    canNext: off < 0,
  };
}
// 창밖 풍경: 계절은 월로, 날씨는 날짜마다 바뀐다 (오프라인에서도 동작). 인터넷이 있으면 실제 날씨로 바꿀 수도 있다.
function windowScene() {
  const ds = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
    [y, m, d] = ds.split('-').map(Number),
    shift = S.sceneShift || 0;
  const season = m >= 3 && m <= 5 ? '봄' : m >= 6 && m <= 8 ? '여름' : m >= 9 && m <= 11 ? '가을' : '겨울';
  let h = ((y * 10000 + m * 100 + d) * 2654435761) >>> 0;
  const rnd = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const pool =
    season === '겨울'
      ? ['맑음', '맑음', '구름', '흐림', '눈', '눈', '안개']
      : season === '여름'
        ? ['맑음', '맑음', '구름', '흐림', '비', '비', '안개']
        : ['맑음', '맑음', '구름', '흐림', '비', '안개'];
  const weather = pool[(Math.floor(rnd() * pool.length) + shift) % pool.length];
  return { season, weather, seed: Math.floor(rnd() * 1e9) + shift * 7919 };
}

function openF(f) {
  if (S.onboard === 1 && f !== 'sofa') {
    toast('먼저 소파에 읽을 책을 올려보세요');
    return;
  }
  if (S.onboard === 2 && f !== 'lamp') {
    S.onboard = 0;
    save();
  }
  if (f === 'door') {
    walkTo(...TARGET.door, () => enterVillage());
    closePanel();
    return;
  }
  if (panelOpen === 'mirror' && f !== 'mirror') cancelMirror();
  panelOpen = f;
  panelView = {};
  if (f === 'mirror') {
    tempAvatar = { ...S.avatar };
    if (S.newItem) {
      S.newItem = false;
      save();
    }
  }
  if (f === 'lamp' && S.onboard === 2) {
    S.onboard = 0;
    save();
  }
  if (f === 'window') {
    S.news.forEach((n) => (S.newsSeen[n.id] = 1));
    save();
    render();
  }
  renderPanel();
  backdrop.classList.add('open');
  panel.scrollTop = 0;
  tip.style.display = 'none';
  focusPanel();
  if (f === 'sofa' && isSit()) {
    render();
  } else if (f === 'lamp' && isSit()) {
    render();
  } else
    walkTo(...TARGET[f], () => {
      if (f === 'sofa') sitDown();
    });
  if (f !== 'mirror') zoom(false);
}

function homeCard() {
  const r = S.reading,
    ses = S.session;
  const st = ses
    ? ses.status === 'RUNNING'
      ? `스탠드 켜짐 · <span id="homeT">${fmtHMS(elapsed())}</span>`
      : '스탠드 확인 필요'
    : '스탠드 꺼짐';
  const F = [
    ['sofa', '🛋', '소파', '지금 읽는 책 · 메모'],
    ['lamp', '💡', '스탠드', '독서 타이머'],
    ['shelf', '📚', '책장', '다 읽은 책 ' + S.finished.length + '권'],
    ['calendar', '📅', '달력', '독서한 날 · 월 목표'],
    ['mirror', '🪞', '거울', '캐릭터 꾸미기'],
    ['window', '🪟', '창문', ''],
    ['door', '🚪', '문', '마을로 나가기'],
  ];
  return `<div class="panel-head"><h2>오늘의 방</h2></div>
  <div class="card">${r ? `<b>『${esc(r.title)}』</b> 읽는 중${r.totalPages ? `<div class="progress" style="margin:8px 0 6px"><i style="width:${r.progress}%"></i></div>` : ''}<div class="muted">${r.totalPages ? r.progress + '% · ' : ''}${st}</div>` : '<b>소파가 비어 있어요</b><div class="muted" style="margin-top:4px">읽을 책을 올려두면 스탠드를 켤 수 있어요</div>'}
  <div class="muted" style="margin-top:6px">오늘 ${todayMin()}분${calData().streak ? ' · ' + calData().streak + '일 연속' : ''}</div></div>
  <label>가구</label>${F.map(([k, ic, n, d]) => `<button class="home-f" data-act="home" data-f="${k}"><i>${ic}</i><span class="grow">${n}</span><span class="muted">${d}</span></button>`).join('')}
  <p class="muted" style="margin-top:10px">방 안의 가구를 눌러도 돼요. 바닥을 누르면 캐릭터가 걸어가요.</p>`;
}
// 쪽수 → 퍼센트 자동 계산
function updProgress(r) {
  r.progress =
    r.totalPages && r.page != null ? Math.min(100, Math.max(0, Math.round((r.page / r.totalPages) * 100))) : 0;
} // 전체 쪽수나 현재 쪽이 없으면 퍼센트를 비운다 (#26)
function pgHint(r) {
  if (!r.totalPages) return '전체 쪽수를 적으면 퍼센트가 자동으로 계산돼요';
  if (r.page != null && r.page > r.totalPages) return '전체 쪽수보다 커요. 100%로 계산해요';
  return r.page != null
    ? r.page + '쪽까지 읽었어요 · 메모에 쪽수를 적어도 자동으로 올라가요'
    : '현재 쪽을 적으면 퍼센트가 자동으로 계산돼요';
}
function bthumb(b) {
  return `<div class="bthumb" style="background:${bookColor(b.title || '')}">${b.cover ? `<img src="${esc(b.cover)}" alt="" onerror="this.remove()">` : ''}</div>`;
}
