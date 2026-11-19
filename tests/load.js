// 테스트용 로더: frontend/index.html을 jsdom(가상 브라우저)에 올린다.
// 3D 라이브러리(three.js)는 올리지 않는다 → 페이지 안에서 G3가 null이 되고, 3D 없이 로직과 패널만 돈다.
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = process.env.RR_HTML || path.join(__dirname, '..', 'frontend', 'index.html'); // RR_HTML: 테스트가 정말 결함을 잡는지 확인할 때 다른 파일을 가리킨다
const KEY = 'myroom-proto-v1';

// 캔버스 2D 컨텍스트 대용: 무엇을 호출해도 조용히 넘어간다
const noopCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => ((t[k] = v), true) });

// 테스트가 중간에 실패해도 창(과 페이지의 타이머)을 모두 닫아 프로세스가 끝나게 한다
const opened = [];
const closeAll = () => { for (const w of opened.splice(0)) { try { w.close(); } catch (e) {} } };

// api: fakeServer()를 주면 주소에 ?api=가 붙은 서버 연결 모드로 열고, 페이지의 fetch를 그 가짜 서버로 바꾼다. local: 열기 전에 localStorage에 미리 넣을 값
function load({ state, touch, api, local } = {}) {
  const html = fs.readFileSync(FILE, 'utf8')
    .replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
      if (src.startsWith('vendor/') || /^https?:/.test(src)) return ''; // 3D 라이브러리 제외
      return '<script>\n' + fs.readFileSync(path.join(path.dirname(FILE), src), 'utf8') + '</script>';
    }) // 실제 HTML의 스크립트 순서대로 읽는다 (파일을 하나라도 빠뜨리면 실패한다)
    .replace(/<script>window\.THREE\|\|document\.write[\s\S]*?<\/script>/, ''); // CDN 대체 로더 제외
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String((e && e.stack) || e)));
  vc.on('error', m => errors.push('console.error: ' + m));
  const dom = new JSDOM(html, {
    url: 'http://localhost/' + (api ? '?api=http://api.test' : ''), runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      if (state) w.localStorage.setItem(KEY, JSON.stringify(state));
      if (local) for (const [k, v] of Object.entries(local)) w.localStorage.setItem(k, v);
      if (api) w.fetch = (url, init) => api.fetch(url, init);
      w.matchMedia = q => ({ matches: /hover: hover/.test(q) && !touch, media: q, addEventListener() {}, removeEventListener() {} });
      w.ResizeObserver = class { observe() {} disconnect() {} };
      w.HTMLCanvasElement.prototype.getContext = () => noopCtx();
    },
  });
  const w = dom.window;
  opened.push(w);
  return {
    w, doc: w.document, errors,
    ev: code => w.eval(code),                       // 페이지 안의 변수·함수(S, openF, ...)를 직접 읽고 부른다
    click: sel => { const el = w.document.querySelector(sel); if (!el) throw new Error('요소 없음: ' + sel); el.click(); },
    change: (sel, value) => { const el = w.document.querySelector(sel); if (!el) throw new Error('요소 없음: ' + sel); el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); },
    state: () => JSON.parse(w.eval('JSON.stringify(S)')),
    close: () => w.close(),
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// 한국 시간 기준 오늘 (앱의 달력·완독일과 같은 기준)
const kstToday = () => { const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).split('-').map(Number); return { y, m, d }; };

