// 내 방 · 입력칸 처리(bindRoomEvents)와 버튼 동작(roomAction) (room.js에서 이어진다)

// ===== 입력칸: 제목·저자·쪽수·메모·목표 =====
function bindRoomEvents() {
  panel.addEventListener('change', (e) => {
    if (e.target.id === 'goal') {
      const s = e.target.value;
      if (s !== '') setGoal(+s);
      save();
      renderPanel();
      render();
    } // 칸을 벗어나면 1~99로 맞춰 화면과 저장값을 일치시킨다
  });
  panel.addEventListener('input', (e) => {
    if (e.target.id === 'goal') {
      let v = Math.round(+e.target.value);
      if (!(v >= 1)) return;
      v = Math.min(99, v);
      if (v !== +e.target.value) e.target.value = v;
      setGoal(v);
      const c = calData(),
        bar = document.getElementById('goalBar'),
        st = document.getElementById('goalStat'),
        nt = document.getElementById('goalNote');
      if (bar) bar.style.width = Math.min(100, Math.round((c.done / c.goal) * 100)) + '%';
      if (st) st.textContent = goalStatText(c);
      if (nt) nt.textContent = goalNoteText(c);
      render();
    }
    if (e.target.id === 'pg' || e.target.id === 'tp') {
      const r = S.reading,
        pg = document.getElementById('pg').value,
        tp = document.getElementById('tp').value;
      r.page = pg === '' ? null : Math.max(0, Math.round(+pg));
      r.totalPages = Math.round(+tp) >= 1 ? Math.min(9999, Math.round(+tp)) : null;
      updProgress(r);
      save();
      if (API.enabled) queueBookSave(r); // 입력이 멈추면 서버에 한 번 저장한다 (books.js)
      document.getElementById('pv').textContent = r.totalPages ? r.progress + '%' : '';
      const bar = panel.querySelector('.card .progress i');
      if (bar) bar.style.width = (r.progress || 0) + '%';
      document.getElementById('pgHint').textContent = pgHint(r);
      render();
    }
    if (e.target.id === 'bq') {
      panelView.q = e.target.value;
    }
    if (e.target.id === 'btp') {
      panelView.tp = e.target.value;
    }
    if (e.target.id === 'nc') {
      panelView.draft = e.target.value;
      document.getElementById('ncE').textContent = '';
    }
    if (e.target.id === 'bt') {
      panelView.t = e.target.value;
      document.getElementById('btE').textContent = '';
    }
    if (e.target.id === 'ba') {
      panelView.a = e.target.value;
      document.getElementById('baE').textContent = '';
    }
    if (e.target.id === 'rv') {
      panelView.review = e.target.value;
    }
    if (e.target.id === 'sp' || e.target.id === 'stp') {
      const r = S.reading,
        sp = document.getElementById('sp'),
        stp = document.getElementById('stp'),
        tot = r.totalPages || (stp && Math.max(0, Math.min(9999, +stp.value))) || 0,
        pgv = sp.value === '' ? null : +sp.value;
      document.getElementById('spv').textContent =
        tot && pgv != null ? Math.min(100, Math.max(0, Math.round((pgv / tot) * 100))) + '%' : '';
    }
    if (e.target.id === 'sm') {
      panelView.memo = e.target.value;
    }
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'bq') {
      e.preventDefault();
      runSearch();
    }
  });
}

