// 내 방 · 소파·스탠드·책장·거울·달력·창문 창의 화면 문구 (room.js에서 이어진다)

function sofaPanel() {
  const r = S.reading;
  if (!r) {
    const pv = panelView,
      picked = pv.cover || pv.isbn;
    return (
      head('소파 · 읽을 책 올리기') +
      `<p class="muted">지금 읽는 책 한 권만 올릴 수 있어요.</p>
  <label for="bq">책 찾기</label>
  <div class="row bsearch"><input id="bq" placeholder="책 제목이나 저자를 적어 주세요" value="${esc(pv.q || '')}"><button class="ibtn" data-act="bsearch" aria-label="책 찾기" title="찾기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg></button></div>
  <div class="muted" id="bmsg" style="margin-top:4px">${esc(pv.msg || '')}</div>
  ${pv.res && pv.res.length ? pv.res.map((it, i) => `<button class="book" data-act="bpick" data-i="${i}">${bthumb(it)}<div class="grow"><div>『${esc(it.title)}』</div><div class="muted">${esc(it.author || '저자 정보 없음')}${it.pages ? ' · ' + it.pages + '쪽' : ''}</div></div></button>`).join('') : ''}
  ${picked ? `<div class="card row">${bthumb({ title: pv.t || '', cover: pv.cover })}<div class="grow"><b>『${esc(pv.t || '')}』</b><div class="muted">${esc(pv.a || '')}${pv.tp ? ' · ' + pv.tp + '쪽' : ''}</div></div><button class="ghost" data-act="bclear">다시 찾기</button></div>` : ''}
  <label for="bt">제목</label><input id="bt" placeholder="데미안" value="${esc(pv.t || '')}"><div class="err" id="btE"></div>
  <label for="ba">저자</label><input id="ba" placeholder="헤르만 헤세" value="${esc(pv.a || '')}"><div class="err" id="baE"></div>
  <label for="btp">전체 쪽수 (선택)</label><input id="btp" type="number" min="1" inputmode="numeric" placeholder="모르면 비워 두세요" value="${esc(pv.tp || '')}">
  <div class="muted" style="margin-top:4px">책을 찾으면 표지, 제목, 저자, 쪽수가 한 번에 채워져요. 못 찾으면 직접 적어도 돼요.</div>
  <div class="foot" style="margin-top:14px"><button class="primary" data-act="addBook" style="width:100%">소파에 두기</button></div>`
    );
  }
  if (panelView.mode === 'finish') {
    const st = panelView.rating || 0;
    return (
      head('완독했어요') +
      `<div class="card"><b>『${esc(r.title)}』</b><div class="muted">${esc(r.author)} · 메모 ${r.notes.length}개</div></div>
  <label>별점 (선택)</label><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-act="star" data-n="${n}" class="${n <= st ? 'on' : ''}" aria-label="${n}점">★</button>`).join('')}</div>
  <label for="rv">한줄평 (선택)</label><input id="rv" placeholder="오래 남을 것 같은 책" value="${esc(panelView.review || '')}">
  <div class="row foot" style="margin-top:14px"><button data-act="cancelFinish">뒤로</button><button class="primary grow" data-act="doFinish">책장에 꽂기</button></div>`
    );
  }
  if (panelView.mode === 'drop') {
    return (
      head('포기할까요?') +
      `<p>『${esc(r.title)}』을 소파에서 내려요. 남긴 메모 ${r.notes.length}개는 책장의 ‘포기한 책’에 그대로 보관돼요.</p>
  <div class="row"><button class="grow" data-act="cancelFinish">계속 읽기</button><button class="grow" data-act="doDrop" style="color:var(--danger)">포기</button></div>`
    );
  }
  const type = panelView.type || 'MEMO';
  return (
    head('소파 · 읽는 중') +
    `<div class="card"><div class="row">${bthumb(r)}<div class="grow"><b>『${esc(r.title)}』</b><div class="muted">${esc(r.author)} · ${shortDate(r.startedAt)}부터</div></div></div>
  <label for="pg" style="margin-top:12px">어디까지 읽었나요?</label>
  <div class="row"><input id="pg" type="number" min="0" inputmode="numeric" placeholder="현재 쪽" value="${r.page == null ? '' : r.page}" style="width:96px"><span class="muted">/</span><input id="tp" type="number" min="1" inputmode="numeric" placeholder="전체 쪽" value="${r.totalPages || ''}" style="width:96px"><span class="muted">쪽</span><b id="pv" class="grow" style="font-weight:normal;font-size:24px;text-align:right">${r.totalPages ? r.progress + '%' : ''}</b></div>
  <div class="progress" style="margin:8px 0 4px"><i style="width:${r.progress || 0}%"></i></div>
  <div class="muted" id="pgHint">${pgHint(r)}</div></div>
  <label>오늘 읽은 부분 남기기</label>
  <div class="seg"><button data-act="type" data-t="MEMO" class="${type === 'MEMO' ? 'on' : ''}">메모</button><button data-act="type" data-t="QUOTE" class="${type === 'QUOTE' ? 'on' : ''}">인용구</button></div>
  <textarea id="nc" style="margin-top:8px" placeholder="${type === 'QUOTE' ? '마음에 남은 문장을 그대로 적어요' : '읽으면서 든 생각을 적어요'}">${esc(panelView.draft || '')}</textarea>
  <div class="err" id="ncE"></div>
  <div class="row" style="margin-top:6px"><input id="np" type="number" min="1" placeholder="쪽 (선택)" style="width:110px"><button class="primary grow" data-act="addNote">추가</button></div>
  <div style="margin-top:10px">${
    r.notes.length
      ? r.notes
          .slice()
          .reverse()
          .map((n, ix) => noteHTML(n, r.notes.length - 1 - ix, true))
          .join('')
      : '<p class="muted">아직 남긴 기록이 없어요.</p>'
  }</div>
  <div class="row foot" style="margin-top:14px"><button data-act="drop">포기</button><button class="primary grow" data-act="finish">완독</button></div>`
  );
}
function noteHTML(n, ix, del) {
  return `<div class="note ${n.type === 'QUOTE' ? 'q' : ''}">${n.type === 'QUOTE' ? '“' + esc(n.content) + '”' : esc(n.content)}<div class="meta"><span>${n.type === 'QUOTE' ? '인용구' : '메모'}${n.page ? ' · ' + n.page + '쪽' : ''} · ${shortDate(n.at)}</span>${del ? `<button class="ghost" style="padding:0 4px;font-size:12px" data-act="delNote" data-i="${ix}">삭제</button>` : ''}</div></div>`;
}
function lampPanel() {
  const r = S.reading,
    ses = S.session,
    v = panelView;
  const tools = API.enabled
    ? '' // 시간 앞당기기는 화면 시계만 바꾸므로 서버 연결 모드에서는 쓰지 않는다
    : `<details style="margin-top:14px"><summary class="muted" style="cursor:pointer">테스트 도구 (시간 앞당기기)</summary><div class="row wrap" style="margin-top:8px"><button data-act="ff" data-m="10">+10분</button><button data-act="ff" data-m="60">+60분 · 확인 알림</button><button data-act="ff" data-m="185">+3시간 · 깜빡함</button></div><p class="muted">실제로는 서버의 시작 시각을 기준으로 계산해요. 여기서는 시작 시각을 과거로 옮겨서 흉내 내요. 알림은 5초 안에 와요.</p></details>`;
  if (ses && ses.status === 'NEEDS_CONFIRM') {
    const lastOk = ses.lastCheckAt - ses.startedAt >= 60000;
    const lm = Math.floor((ses.lastCheckAt - ses.startedAt) / 60000);
    if (v.mode === 'cmanual')
      return (
        head('스탠드 · 언제까지 읽었나요?') +
        `<label for="cm">읽은 시간 (분)</label><input id="cm" type="number" min="1" max="600" placeholder="45"><div class="err" id="cmE"></div><div class="row foot" style="margin-top:12px"><button data-act="back2">뒤로</button><button class="primary grow" data-act="confirmManual">저장</button></div>`
      );
    return (
      head('스탠드 · 확인이 필요해요') +
      `<div class="card"><b>${fmtClock(ses.startedAt)}에 켠 스탠드가 아직 켜져 있어요.</b><div class="muted" style="margin-top:4px">3시간이 넘어서 기록을 잠시 멈췄어요. 언제까지 읽었나요?</div></div>
   ${lastOk ? `<button class="primary" style="width:100%;margin-top:6px" data-act="confirmLast">마지막으로 '계속'을 누른 ${fmtClock(ses.lastCheckAt)}까지 · ${lm}분</button>` : `<button class="primary" style="width:100%;margin-top:6px" data-act="confirmHour">1시간 읽은 걸로 기록</button>`}
   <div class="row" style="margin-top:8px"><button class="grow" data-act="cmanual">직접 입력</button><button class="grow" data-act="discard" style="color:var(--danger)">기록 안 함</button></div>`
    );
  }
  if (!r)
    return (
      head('스탠드 · 꺼짐') +
      `<p>소파에 책을 올리면 스탠드를 켤 수 있어요.</p><button class="primary" data-act="goSofa" style="width:100%">소파로 가기</button>`
    );
  const bookMin = minOfBook(r.id);
  if (ses) {
    if (v.mode === 'stop') {
      const pr = v.prog ?? r.progress;
      return (
        head('읽기 끝') +
        `<div class="card"><div class="muted">이번에 읽은 시간</div><div style="font-size:28px">${fmtHMS(elapsed())}</div><div class="muted">${fmtClock(ses.startedAt)} ~ 지금 · 『${esc(r.title)}』</div></div>
   <label for="sp">어디까지 읽었나요?</label><div class="row"><input type="number" id="sp" min="0" inputmode="numeric" placeholder="현재 쪽" value="${r.page == null ? '' : r.page}" style="width:110px">${r.totalPages ? `<span class="muted">/ ${r.totalPages}쪽</span>` : `<input type="number" id="stp" min="1" inputmode="numeric" placeholder="전체 쪽" style="width:110px">`}<b id="spv" class="grow" style="font-weight:normal;font-size:22px;text-align:right">${r.totalPages ? r.progress + '%' : ''}</b></div>
   <label for="sm">한 줄 메모 (선택)</label><input id="sm" placeholder="오늘 읽은 부분에서 남기고 싶은 것" value="${esc(v.memo || '')}">
   <div class="row foot" style="margin-top:14px"><button data-act="back2">계속 읽기</button><button class="primary grow" data-act="stopSave">끄고 저장</button></div>`
      );
    }
    return (
      head('스탠드 · 켜짐') +
      `<div class="card" style="text-align:center"><div class="muted">『${esc(r.title)}』 읽는 중</div><div id="timerBig" style="font-size:40px;letter-spacing:1px;margin:4px 0">${fmtHMS(elapsed())}</div><div class="muted">${fmtClock(ses.startedAt)}에 켰어요 · 이 책 누적 ${bookMin}분</div></div>
   <p class="muted">화면을 꺼도, 앱을 닫아도 계속 기록돼요. 다시 열면 켠 시각부터 다시 계산해요.</p>${notifyRow()}
   <div class="row"><button class="primary grow" data-act="stopAsk">💡 스탠드 끄기</button>${pipOK() ? `<button class="grow" data-act="pip">바탕화면에 띄우기</button>` : ''}</div>${pipOK() ? '' : '<p class="muted" style="margin-top:6px">바탕화면 띄우기는 데스크톱 크롬·엣지·파이어폭스 151 이상에서 돼요.</p>'}
   ${API.enabled ? '' : '<button class="ghost" style="width:100%;margin-top:6px;color:var(--danger)" data-act="discard">기록 안 하고 끄기</button>'}${tools}`
    );
  }
  if (v.mode === 'manual')
    return (
      head('직접 기록') +
      `<p class="muted">스탠드를 못 켜고 밖에서 읽었을 때 쓰세요.</p>
   <label>언제</label><div class="seg"><button data-act="mday" data-d="0" class="${(v.day || 0) == 0 ? 'on' : ''}">오늘</button><button data-act="mday" data-d="1" class="${v.day == 1 ? 'on' : ''}">어제</button></div>
   <label for="mm">읽은 시간 (분)</label><input id="mm" type="number" min="1" max="600" placeholder="30"><div class="err" id="mmE"></div>
   <div class="row foot" style="margin-top:12px"><button data-act="back2">뒤로</button><button class="primary grow" data-act="manualSave">기록하기</button></div>`
    );
  const recent = S.sessions
    .filter((x) => x.bookId === r.id)
    .sort((p, q) => q.startedAt - p.startedAt)
    .slice(0, 5);
  return (
    head('스탠드 · 꺼짐') +
    `<div class="card"><b>『${esc(r.title)}』</b><div class="muted" style="margin-top:4px">이 책 누적 ${bookMin}분 · 오늘 ${todayMin()}분</div></div>
  <button class="primary" style="width:100%" data-act="startTimer">스탠드 켜고 읽기 시작</button>
  <button style="width:100%;margin-top:6px" data-act="manual">밖에서 읽었어요 · 직접 기록</button>
  <label>최근 기록</label>${recent.length ? recent.map((x) => `<div class="row" style="font-size:14px;padding:6px 0;border-bottom:1px solid var(--line)"><span class="grow">${fmtDay(x.startedAt)} ${x.source === 'MANUAL' ? '직접 기록' : fmtClock(x.startedAt) + ' ~ ' + fmtClock(x.endedAt)}</span><b style="font-weight:normal">${x.minutes}분</b></div>`).join('') : '<p class="muted">아직 기록이 없어요.</p>'}`
  );
}
function shelfPanel() {
  const v = panelView;
  if (v.book != null) {
    const later = v.list === 'later',
      list = later ? S.later : v.drop ? S.dropped : S.finished;
    const b = list.find((x) => x.id === v.book);
    if (!b) {
      panelView = {};
      return shelfPanel();
    }
    const tab = v.tab || (later ? 'rooms' : 'notes');
    const tabs = later
      ? [['rooms', '공유방 ' + (b.rooms ? b.rooms.length : 0)]]
      : [
          ['notes', '기록 ' + b.notes.length],
          ['review', '한줄평'],
        ].concat(b.rooms && b.rooms.length ? [['rooms', '공유방 ' + b.rooms.length]] : []);
    let body = '';
    if (tab === 'notes')
      body = b.notes.length ? b.notes.map((n) => noteHTML(n)).join('') : '<p class="muted">남긴 메모가 없어요.</p>';
    if (tab === 'review')
      body = `<div class="card">${b.rating ? `<div style="color:#e0a43a">${'★'.repeat(b.rating)}<span style="color:#d6c9ad">${'★'.repeat(5 - b.rating)}</span></div>` : ''}<div>${b.review ? esc(b.review) : '<span class="muted">한줄평이 없어요.</span>'}</div></div>`;
    if (tab === 'rooms') {
      body =
        b.rooms
          .map((rm) => {
            const lbl =
              String(rm.title || '')
                .replace(b.title, '')
                .replace(/[『』]/g, '')
                .trim() || (rm.rtype === 'OWN' ? '각자 읽기' : '이야기방');
            return `<div class="card"><b>${esc(lbl)}</b><div class="muted">${rm.period} · 가져온 기록</div><div style="margin-top:8px">${rm.messages.map((m) => `<div class="msg"><b>${esc(m.who)}</b>${esc(m.text)}</div>`).join('')}</div></div>`;
          })
          .join('') + '<p class="muted">다른 참여자 이름은 익명으로 보관돼요.</p>';
    }
    return (
      head('책장') +
      `<button class="ghost" data-act="back" style="padding:4px 0">← 목록</button>
   <div class="row" style="margin-top:6px">${bthumb(b)}<div><b>『${esc(b.title)}』</b><div class="muted">${esc(b.author)} · ${later ? '나중에 읽을 책' : v.drop ? '포기' : shortDate(b.finishedAt) + ' 완독'}</div>${!later && minOfBook(b.id) > 0 ? `<div class="muted">⏱ 읽은 시간 ${fmtMin(minOfBook(b.id))} · 기록 ${S.sessions.filter((x) => x.bookId === b.id).length}번</div>` : ''}</div></div>
   ${later ? `<button class="primary" data-act="laterToSofa" data-id="${b.id}" style="width:100%;margin-top:8px">소파에 올리기</button>` : ''}
   <div class="tabs">${tabs.map(([k, l]) => `<button data-act="tab" data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}`
    );
  }
  const showDrop = v.list === 'drop',
    showLater = v.list === 'later';
  const list = showLater ? S.later.slice().reverse() : showDrop ? S.dropped : S.finished.slice().reverse();
  return (
    head('책장') +
    incomingGiftHtml() +
    `<div class="tabs"><button data-act="list" data-t="done" class="${!showDrop && !showLater ? 'on' : ''}">다 읽은 책 ${S.finished.length}</button><button data-act="list" data-t="drop" class="${showDrop ? 'on' : ''}">포기한 책 ${S.dropped.length}</button><button data-act="list" data-t="later" class="${showLater ? 'on' : ''}">나중에 읽을 책 ${S.later.length}</button></div>
  ${showLater ? '<p class="muted">공유방에서 가져왔는데 아직 내 책장에 없는 책이에요. 이 책을 소파에 올리면 이 목록에서 빠지고, 공유방 기록은 그대로 따라와요.</p>' : ''}
  ${list.length ? list.map((b) => `<button class="book" data-act="openBook" data-id="${b.id}" data-drop="${showDrop ? 1 : 0}"><div class="spine" style="background:${bookColor(b.title)}"></div><div class="grow"><div>『${esc(b.title)}』</div><div class="muted">${esc(b.author)}${b.rating ? ' · ' + '★'.repeat(b.rating) : ''}</div></div>${b.rooms && b.rooms.length ? '<span class="badge">공유방</span>' : ''}</button>`).join('') : '<p class="muted">아직 없어요.</p>'}`
  );
}
function mirrorPanel() {
  const a = tempAvatar,
    fc = S.finished.length;
  const lock = { face: (v) => v === 'glasses' && !S.unlocked.glasses, head: (v) => v === 'beanie' && fc < 10 };
  const opt = (lab, inner) => `<div class="opt"><label>${lab}</label><div class="row wrap">${inner}</div></div>`;
  const chips = (k, list) =>
    list
      .map(([v, n]) => {
        const lk = lock[k] && lock[k](v);
        return `<button class="acc ${a[k] === v ? 'on' : ''}" data-act="av" data-k="${k}" data-v="${v}" ${lk ? 'disabled' : ''}>${n}${lk ? (k === 'face' ? ' · 첫 책 기록 후' : ' · 10권 읽으면') : ''}</button>`;
      })
      .join('');
  const img = G3 ? `<img src="${G3.snap(a, 'body')}" alt="유령 미리보기">` : '';
  return (
    head('전신거울') +
    `<div class="mir"><div class="mir-l"><div class="mir-pv">${img}</div>
   <button class="shuffle" data-act="shuffle" aria-label="셔플" title="셔플"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg></button></div>
  <div class="mir-r">
  ${opt('색상', COLORS.map(([n, c]) => `<button class="sw ${a.color === c ? 'on' : ''}" style="background:${c}" data-act="av" data-k="color" data-v="${c}" aria-label="${n}"></button>`).join(''))}
  ${opt('표정', chips('expr', EXPR))}${opt('얼굴 장식', chips('face', FACE))}${opt('머리 장식', chips('head', HEAD))}${opt('손에 든 소품', chips('prop', PROP))}
  </div></div>
  <div class="row foot" style="margin-top:16px"><button data-act="cancelMirror" class="grow">취소</button><button class="primary grow" data-act="saveMirror">저장</button></div>`
  );
}
// 목표 카드의 "목표를 바꿨어요" 표시 (결정 #39). 달 중간에 바꾸면 그 달에 기록이 남고, 지난 달을 볼 때도 보인다.
function goalNoteText(c) {
  const ch = c.changes;
  if (ch.length)
    return (
      '🔁 목표를 바꿨어요 · ' +
      ch[0].from +
      '→' +
      c.goal +
      '권 (' +
      mmdd(ch[ch.length - 1].at) +
      (ch.length > 1 ? ', ' + ch.length + '번' : '') +
      ')'
    );
  if (c.off === 0 && !c.goalSet && c.goal != null) return '지난 달 목표를 이어받았어요';
  return '';
}
const goalStatText = (c) =>
  c.goal == null
    ? '완독 ' + c.done + '권 · 이 달은 목표 기록이 없어요'
    : '완독 ' +
      c.done +
      '/' +
      c.goal +
      '권' +
      (c.done >= c.goal ? ' · 목표 달성' : c.off < 0 ? ' · 목표 미달성' : '') +
      ' · 포기한 책은 세지 않아요';