// 서버를 흉내 낸다. 화면이 서버 응답을 어떻게 다루는지만 본다(진짜 규칙은 백엔드 테스트가 본다). 닉네임 규칙은 서버와 같은 문구를 돌려준다.
const API_BASE = 'http://api.test';
const NICK_RULE = /^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{1,5}$/;
function fakeServer() {
  const users = {}, tokens = {}, calls = [];
  let seq = 0;
  const res = (status, data) => ({ ok: status < 400, status, json: async () => { if (data === undefined) throw new Error('본문 없음'); return data; } });
  const mk = (label, nickname) => {
    const u = { id: ++seq, publicId: '00000000-0000-4000-8000-' + String(seq).padStart(12, '0'), nickname: nickname || '손님', needsNickname: !nickname };
    return (users[label] = u);
  };
  const issue = (u) => { const t = 'tok-' + ++seq; tokens[t] = u; return t; };
  // 책·메모 (서버 규칙을 화면 테스트에 필요한 만큼만 흉내 낸다: 소파는 한 권, 제목 필수, 쪽수는 올라가기만 한다)
  const pct = (b) => (b.totalPages ? Math.min(100, Math.floor((b.currentPage / b.totalPages) * 100)) : null);
  const bookView = (b) => { const { notes, ...rest } = b; return { ...rest, percent: pct(b) }; };
  const mkBook = (u, o) => {
    const b = { id: ++seq, isbn: o.isbn || null, title: o.title, author: o.author || null, coverUrl: o.coverUrl || null, totalPages: o.totalPages || null,
      currentPage: o.currentPage || 0, status: o.status || 'READING', rating: o.rating || null, oneLineReview: o.oneLineReview || null,
      startedAt: o.startedAt || '2026-11-17T03:00:00Z', finishedAt: o.finishedAt || null, notes: [] };
    (u.books = u.books || []).push(b);
    return b;
  };
  const raise = (b, page) => { if (page != null && page > b.currentPage) b.currentPage = b.totalPages ? Math.min(page, b.totalPages) : page; };
  const srv = {
    calls, users, tokens, down: false,
    rooms: [], // 공유방 (오래된 것부터). parts[0]이 개설자
    // 그 계정이 개설자인 방을 미리 만들어 둔다. o: {kind, title, isbn, max, openAt, hours} (시각은 서버 시각 ms)
    seedRoom(label, o = {}) {
      const u = users[label], open = o.openAt == null ? Date.now() + srv.skew : o.openAt;
      const r = { id: ++seq, kind: o.kind || 'SAME', title: o.title || '같이 읽기', isbn: o.isbn || '9780000000001', openAt: open, closeAt: open + (o.hours || 3) * 3600000, closedAt: null,
        max: o.max || 8, code: o.code || 'INVITE' + seq, parts: [{ uid: u.id, agreed: false, left: false }] };
      srv.rooms.push(r);
      return r;
    },
    plaza: [], // 광장 글 (오래된 것부터)
    // 그 계정이 쓴 광장 글을 미리 만들어 둔다. agoMs: 몇 ms 전에 썼는지
    seedPlaza(label, content, agoMs = 0) {
      const u = users[label];
      const msg = { id: ++seq, publicId: u.publicId, nickname: u.nickname, avatar: {}, content, createdAt: new Date(Date.now() + srv.skew - agoMs).toISOString() };
      srv.plaza.push(msg);
      return msg;
    },
    skew: 0, // 서버 시계가 화면 시계보다 앞선 만큼(ms)
    now() { return Date.now() + srv.skew; },
    // 그 계정의 스탠드 세션을 미리 만들어 둔다. startedAt·lastCheckAt·endedAt은 서버 시각(ms), 책은 그 계정의 읽는 책
    seedSession(label, o) {
      const u = users[label], b = (u.books || []).find((x) => x.status === 'READING');
      const s = { id: ++seq, bookId: b.id, status: 'RUNNING', lastCheckAt: o.startedAt, ...o };
      (u.sess = u.sess || []).push(s);
      return s;
    },
    // 이미 가입한 계정과 그 토큰을 만들어 둔다 (재방문·토큰 만료 시나리오용)
    seed(label, nickname) { return issue(mk(label, nickname)); },
    // 그 계정에 책을 미리 만들어 둔다. notes: [{type, content, page}] (오래된 것부터)
    seedBook(label, o) {
      const b = mkBook(users[label], o);
      let n = 0;
      for (const m of o.notes || []) b.notes.push({ id: ++seq, bookId: b.id, type: m.type || 'MEMO', content: m.content, page: m.page == null ? null : m.page, createdAt: '2026-11-17T0' + (n++ % 10) + ':00:00Z' });
      return b;
    },
    async fetch(url, init = {}) {
      const method = init.method || 'GET', path = url.replace(API_BASE, '');
      const body = init.body ? JSON.parse(init.body) : {};
      const auth = (init.headers || {}).Authorization;
      calls.push({ method, path, body: init.body ? body : undefined, auth });
      if (srv.down) throw new TypeError('Failed to fetch');
      if (method === 'POST' && path === '/dev/login') {
        const label = String(body.label == null ? '' : body.label).trim();
        if (!label || label.length > 40) return res(400, { error: 'BAD_LABEL', message: '이름은 1~40자로 적어 주세요' });
        const created = !users[label], u = users[label] || mk(label);
        return res(200, { token: issue(u), expiresAt: '2099-01-01T00:00:00Z', newUser: created, user: { ...u } });
      }
      const user = auth && tokens[auth.replace('Bearer ', '')];
      if (!user) return res(401, { error: 'UNAUTHORIZED', message: '로그인이 필요해요' });
      if (method === 'GET' && path === '/me') return res(200, { ...user });
      if (method === 'PUT' && path === '/me/nickname') {
        if (!NICK_RULE.test(body.nickname == null ? '' : body.nickname))
          return res(400, { error: 'BAD_NICKNAME', message: '닉네임은 한글·영문·숫자로 1~5자예요. 이모티콘·특수문자·공백은 쓸 수 없어요' });
        user.nickname = body.nickname; user.needsNickname = false;
        return res(200, { ...user });
      }
      if (method === 'POST' && path === '/auth/logout') { delete tokens[auth.replace('Bearer ', '')]; return res(204); }
      const books = user.books || [];
      let m;
      if (method === 'GET' && (m = path.match(/^\/books\?status=(\w+)$/))) return res(200, books.filter((b) => b.status === m[1]).map(bookView));
      if (method === 'POST' && path === '/books') {
        const title = String(body.title == null ? '' : body.title).trim();
        if (!title || title.length > 200) return res(400, { error: 'BAD_TITLE', message: '제목은 1~200자로 적어 주세요' });
        if (books.some((b) => b.status === 'READING')) return res(409, { error: 'ALREADY_READING', message: '소파에 이미 읽는 책이 있어요. 먼저 완독하거나 포기해 주세요' });
        return res(201, bookView(mkBook(user, { ...body, title })));
      }
      // 스탠드 세션 (서버 시각 srv.now()를 기준으로, 3시간 규칙·1분 미만 버림만 흉내 낸다)
      const ss = (user.sess = user.sess || []);
      const iso = (t) => (t == null ? null : new Date(t).toISOString());
      const sv = (s) => ({ id: s.id, bookId: s.bookId, status: s.status, source: s.source || 'TIMER', startedAt: iso(s.startedAt), endedAt: iso(s.endedAt),
        lastCheckAt: iso(s.lastCheckAt), endedBy: s.endedBy || null, endPage: s.endPage == null ? null : s.endPage, memo: s.memo || null,
        minutes: s.endedAt == null ? null : Math.floor((s.endedAt - s.startedAt) / 60000) });
      const live = () => { const s = ss.find((x) => x.status === 'RUNNING' || x.status === 'NEEDS_CONFIRM'); if (s && s.status === 'RUNNING' && srv.now() - s.startedAt > 3 * 3600000) s.status = 'NEEDS_CONFIRM'; return s; };
      const closeS = (s, end, by, b) => {
        s.endedAt = end; s.endedBy = by; s.status = end - s.startedAt < 60000 ? 'DISCARDED' : 'DONE';
        const bk = books.find((x) => x.id === s.bookId);
        if (b && b.totalPages && !bk.totalPages) bk.totalPages = b.totalPages;
        if (b && b.endPage != null) { s.endPage = b.endPage; raise(bk, b.endPage); }
        if (b && b.memo) { s.memo = b.memo; bk.notes.push({ id: ++seq, bookId: bk.id, type: 'MEMO', content: b.memo, page: null, createdAt: iso(end) }); }
        return res(200, sv(s));
      };
      if (method === 'GET' && path === '/sessions/current') { const s = live(); return res(200, { session: s ? sv(s) : null, serverNow: iso(srv.now()) }); }
      if (method === 'GET' && path === '/me/reading-time') {
        const day = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const min = ss.filter((s) => s.status === 'DONE' && day(s.endedAt) === day(srv.now())).reduce((a, s) => a + Math.floor((s.endedAt - s.startedAt) / 60000), 0);
        return res(200, { date: day(srv.now()), minutes: min, serverNow: iso(srv.now()) });
      }
      // 공유방 (개설·초대 입장·보관 동의·나가기·닫기. 상태는 서버 시각으로 계산하고 규칙은 화면 테스트에 필요한 만큼만 흉내 낸다)
      const roomStatus = (r) => (r.closedAt || srv.now() >= r.closeAt ? 'CLOSED' : srv.now() < r.openAt ? 'SCHEDULED' : 'OPEN');
      const roomRow = (r) => {
        const me = r.parts.find((p) => p.uid === user.id), live = r.parts.filter((p) => !p.left);
        const closed = r.closedAt || r.closeAt;
        return { id: r.id, kind: r.kind, title: r.title, isbn: r.isbn || null, status: roomStatus(r), openAt: iso(r.openAt), closeAt: iso(r.closeAt), closedAt: iso(r.closedAt),
          deleteAt: roomStatus(r) === 'CLOSED' ? iso(closed + 7 * 86400000) : null, participants: live.length, maxParticipants: r.max, mine: r.parts[0].uid === user.id,
          joined: !!me && !me.left, agreed: !!me && !me.left && !!me.agreed, unread: false, alarm: false,
          ownerNickname: Object.values(users).find((u) => u.id === r.parts[0].uid).nickname, inviteCode: r.parts[0].uid === user.id ? r.code : null };
      };
      const mineRooms = () => srv.rooms.filter((r) => { const p = r.parts.find((x) => x.uid === user.id); return p && !p.left; });
      if (method === 'GET' && path === '/rooms') return res(200, mineRooms().map(roomRow));
      if (method === 'POST' && path === '/rooms') {
        if (body.kind !== 'SAME' && body.kind !== 'OWN') return res(400, { error: 'BAD_KIND', message: '방 종류를 골라 주세요' });
        if (!Number.isInteger(body.maxParticipants) || body.maxParticipants < 2 || body.maxParticipants > 10) return res(400, { error: 'BAD_MAX', message: '최대 인원은 2~10명이에요' });
        if (body.kind === 'SAME' && !body.isbn) return res(400, { error: 'BAD_ISBN', message: '같은 책 방은 책(isbn)이 필요해요' });
        const open = body.openAt ? Date.parse(body.openAt) : srv.now();
        if (open < srv.now() - 60000) return res(400, { error: 'BAD_OPEN_AT', message: '시작 시각은 지금보다 뒤로 정해 주세요' });
        const mineLive = srv.rooms.filter((r) => r.parts[0].uid === user.id && roomStatus(r) !== 'CLOSED').length;
        if (mineLive >= 2) return res(409, { error: 'ROOM_LIMIT_LIVE', message: '동시에 열 수 있는 모닥불은 2개예요. 하나를 끝낸 뒤에 다시 피워 주세요' });
        if (srv.rooms.filter((r) => r.parts[0].uid === user.id).length >= 3) return res(409, { error: 'ROOM_LIMIT_DAILY', message: '모닥불은 하루에 3번까지 피울 수 있어요. 내일 다시 피워 주세요' });
        const bk = body.bookId && books.find((b) => b.id === body.bookId);
        const r = { id: ++seq, kind: body.kind, title: body.title || (body.kind === 'OWN' ? user.nickname + '의 모닥불' : '『' + (bk ? bk.title : '책') + '』 같이 읽기'), isbn: body.kind === 'SAME' ? body.isbn : null,
          openAt: open, closeAt: open + (body.hours || 3) * 3600000, closedAt: null, max: body.maxParticipants, code: 'CODE' + String(seq).padStart(4, '0'), parts: [{ uid: user.id, agreed: false, left: false }] };
        srv.rooms.push(r);
        return res(201, roomRow(r));
      }
      if (method === 'POST' && path === '/rooms/join') {
        const code = String(body.code == null ? '' : body.code).trim().toUpperCase();
        if (!code) return res(400, { error: 'BAD_CODE', message: '초대 코드를 적어 주세요' });
        const r = srv.rooms.find((x) => x.code === code);
        if (!r) return res(404, { error: 'NOT_FOUND', message: '초대 코드를 찾을 수 없어요' });
        const me = r.parts.find((p) => p.uid === user.id);
        if (me && !me.left) return res(200, roomRow(r));
        if (roomStatus(r) === 'CLOSED') return res(410, { error: 'ROOM_CLOSED', message: '이미 끝난 모닥불이에요' });
        if (r.parts.filter((p) => !p.left).length >= r.max) return res(409, { error: 'ROOM_FULL', message: '정원이 가득 찼어요' });
        if (me) { me.left = false; me.agreed = false; } else r.parts.push({ uid: user.id, agreed: false, left: false });
        return res(201, roomRow(r));
      }
      if ((m = path.match(/^\/rooms\/(\d+)\/(agree|close)$/)) && method === 'POST') {
        const r = srv.rooms.find((x) => x.id === +m[1]), me = r && r.parts.find((p) => p.uid === user.id);
        if (!r) return res(404, { error: 'NOT_FOUND', message: '모닥불을 찾을 수 없어요' });
        if (m[2] === 'agree') {
          if (!me || me.left) return res(403, { error: 'NOT_PARTICIPANT', message: '참여 중인 모닥불이 아니에요' });
          me.agreed = me.agreed || srv.now();
          return res(200, { roomId: r.id, agreedAt: iso(me.agreed) });
        }
        if (r.parts[0].uid !== user.id) return res(403, { error: 'NOT_OWNER', message: '방을 연 사람만 끝낼 수 있어요' });
        if (roomStatus(r) === 'CLOSED') return res(409, { error: 'ROOM_ALREADY_CLOSED', message: '이미 끝난 모닥불이에요' });
        const sched = roomStatus(r) === 'SCHEDULED';
        if (sched) srv.rooms.splice(srv.rooms.indexOf(r), 1); else r.closedAt = srv.now(); // 취소는 방이 사라진다
        return res(200, { id: r.id, result: sched ? 'CANCELED' : 'CLOSED', closedAt: iso(srv.now()) });
      }
      if ((m = path.match(/^\/rooms\/(\d+)\/participants\/me$/)) && method === 'DELETE') {
        const r = srv.rooms.find((x) => x.id === +m[1]), me = r && r.parts.find((p) => p.uid === user.id);
        if (!r || !me || me.left) return res(404, { error: 'NOT_FOUND', message: '참여 중인 모닥불이 아니에요' });
        if (r.parts[0].uid === user.id) return res(409, { error: 'OWNER_CANNOT_LEAVE', message: '방을 연 사람은 나갈 수 없어요' });
        me.left = true;
        return res(204);
      }
      // 마을 광장 대화 (모든 계정이 한 줄을 나눠 쓴다. 40자·같은 글 연속 금지·3초 3건만 흉내 낸다)
      if (method === 'GET' && (m = path.match(/^\/plaza\/messages(?:\?since=(.+))?$/))) {
        const since = m[1] ? Date.parse(decodeURIComponent(m[1])) : null;
        const out = since == null ? srv.plaza.slice(-30) : srv.plaza.filter((x) => Date.parse(x.createdAt) >= since).slice(0, 30);
        return res(200, out);
      }
      if (method === 'POST' && path === '/plaza/messages') {
        const content = String(body.content == null ? '' : body.content).trim();
        if (!content || [...content].length > 40) return res(400, { error: 'BAD_CONTENT', message: '한 줄은 1~40자로 적어 주세요' });
        const mine = srv.plaza.filter((x) => x.publicId === user.publicId), t = srv.now();
        if (mine.filter((x) => t - Date.parse(x.createdAt) < 3000).length >= 3) return res(429, { error: 'TOO_FAST', message: '조금 뒤에 보내 주세요' });
        const last = mine[mine.length - 1];
        if (last && last.content === content && t - Date.parse(last.createdAt) < 30000) return res(409, { error: 'DUPLICATE_MESSAGE', message: '같은 말을 연달아 보낼 수 없어요' });
        const msg = { id: ++seq, publicId: user.publicId, nickname: user.nickname, avatar: {}, content, createdAt: new Date(t).toISOString() };
        srv.plaza.push(msg);
        return res(201, msg);
      }
      // 달력·월 목표 (독서한 날 = 끝난 스탠드·직접 기록과 완독한 날, 한국 날짜. 목표는 달별, 없으면 앞선 달에서 이어받음)
      const kd = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      const goals = (user.goals = user.goals || {});
      const nowYm = kd(srv.now()).slice(0, 7);
      const goalOf = (ym) => {
        if (goals[ym]) return { goal: goals[ym].goal, changes: goals[ym].changes, inherited: false };
        const ks = Object.keys(goals).filter((k) => k < ym).sort();
        return ks.length ? { goal: goals[ks.pop()].goal, changes: [], inherited: true } : { goal: null, changes: [], inherited: false };
      };
      if (method === 'GET' && (m = path.match(/^\/me\/calendar(?:\?month=(\d{4}-\d{2}))?$/))) {
        const ym = m[1] || nowYm;
        if (ym > nowYm) return res(400, { error: 'FUTURE', message: '이번 달보다 뒤는 볼 수 없어요' });
        const all = new Set([...ss.filter((s) => s.status === 'DONE').map((s) => kd(s.endedAt)), ...books.filter((b) => b.status === 'DONE').map((b) => kd(b.finishedAt))]);
        let streak = null;
        if (ym === nowYm) {
          streak = 0;
          const d = new Date(kd(srv.now()) + 'T00:00:00Z');
          if (!all.has(kd(srv.now()))) d.setUTCDate(d.getUTCDate() - 1);
          while (all.has(d.toISOString().slice(0, 10))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
        }
        const g = goalOf(ym);
        return res(200, { month: ym, days: [...all].filter((x) => x.startsWith(ym)).sort(), streak, finishedCount: books.filter((b) => b.status === 'DONE' && kd(b.finishedAt).startsWith(ym)).length,
          goal: g.goal, goalChanges: g.changes, goalInherited: g.inherited, serverNow: iso(srv.now()) });
      }
      if (method === 'PUT' && path === '/me/goal') {
        const v = body.monthlyGoal;
        if (!Number.isInteger(v) || v < 1 || v > 99) return res(400, { error: 'BAD_GOAL', message: '목표는 1~99권으로 정해 주세요' });
        const cur = goalOf(nowYm), e = goals[nowYm] || (goals[nowYm] = { goal: cur.goal == null ? 1 : cur.goal, changes: [] });
        if (e.goal !== v) { e.changes.push({ at: kd(srv.now()), from: e.goal, to: v }); e.goal = v; }
        return res(200, { month: nowYm, goal: e.goal, goalChanges: e.changes, goalInherited: false });
      }
      if (method === 'POST' && path === '/sessions/start') {
        const bk = books.find((x) => x.status === 'READING');
        if (!bk) return res(400, { error: 'NO_READING_BOOK', message: '소파에 책을 먼저 올려 주세요' });
        const cur = live();
        if (cur) return res(409, { error: 'ALREADY_RUNNING', message: '이미 스탠드가 켜져 있어요', session: sv(cur), serverNow: iso(srv.now()) });
        const s = { id: ++seq, bookId: bk.id, status: 'RUNNING', startedAt: srv.now(), lastCheckAt: srv.now() };
        ss.push(s);
        return res(201, sv(s));
      }
      if (method === 'POST' && path === '/sessions/manual') {
        const bk = books.find((x) => x.status === 'READING');
        if (!bk) return res(400, { error: 'NO_READING_BOOK', message: '소파에 책을 먼저 올려 주세요' });
        if (!(body.minutes >= 1 && body.minutes <= 600)) return res(400, { error: 'BAD_MINUTES', message: '1~600분 사이로 입력해 주세요' });
        const start = srv.now() - (body.daysAgo || 0) * 86400000;
        const s = { id: ++seq, bookId: bk.id, status: 'DONE', source: 'MANUAL', startedAt: start, endedAt: start + body.minutes * 60000, endedBy: 'MANUAL' };
        ss.push(s);
        return res(201, sv(s));
      }
      if ((m = path.match(/^\/sessions\/(\d+)\/(stop|check|confirm)$/))) {
        const s = ss.find((x) => x.id === +m[1]);
        if (!s) return res(404, { error: 'NOT_FOUND', message: '기록을 찾을 수 없어요' });
        live();
        if (m[2] === 'stop') return s.endedAt ? res(200, sv(s)) : closeS(s, s.status === 'NEEDS_CONFIRM' ? s.lastCheckAt : srv.now(), body.endedBy || 'LAMP', body);
        if (m[2] === 'check') {
          if (s.status !== 'RUNNING') return res(409, { error: 'NOT_RUNNING', message: '켜져 있는 스탠드에서만 [계속]을 누를 수 있어요' });
          s.lastCheckAt = srv.now();
          return res(200, sv(s));
        }
        if (s.status !== 'NEEDS_CONFIRM') return res(409, { error: 'NOT_NEEDS_CONFIRM', message: '확인이 필요한 스탠드가 아니에요' });
        if (body.discard) { s.status = 'DISCARDED'; s.endedAt = srv.now(); return res(200, sv(s)); }
        if (body.until === 'LAST_CHECK') return closeS(s, s.lastCheckAt - s.startedAt >= 60000 ? s.lastCheckAt : s.startedAt + 3600000, 'CONFIRM');
        if (body.until === 'MINUTES') return closeS(s, s.startedAt + body.minutes * 60000, 'CONFIRM');
        return res(400, { error: 'BAD_UNTIL', message: 'until은 LAST_CHECK 또는 MINUTES예요' });
      }
      if ((m = path.match(/^\/books\/(\d+)(\/.*)?$/))) {
        const b = books.find((x) => x.id === +m[1]);
        if (!b) return res(404, { error: 'NOT_FOUND', message: '책을 찾을 수 없어요' });
        const sub = m[2] || '';
        if (method === 'PATCH' && !sub) {
          if (body.totalPages !== undefined) b.totalPages = body.totalPages >= 1 ? Math.min(9999, body.totalPages) : null;
          if (body.currentPage !== undefined) b.currentPage = Math.max(0, body.currentPage || 0);
          return res(200, bookView(b));
        }
        if (method === 'GET' && sub === '/notes') return res(200, b.notes.slice().reverse());
        if (method === 'POST' && sub === '/notes') {
          const content = String(body.content == null ? '' : body.content);
          if (!content.trim()) return res(400, { error: 'BAD_CONTENT', message: '내용은 1~2000자로 적어 주세요' });
          const n = { id: ++seq, bookId: b.id, type: body.type || 'MEMO', content, page: body.page == null ? null : body.page, createdAt: '2026-11-17T03:00:00Z' };
          b.notes.push(n);
          raise(b, n.page);
          return res(201, { ...n, currentPage: b.currentPage, percent: pct(b) });
        }
        if (method === 'DELETE' && (m = sub.match(/^\/notes\/(\d+)$/))) {
          const i = b.notes.findIndex((n) => n.id === +m[1]);
          if (i < 0) return res(404, { error: 'NOTE_NOT_FOUND', message: '메모를 찾을 수 없어요' });
          b.notes.splice(i, 1);
          return res(204);
        }
        if (method === 'POST' && (sub === '/finish' || sub === '/drop')) {
          if (b.status !== 'READING') return res(409, { error: 'NOT_READING', message: '읽는 중인 책이 아니에요' });
          b.status = sub === '/finish' ? 'DONE' : 'DROPPED';
          b.finishedAt = '2026-11-17T03:00:00Z';
          if (sub === '/finish') { b.rating = body.rating || null; b.oneLineReview = body.oneLineReview || null; }
          return res(200, bookView(b));
        }
      }
      return res(404, { error: 'NOT_FOUND', message: '없는 주소예요' });
    },
  };
  return srv;
}

module.exports = { load, closeAll, sleep, kstToday, fakeServer, KEY };
