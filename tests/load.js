// 테스트용 로더: prototype/index.html을 jsdom(가상 브라우저)에 올린다.
// 3D 라이브러리(three.js)는 올리지 않는다 → 페이지 안에서 G3가 null이 되고, 3D 없이 로직과 패널만 돈다.
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = process.env.RR_HTML || path.join(__dirname, '..', 'prototype', 'index.html'); // RR_HTML: 테스트가 정말 결함을 잡는지 확인할 때 다른 파일을 가리킨다
const KEY = 'myroom-proto-v1';

// 캔버스 2D 컨텍스트 대용: 무엇을 호출해도 조용히 넘어간다
const noopCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => ((t[k] = v), true) });

// 테스트가 중간에 실패해도 창(과 페이지의 타이머)을 모두 닫아 프로세스가 끝나게 한다
const opened = [];
const closeAll = () => { for (const w of opened.splice(0)) { try { w.close(); } catch (e) {} } };

function load({ state, touch } = {}) {
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
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      if (state) w.localStorage.setItem(KEY, JSON.stringify(state));
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

module.exports = { load, closeAll, sleep, kstToday, KEY };
