// 공유방 · 모닥불 피우기(개설) 창과 초대 코드로 들어가기 (shared-room.js에서 이어진다)

function createPanel() {
  if (panelView.created) {
    const n = S.news.find((x) => x.id === panelView.created);
    if (n)
      return (
        head('모닥불을 피웠어요') +
        `<div class="card"><b>${esc(n.title)}</b><div class="muted" style="margin-top:4px">${esc(roomSub(n))}</div></div>` +
        inviteBlock(n) +
        '<p class="muted">친구에게 링크를 보내 보세요. 링크를 받은 사람이 열면 이 모닥불로 들어와요.</p>'
      );
  }
  const nf = panelView.nf || (panelView.nf = RDEF()),
    same = nf.kind === 'SAME';
  const seg = (act, items, cur) =>
    `<div class="seg">${items.map(([v, l]) => `<button data-act="${act}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const opts = [
    ...(S.reading ? [['sofa', '지금 읽는 책 · 『' + S.reading.title + '』']] : []),
    ...S.finished.map((b, i) => ['shelf:' + i, '책장 · 『' + b.title + '』']),
    ['typed', '직접 입력'],
  ];
  return (
    head('모닥불 피우기') +
    `
  <label>방 종류</label>${seg(
    'rkind',
    [
      ['SAME', '같은 책'],
      ['OWN', '각자 읽기'],
    ],
    nf.kind,
  )}
  <p class="muted" style="margin-top:6px">${same ? '모두가 같은 책을 읽어요. 쪽수에 맞춰 이야기하고, 끝나면 내 책장의 그 책에 대화가 담겨요.' : '각자 다른 책을 읽어도 돼요. 읽는 책 이야기를 같이 나누고, 끝나면 내가 고른 책에 대화가 담겨요.'}</p>
  <label for="rbook">${same ? '함께 읽을 책' : '내가 읽을 책'}</label>
  <select id="rbook"><option value="">${same ? '책을 골라 주세요' : '아직 안 정했어요'}</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${nf.bookSel === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
  ${nf.bookSel === 'typed' ? `<input id="rbookt" placeholder="책 제목" value="${esc(nf.bookTitle)}" style="margin-top:6px">` : ''}
  <label for="rname">방 이름 (비우면 자동)</label><input id="rname" placeholder="${nf.kind === 'SAME' ? '책 이름으로 정해져요' : esc(defaultRoomName(nf))}" value="${esc(nf.name)}">
  <label>시작</label>${seg(
    'rstart',
    [
      ['now', '지금 바로'],
      ['later', '예약'],
    ],
    nf.start,
  )}
  ${nf.start === 'later' ? `<input id="rwhen" type="datetime-local" value="${esc(nf.when)}" style="margin-top:6px">` : ''}
  <label>진행 시간</label>${seg(
    'rhours',
    [1, 2, 3, 4, 5, 6, 7].map((h) => [h, h + '시간']),
    nf.hours,
  )}<p class="muted" style="margin:6px 0 0">시간이 지나면 모닥불이 저절로 꺼지고 모두 광장으로 돌아가요. 방에서 이야기하며 읽는 시간은 오늘 읽은 시간에 더해져요.</p>
  ${
    PUBLIC_ROOMS
      ? `<label>공개 범위</label>${seg(
          'rvis',
          [
            ['invite', '초대 링크로만'],
            ['public', '마을에 공개'],
          ],
          nf.vis,
        )}`
      : '<p class="muted" style="margin:10px 0 0">초대 링크로 부른 친구만 들어올 수 있어요.</p>'
  }
  <p class="muted" style="margin:10px 0 0">오늘 개설 ${roomsMadeToday()}/3 · 동시에 2개까지</p>
  <label for="rmax">최대 인원</label><input id="rmax" type="number" min="2" max="${RMAX}" value="${nf.max}" style="width:100px">
  
  <div class="err" id="rerr"></div>
  <div class="foot" style="margin-top:14px"><button class="primary" data-act="rcreate" style="width:100%">모닥불 피우기</button></div>`
  );
}
const kstDay = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const roomsMadeToday = () => S.roomLog.filter((t) => kstDay(t) === kstDay(Date.now())).length; // 취소해도 세지 않고 쓴 횟수로 센다
function createRoom() {
  const nf = panelView.nf,
    err = (m) => {
      document.getElementById('rerr').textContent = m;
    };
  if (API.enabled) return serverCreateRoom(nf, err); // 방은 서버가 만든다 (rooms.js)
  const b = nfBook(nf),
    max = Math.round(+nf.max);
  if (roomsMadeToday() >= 3) return err('모닥불은 하루에 3번까지 피울 수 있어요. 내일 다시 피워 주세요');
  if (S.news.filter((n) => n.mine && n.kind !== 'CLOSED').length >= 2)
    return err('동시에 열 수 있는 모닥불은 2개예요. 하나를 끝낸 뒤에 다시 피워 주세요');
  if (nf.kind === 'SAME' && !b) return err('함께 읽을 책을 골라 주세요');
  if (!(max >= 2 && max <= RMAX)) return err('최대 인원은 2~' + RMAX + '명이에요');
  const now = Date.now();
  let opens = now;
  if (nf.start === 'later') {
    opens = new Date(nf.when).getTime();
    if (!(opens > now + 60000)) return err('시작 시각은 지금보다 뒤로 정해 주세요');
  }
  const name = (nf.name || '').trim() || defaultRoomName(nf),
    closes = opens + nf.hours * HOUR;
  const room = {
    id: 'r' + now,
    kind: opens <= now ? 'OPEN' : 'SOON',
    title: name,
    sub: '',
    book: b ? b.title : '',
    author: b ? b.author : '',
    cover: b ? b.cover : '',
    isbn: b ? b.isbn : '',
    rtype: nf.kind,
    mine: true,
    people: 1,
    max,
    vis: nf.vis,
    inviteCode: genCode(),
    opensAt: opens,
    closesAt: closes,
    alarm: true,
    done: false,
    messages: [],
    period: timeRange(opens, closes),
  };
  rcNorm(room);
  S.news.push(room);
  S.roomLog.push(now);
  save();
  panelView.created = room.id;
  render();
  renderPanel();
  buildSr();
  toast('모닥불을 피웠어요');
}
async function copyLink(n) {
  const link = inviteLink(n);
  try {
    await navigator.clipboard.writeText(link);
    toast('링크를 복사했어요');
  } catch (e) {
    const i = document.getElementById('invLink');
    if (i) {
      i.select();
      try {
        document.execCommand('copy');
        toast('링크를 복사했어요');
      } catch (_) {
        toast('링크를 길게 눌러 복사해 주세요');
      }
    }
  }
}
// ===== 초대 코드로 입장 (결정 #95): 코드 입력 → 입장 전 확인(방 이름·책·진행 시간·인원) → [이 방에 입장] → 보관 동의 → 모닥불 =====
// panelView.join: { code, err, preview } (게시판 창 안에서만 쓴다)
const joinCodeOf = (raw) => {
  let c = String(raw || '').trim();
  const m = /join=([A-Za-z0-9]+)/i.exec(c); // 초대 링크를 붙여 넣어도 된다
  if (m) c = m[1];
  return c.replace(/[\s-]/g, '').toUpperCase();
};
function joinCodeHtml() {
  const j = panelView.join;
  if (!j) return '<button data-act="joinOpen" style="width:100%;margin-top:8px">초대 코드로 입장</button>';
  const p = j.preview;
  return (
    '<label for="jl">초대 코드로 입장</label>' +
    `<div class="row"><input id="jl" value="${esc(j.code || '')}" placeholder="8자리 초대 코드를 입력해 주세요" aria-label="초대 코드" autocomplete="off" autocapitalize="characters" enterkeyhint="go"><button data-act="joinCheck" style="white-space:nowrap">확인</button></div>` +
    `<div class="muted" id="jlE" role="alert" style="color:var(--danger);min-height:1.2em">${esc(j.err || '')}</div>` +
    (p
      ? `<div class="card" id="joinPreview"><b>${esc(p.title)}</b>` +
        `<p class="muted" style="margin:6px 0 0">책: ${esc(p.book)}</p>` +
        (p.period ? `<p class="muted" style="margin:2px 0 0">진행 시간: ${esc(p.period)}${p.soon ? ' (아직 열리지 않았어요)' : ''}</p>` : '') + // 기간을 모르면 줄을 비워 두지 않는다
        `<p class="muted" style="margin:2px 0 0">참여 인원: ${p.people}/${p.max}명</p>` +
        `<button class="primary" data-act="joinConfirm" style="width:100%;margin-top:10px">이 방에 입장</button></div>`
      : '')
  );
}
async function joinCheck() {
  const j = panelView.join || (panelView.join = {});
  const inp = document.getElementById('jl');
  j.code = joinCodeOf(inp ? inp.value : j.code);
  j.preview = null;
  j.err = '';
  if (!/^[A-Z0-9]{8}$/.test(j.code)) j.err = '8자리 초대 코드를 입력해 주세요';
  else if (API.enabled) {
    try {
      const r = await API.get('/rooms/invite/' + encodeURIComponent(j.code)); // 로그인 없이도 열리는 미리보기
      if (r.status === 'CLOSED') j.err = '이미 끝난 모닥불이에요';
      else
        j.preview = {
          title: r.title,
          book: r.kind === 'OWN' ? '각자 읽는 책' : r.bookTitle || '같은 책',
          period: timeRange(Date.parse(r.openAt), Date.parse(r.closeAt)),
          soon: r.status === 'SCHEDULED',
          people: r.participants,
          max: r.maxParticipants,
        };
    } catch (e) {
      j.err = e.status === 404 ? '초대 코드를 찾을 수 없어요. 코드를 다시 확인해 주세요' : e.message;
    }
  } else {
    const n = findByCode(j.code);
    if (!n) j.err = '초대 코드를 찾을 수 없어요. 체험판에서는 같은 브라우저에서 만든 모닥불만 열려요';
    else if (n.kind === 'CLOSED') j.err = '이미 끝난 모닥불이에요';
    else
      j.preview = { title: n.title, book: n.rtype === 'OWN' ? '각자 읽는 책' : n.book, period: n.period || '', soon: n.kind === 'SOON', people: n.people, max: n.max };
  }
  renderPanel();
  if (!j.preview && document.getElementById('jl')) document.getElementById('jl').focus();
}
// 정원이 찼거나 그새 끝났으면 서버가 거절하고, 그 이유를 입력창 아래에 보인다
function joinConfirm() {
  const j = panelView.join;
  if (!j || !j.preview) return;
  const fail = (msg) => {
    j.preview = null;
    j.err = msg;
    renderPanel();
  };
  if (API.enabled) serverJoin(j.code, fail); // 들어오면 보관 동의 창으로 간다 (rooms.js)
  else if (!joinByCode(j.code)) fail('초대 코드를 찾을 수 없어요');
}
function copyCode(n) {
  const ok = () => toast('초대 코드를 복사했어요');
  const manual = () => toast('초대 코드 ' + n.inviteCode + ' 를 직접 적어 알려 주세요');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(n.inviteCode).then(ok, manual);
  else manual();
}
function findByCode(c) {
  c = String(c || '').trim();
  const m = /join=([A-Za-z0-9]+)/i.exec(c);
  if (m) c = m[1];
  c = c.toUpperCase();
  return S.news.find((n) => n.inviteCode === c);
}
function joinByCode(c) {
  if (API.enabled) {
    serverJoin(c); // 초대 코드는 서버가 찾는다 (rooms.js)
    return true;
  }
  const n = findByCode(c);
  if (!n) {
    toast('초대 코드를 찾을 수 없어요. 체험판에서는 같은 브라우저에서 만든 모닥불만 열려요');
    return false;
  }
  if (VIEW !== 'village') {
    enterVillage();
    setTimeout(() => openV('room:' + n.id), 900);
  } else openV('room:' + n.id);
  toast(n.mine ? '내가 만든 모닥불이에요' : '모닥불에 들어왔어요');
  return true;
}
