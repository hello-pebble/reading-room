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
  const srv = {
    calls, users, tokens, down: false,
    // 이미 가입한 계정과 그 토큰을 만들어 둔다 (재방문·토큰 만료 시나리오용)
    seed(label, nickname) { return issue(mk(label, nickname)); },
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
      return res(404, { error: 'NOT_FOUND', message: '없는 주소예요' });
    },
  };
  return srv;
}

module.exports = { load, closeAll, sleep, kstToday, fakeServer, KEY };
