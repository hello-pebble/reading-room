// 공용 · 그리기 도우미, 날짜 표기, 거울 선택지 상수. 원래 app.js를 구역별로 나눈 파일들이다: base → state → stage → render → panel → app (차례로 읽는다)
let TW = 32,
  TZ = 32;
const TH = 16;
const P = (x, y, z) => [(x - y) * TW, (x + y) * TH - z * TZ];
const pts = (a) => a.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.min(255, Math.round(r * f));
  g = Math.min(255, Math.round(g * f));
  b = Math.min(255, Math.round(b * f));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function box(x, y, z, w, d, h, c, cls) {
  const t = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const r = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
  const l = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const k = cls ? ` class="${cls}"` : '';
  return `<g${k}><polygon points="${pts(l)}" fill="${shade(c, 0.9)}"/><polygon points="${pts(r)}" fill="${shade(c, 0.78)}"/><polygon points="${pts(t)}" fill="${c}"/></g>`;
}
function hull(x, y, z, w, d, h) {
  return `<polygon class="hull" points="${pts([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z), P(x, y + d, z + h)])}"/>`;
}
function floorPoly(x1, y1, x2, y2, fill, extra = '') {
  return `<polygon points="${pts([P(x1, y1, 0.01), P(x2, y1, 0.01), P(x2, y2, 0.01), P(x1, y2, 0.01)])}" fill="${fill}" ${extra}/>`;
}
function wallRect(x1, x2, z1, z2, fill, y = 0.02) {
  return `<polygon points="${pts([P(x1, y, z1), P(x2, y, z1), P(x2, y, z2), P(x1, y, z2)])}" fill="${fill}"/>`;
}
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = () => ymd(); // 메모·인용구 날짜와 읽기 시작일도 연도를 포함한 한국 시간 날짜로 저장한다 (결정 #41, 열린 결정 Q ①)
// 화면에는 올해는 '11.05', 다른 해는 '2025.11.05'로 보여준다
const shortDate = (s) => {
  const m = /^(\d{4})\.(\d+)\.(\d+)$/.exec(String(s || ''));
  if (!m) return s || '';
  const y = +new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(0, 4);
  return (+m[1] === y ? '' : m[1] + '.') + +m[2] + '.' + m[3];
};
const ymd = () => {
  const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).split('-');
  return y + '.' + +m + '.' + d;
}; // 완독일 '2026.11.17' (한국 시간, 연도 포함)

const COLORS = [
  ['하양', '#f6f3ff'],
  ['크림', '#fff1d6'],
  ['분홍', '#ffd6e4'],
  ['민트', '#cdf0e0'],
  ['하늘', '#cfe4fb'],
  ['라일락', '#e0d4fa'],
  ['버터', '#fff0a8'],
  ['회색', '#d9dce6'],
];
const EXPR = [
  ['normal', '기본'],
  ['happy', '웃음'],
  ['surprised', '놀람'],
  ['sleepy', '졸림'],
  ['wink', '윙크'],
];
const FACE = [
  ['none', '없음'],
  ['glasses', '동그란 안경'],
  ['sunglasses', '선글라스'],
  ['bandaid', '반창고'],
];
const HEAD = [
  ['none', '없음'],
  ['beanie', '비니'],
  ['bow', '리본'],
  ['crown', '왕관'],
  ['sprout', '새싹'],
];
const PROP = [
  ['none', '없음'],
  ['book', '책'],
  ['mug', '찻잔'],
  ['lantern', '랜턴'],
  ['balloon', '풍선'],
];
const defAvatar = () => ({ color: '#f6f3ff', expr: 'normal', face: 'none', head: 'none', prop: 'book' });
const SPINE = ['#6d8f6b', '#b9654a', '#d7b45a', '#5f7aa0', '#8c5a7a', '#a8875a', '#4f6d6a', '#c98a6a'];