function calendarPanel() {
  const off = Math.min(0, panelView.calOff || 0),
    c = calData(off),
    cur = off === 0,
    pct = c.goal ? Math.min(100, Math.round((c.done / c.goal) * 100)) : 0;
  const heads = ['일', '월', '화', '수', '목', '금', '토'].map((n) => `<b>${n}</b>`).join('');
  let cells = '';
  for (let i = 0; i < c.first; i++) cells += '<i></i>';
  for (let d = 1; d <= c.dim; d++)
    cells += `<i class="${c.marks.includes(d) ? 'on' : ''}${d === c.today ? ' today' : ''}">${d}</i>`;
  const goalCard = cur
    ? `<div class="card"><div class="row"><span class="grow">이번 달 완독 목표</span><button data-act="goalDec" aria-label="목표 줄이기">−</button><input id="goal" type="number" min="1" max="99" value="${c.goal}" style="width:64px;text-align:center"><button data-act="goalInc" aria-label="목표 늘리기">+</button><span>권</span></div>`
    : `<div class="card"><div class="row"><span class="grow">${c.m}월 완독 목표</span><b style="font-weight:normal;font-size:20px">${c.goal != null ? c.goal + '권' : '기록 없음'}</b></div>`;
  return (
    head('달력') +
    `<div class="card"><div class="row"><button data-act="calPrev" aria-label="이전 달" ${c.canPrev ? '' : 'disabled'}>‹</button><b class="grow" style="text-align:center">${c.y}년 ${c.m}월</b><button data-act="calNext" aria-label="다음 달" ${c.canNext ? '' : 'disabled'}>›</button></div>
  <div class="cal" style="margin-top:8px">${heads}${cells}</div>
  <div class="muted" style="margin-top:8px">초록색에 점이 찍힌 날은 책을 읽었거나 완독한 날이에요.</div></div>
  ${cur ? `<div class="card"><div class="row"><span class="grow">연속 독서일</span><b style="font-weight:normal;font-size:20px">${c.streak}일</b></div><div class="muted">오늘 또는 어제부터 이어서 센 날수예요. 같은 날 여러 번 읽어도 하루예요.</div></div>` : ''}
  ${goalCard}
  ${c.goal != null ? `<div class="progress" style="margin:10px 0 6px"><i id="goalBar" style="width:${pct}%"></i></div>` : ''}<div class="muted" id="goalStat">${goalStatText(c)}</div><div class="muted" id="goalNote" style="margin-top:6px">${goalNoteText(c)}</div>${cur ? '' : '<div class="muted" style="margin-top:6px">지난 달의 목표는 바꿀 수 없어요.</div>'}</div>`
  );
}