// ===== 버튼 동작: 소파·스탠드·책장·거울·달력 =====
function roomAction(act, b) {
  if (act === 'addBook') {
    const t = (panelView.t || '').trim(),
      a = (panelView.a || '').trim();
    let bad = false;
    if (!t) {
      document.getElementById('btE').textContent = '제목을 입력해 주세요';
      bad = true;
    }
    if (!a) {
      document.getElementById('baE').textContent = '저자를 입력해 주세요';
      bad = true;
    }
    if (bad) return true;
    const tp = Math.round(+panelView.tp) >= 1 ? Math.min(9999, Math.round(+panelView.tp)) : null; // 전체 쪽수: 빈 값 또는 1~9999
    if (API.enabled) {
      serverAddBook(t, a, tp); // 서버 연결 모드: 서버가 받아들이면 소파에 올린다 (books.js)
      return true;
    }
    const li = S.later.findIndex((x) => x.title === t),
      lrooms = li >= 0 ? S.later.splice(li, 1)[0].rooms : []; // 나중에 읽을 책에 있던 책이면 목록에서 빼고 공유방 기록을 이어 받는다
    S.reading = {
      id: Date.now(),
      title: t,
      author: a,
      cover: panelView.cover || '',
      isbn: panelView.isbn || '',
      totalPages: tp,
      page: 0,
      progress: 0,
      notes: [],
      rooms: lrooms,
      startedAt: today(),
    };
    panelView = {};
    const wasOb = S.onboard === 1;
    if (wasOb) S.onboard = 2;
    save();
    render();
    renderPanel();
    toast('소파에 『' + t + '』을 올렸어요');
    return true;
  }
  if (act === 'laterToSofa') {
    const i = S.later.findIndex((x) => x.id === +b.dataset.id);
    if (i < 0) return true; // 나중에 읽을 책을 책장에서 바로 소파에 올린다. 공유방 기록이 따라온다
    if (S.reading) {
      toast('소파에 이미 읽는 책이 있어요. 먼저 완독하거나 포기해 주세요');
      return true;
    }
    const lb = S.later.splice(i, 1)[0];
    S.reading = {
      id: Date.now(),
      title: lb.title,
      author: lb.author || '',
      cover: lb.cover || '',
      isbn: lb.isbn || '',
      totalPages: lb.totalPages || null,
      page: 0,
      progress: 0,
      notes: [],
      rooms: lb.rooms || [],
      startedAt: today(),
    };
    save();
    closePanel();
    render();
    toast('소파에 『' + lb.title + '』을 올렸어요. 공유방 기록이 따라왔어요');
    return true;
  }
  if (act === 'type') {
    panelView.type = b.dataset.t;
    renderPanel();
    return true;
  }
  if (act === 'addNote') {
    const c = (panelView.draft || '').trim();
    if (!c) {
      document.getElementById('ncE').textContent = '내용을 입력해 주세요';
      return true;
    }
    const pg = Math.max(0, Math.round(+document.getElementById('np').value)) || null,
      rd = S.reading;
    if (API.enabled) {
      serverAddNote(c, pg);
      return true;
    }
    rd.notes.push({ type: panelView.type || 'MEMO', content: c, page: pg, at: today() });
    panelView.draft = '';
    if (pg && (rd.page == null || pg > rd.page)) {
      rd.page = pg;
      updProgress(rd);
      toast(pg + '쪽까지 읽은 걸로 기록했어요' + (rd.totalPages ? ' (' + rd.progress + '%)' : ''));
    }
    save();
    render();
    renderPanel();
    return true;
  }
  if (act === 'delNote') {
    if (API.enabled) {
      serverDelNote(+b.dataset.i);
      return true;
    }
    S.reading.notes.splice(+b.dataset.i, 1);
    save();
    renderPanel();
    return true;
  }
  if (act === 'finish') {
    panelView.mode = 'finish';
    renderPanel();
    return true;
  }
  if (act === 'drop') {
    panelView.mode = 'drop';
    renderPanel();
    return true;
  }
  if (act === 'cancelFinish') {
    panelView.mode = null;
    renderPanel();
    return true;
  }
  if (act === 'star') {
    panelView.rating = +b.dataset.n === panelView.rating ? 0 : +b.dataset.n;
    renderPanel();
    return true;
  }
  if (act === 'doFinish') {
    if (S.session && S.session.status === 'NEEDS_CONFIRM') {
      openF('lamp');
      toast('먼저 스탠드 시간을 확인해 주세요');
      return true;
    }
    const rating = panelView.rating || 0,
      review = (panelView.review || '').trim(); // endSession()이 panelView를 비우기 전에 별점·한줄평을 챙긴다 (Codex QA)
    if (API.enabled) {
      serverEndBook('finish', rating, review);
      return true;
    }
    if (S.session) endSession(Date.now(), 'FINISH', true);
    const r = S.reading;
    const id = r.id || Date.now();
    S.finished.push({
      id,
      title: r.title,
      author: r.author,
      cover: r.cover || '',
      isbn: r.isbn || '',
      totalPages: r.totalPages || null,
      rating,
      review,
      finishedAt: ymd(),
      notes: r.notes,
      rooms: r.rooms || [],
    });
    S.reading = null;
    panelView = {};
    save();
    closePanel();
    render();
    if (G3) G3.flash('shelf');
    toast('『' + r.title + '』을 책장에 꽂았어요');
    return true;
  }
  if (act === 'doDrop') {
    if (S.session && S.session.status === 'NEEDS_CONFIRM') {
      openF('lamp');
      toast('먼저 스탠드 시간을 확인해 주세요');
      return true;
    }
    if (API.enabled) {
      serverEndBook('drop');
      return true;
    }
    if (S.session) endSession(Date.now(), 'FINISH', true);
    const r = S.reading;
    S.dropped.push({
      id: r.id || Date.now(),
      title: r.title,
      author: r.author,
      cover: r.cover || '',
      isbn: r.isbn || '',
      totalPages: r.totalPages || null,
      rating: 0,
      review: '',
      finishedAt: ymd(),
      notes: r.notes,
      rooms: r.rooms || [],
    });
    S.reading = null;
    panelView = {};
    save();
    closePanel();
    render();
    toast('소파를 비웠어요');
    return true;
  }
  if (act === 'goSofa') {
    openF('sofa');
    return true;
  }
  if (act === 'startTimer') {
    startTimer();
    return true;
  }
  if (act === 'pip') {
    openPip();
    return true;
  }
  if (act === 'stopAsk') {
    panelView = { mode: 'stop' };
    renderPanel();
    return true;
  }
  if (act === 'back2') {
    panelView = {};
    renderPanel();
    return true;
  }
  if (act === 'stopSave') {
    const r = S.reading,
      sp = document.getElementById('sp'),
      stp = document.getElementById('stp');
    if (stp && stp.value) {
      const tp = Math.round(+stp.value);
      r.totalPages = tp >= 1 ? Math.min(9999, tp) : null;
    } // 소파 입력과 같은 규칙: 1~9999, 아니면 비움 (#36)
    if (sp && sp.value !== '') r.page = Math.max(0, Math.round(+sp.value));
    updProgress(r);
    const m = (panelView.memo || '').trim();
    if (API.enabled) syncStandStop(r, m);
    else if (m) r.notes.push({ type: 'MEMO', content: m, page: null, at: today() });
    endSession(Date.now(), 'LAMP');
    return true;
  }
  if (act === 'discard') {
    if (pipWin) pipDone(0);
    S.session = null;
    save();
    panelView = {};
    render();
    renderPanel();
    toast('기록하지 않고 스탠드를 껐어요');
    return true;
  }
  if (act === 'ff') {
    const ms = +b.dataset.m * 60000;
    S.session.startedAt -= ms;
    S.session.lastCheckAt -= ms;
    if (+b.dataset.m >= 180) S.session.lastCheckAt = S.session.startedAt + 70 * 60000;
    save();
    checkSession(true);
    return true;
  }
  if (act === 'confirmLast') {
    endSession(S.session.lastCheckAt, 'CONFIRM');
    return true;
  }
  if (act === 'confirmHour') {
    endSession(S.session.startedAt + 3600000, 'CONFIRM');
    return true;
  }
  if (act === 'cmanual') {
    panelView = { mode: 'cmanual' };
    renderPanel();
    return true;
  }
  if (act === 'confirmManual') {
    const m = Math.round(+document.getElementById('cm').value);
    if (!(m >= 1 && m <= 600 && m * 60000 <= Date.now() - S.session.startedAt)) {
      document.getElementById('cmE').textContent = '1~600분 사이, 켠 뒤 지난 시간 안으로 입력해 주세요';
      return true;
    }
    endSession(S.session.startedAt + m * 60000, 'CONFIRM');
    return true;
  }
  if (act === 'manual') {
    panelView = { mode: 'manual', day: 0 };
    renderPanel();
    return true;
  }
  if (act === 'mday') {
    panelView.day = +b.dataset.d;
    renderPanel();
    return true;
  }
  if (act === 'manualSave') {
    const m = Math.round(+document.getElementById('mm').value);
    if (!(m >= 1 && m <= 600)) {
      document.getElementById('mmE').textContent = '1~600분 사이로 입력해 주세요';
      return true;
    }
    const d = new Date();
    d.setDate(d.getDate() - (panelView.day || 0));
    d.setHours(12, 0, 0, 0);
    S.sessions.push({
      id: Date.now(),
      bookId: S.reading.id,
      startedAt: d.getTime(),
      endedAt: d.getTime() + m * 60000,
      minutes: m,
      source: 'MANUAL',
      endedBy: 'MANUAL',
    });
    save();
    panelView = {};
    render();
    renderPanel();
    toast(m + '분을 기록했어요');
    return true;
  }
  if (act === 'list') {
    panelView = { list: b.dataset.t };
    renderPanel();
    return true;
  }
  if (act === 'openBook') {
    panelView = { book: +b.dataset.id, drop: b.dataset.drop === '1', list: panelView.list };
    renderPanel();
    return true;
  }
  if (act === 'back') {
    panelView = { list: panelView.list };
    renderPanel();
    return true;
  }
  if (act === 'tab') {
    panelView.tab = b.dataset.t;
    renderPanel();
    return true;
  }
  if (act === 'av') {
    if (b.disabled) return true;
    tempAvatar[b.dataset.k] = b.dataset.v;
    renderPanel();
    render();
    return true;
  }
  if (act === 'shuffle') {
    const pk = (l) => l[Math.floor(Math.random() * l.length)][0];
    tempAvatar = {
      color: COLORS[Math.floor(Math.random() * COLORS.length)][1],
      expr: pk(EXPR),
      face: pk(FACE.filter(([v]) => !(v === 'glasses' && !S.unlocked.glasses))),
      head: pk(HEAD.filter(([v]) => !(v === 'beanie' && S.finished.length < 10))),
      prop: pk(PROP),
    };
    renderPanel();
    render();
    return true;
  }
  if (act === 'sceneNext') {
    S.sceneShift = (S.sceneShift || 0) + 1;
    save();
    render();
    renderPanel();
    return true;
  }
  if (act === 'bsearch') {
    runSearch();
    return true;
  }
  if (act === 'bpick') {
    const it = (panelView.res || [])[+b.dataset.i];
    if (!it) return true;
    Object.assign(panelView, {
      t: it.title,
      a: it.author,
      tp: it.pages || '',
      cover: it.cover,
      isbn: it.isbn,
      res: null,
      msg: '',
    });
    renderPanel();
    return true;
  }
  if (act === 'bclear') {
    Object.assign(panelView, { cover: '', isbn: '', res: null, msg: '' });
    renderPanel();
    return true;
  }
  if (act === 'goalDec' || act === 'goalInc') {
    setGoal(calData().goal + (act === 'goalInc' ? 1 : -1));
    renderPanel();
    render();
    return true;
  }
  if (act === 'calPrev') {
    panelView.calOff = (panelView.calOff || 0) - 1;
    renderPanel();
    return true;
  }
  if (act === 'calNext') {
    panelView.calOff = Math.min(0, (panelView.calOff || 0) + 1);
    renderPanel();
    return true;
  }
  if (act === 'cancelMirror') {
    closePanel();
    return true;
  }
  if (act === 'saveMirror') {
    S.avatar = { ...tempAvatar };
    tempAvatar = null;
    save();
    panelOpen = null;
    closePanel();
    render();
    toast('새 모습을 저장했어요');
    return true;
  }
  return false;
}