function windowPanel() {
  const K = { OPEN: ['진행 중', ''], SOON: ['예정', 'gray'], CLOSED: ['종료', 'warn'] };
  const sc = windowScene();
  return (
    head('창문') +
    `<div class="muted" style="margin:0 0 8px">오늘 창밖은 ${sc.season} ${sc.weather}이에요.</div>` +
    S.news
      .map((n) => {
        const [l, c] = K[n.kind];
        let act = '';
        if (n.kind === 'OPEN') act = `<button data-act="goVillage">마을로 가기</button>`;
        if (n.kind === 'SOON')
          act = `<button data-act="alarm" data-id="${n.id}">${n.alarm ? '알림 받는 중 ✓' : '알림 받기'}</button>`;
        if (n.kind === 'CLOSED')
          act = n.done
            ? `<span class="muted">내 서재로 가져옴 ✓</span>`
            : rcEmpty(n)
              ? `<span class="muted">가져올 대화가 없어요</span>`
              : `<button class="primary" data-act="import" data-id="${n.id}">내 서재로 가져오기</button>`;
        if (API.enabled && n.kind !== 'OPEN') act = ''; // 알림·가져오기는 5‑3단계에서 서버와 잇는다
        return `<div class="card"><div class="row"><span class="badge ${c}">${l}</span>${rcUnread(n) ? '<span class="badge">새 글</span>' : ''}<b class="grow" style="font-weight:normal">${esc(n.title)}</b></div><div class="muted" style="margin:6px 0 8px">${esc(roomSub(n))}</div>${act}</div>`;
      })
      .join('') +
    '<p class="muted">공유방 기록은 종료 후 7일 동안만 보관돼요.</p>' +
    `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">테스트 도구 (창밖 풍경 바꿔 보기)</summary><div class="row wrap" style="margin-top:8px"><button data-act="sceneNext">다른 날씨 보기</button></div><p class="muted">실제로는 날짜마다 풍경이 바뀌어요. 여기서는 다음 날씨로 넘겨 봐요.</p></details>` +
    (!API.enabled && S.news.some((n) => n.kind === 'SOON')
      ? `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">테스트 도구 (개방 시각 앞당기기)</summary><div class="row wrap" style="margin-top:8px">${S.news
          .filter((n) => n.kind === 'SOON')
          .map((n) => `<button data-act="openNow" data-id="${n.id}">${esc(n.title)} 지금 열기</button>`)
          .join('')}</div><p class="muted">알림 받기를 켜 둔 방은 열릴 때 알림이 와요.</p></details>`
      : '')
  );
}
function cancelMirror() {
  tempAvatar = null;
  zoom(false);
  render();
}
