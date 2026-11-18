// 시나리오 테스트: prototype/index.html을 가상 브라우저(jsdom)에 올려 실제 패널·버튼·로직을 돌린다.
// 3D(three.js)는 올리지 않는다. 화면 그림은 못 보지만 기록·규칙·패널 동작은 확인한다.
// 실행: npm test   (npm install 뒤)
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, closeAll, sleep, kstToday } = require('./load');
test.after(closeAll);

// 페이지에서 오류가 났는지 확인하고 닫는다
const fin = a => { assert.deepEqual(a.errors, [], '페이지에서 오류가 났어요'); a.close(); };
// 종료된 공유방 하나 (가져오기 테스트용)
const room = (id, book, author, text) => `{id:'${id}',kind:'CLOSED',title:'방${id}',book:'${book}',author:'${author}',period:'11.01 ~ 11.08',messages:[{who:'나',text:'${text}'}],deleteAt:Date.now()+5e8,done:false}`;

test('부팅: 오류 없이 열리고 기본 상태가 있다', () => {
  const a = load();
  assert.equal(a.ev('typeof S'), 'object');
  const s = a.state();
  assert.ok(Array.isArray(s.finished) && s.finished.length === 5, '데모 책 5권');
  assert.ok(Array.isArray(s.later) && Array.isArray(s.plaza) && Array.isArray(s.dropped));
  fin(a);
});

test('마을 구역: 모닥불 자리 8개는 모두 모닥불 구역 안이고 광장 밖이다', () => {
  const a = load();
  const { VSLOTS, PLAZA, ZONE } = JSON.parse(a.ev('JSON.stringify({VSLOTS,PLAZA,ZONE})'));
  assert.equal(VSLOTS.length, 8);
  for (const [x, z] of VSLOTS) {
    assert.ok(x > ZONE.x0 && x < ZONE.x1 && z > ZONE.z0 && z < ZONE.z1, `모닥불 자리 (${x},${z})가 모닥불 구역 밖`);
    assert.ok(!(x > PLAZA.x0 && x < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1), `모닥불 자리 (${x},${z})가 광장 안`);
  }
  assert.ok(PLAZA.x1 <= ZONE.x0, '광장과 모닥불 구역이 겹침');
  fin(a);
});

test('마을 모닥불 자리: 열린 방 → 곧 열릴 방 → 종료된 방 순서', () => {
  const a = load();
  a.ev(`S.news=[${room('k1', 'a', 'x', '.')},{id:'s1',kind:'SOON',title:'s',opensAt:Date.now()+1e6},{id:'o1',kind:'OPEN',title:'o'},${room('k2', 'b', 'x', '.')}]`);
  assert.equal(a.ev(`vilOrder().map(n=>n.kind).join(',')`), 'OPEN,SOON,CLOSED,CLOSED');
  fin(a);
});

test('스탠드: 3시간 넘긴 "확인 필요" 상태에서 완독을 누르면 먼저 확인 창이 열리고 기록은 남지 않는다', () => {
  const a = load();
  a.ev(`S.reading={id:1,title:'T',author:'a',totalPages:null,page:0,progress:0,notes:[],startedAt:'11.17'};
        const n=Date.now();S.session={startedAt:n-4*36e5,lastCheckAt:n-4*36e5+70*6e4,status:'NEEDS_CONFIRM'};
        openF('sofa');panelView={mode:'finish'};renderPanel()`);
  const before = a.state().finished.length;
  a.click('#panel [data-act=doFinish]');
  const s = a.state();
  assert.equal(a.ev('panelOpen'), 'lamp', '스탠드 확인 창이 열려야 해요');
  assert.equal(s.finished.length, before, '완독 처리되면 안 돼요');
  assert.ok(s.session, '세션이 그대로여야 해요');
  fin(a);
});

test('스탠드: 확인 없이 끝나도 마지막 확인 시각(70분)까지만 기록한다', () => {
  const a = load();
  a.ev(`const n=Date.now();S.session={startedAt:n-4*36e5,lastCheckAt:n-4*36e5+70*6e4,status:'NEEDS_CONFIRM'};endSession(Date.now(),'LAMP',true)`);
  assert.deepEqual(a.state().sessions.map(x => x.minutes), [70]);
  fin(a);
});

test('스탠드: 1분 미만(59초)은 기록하지 않고 61초는 1분으로 기록한다', () => {
  const a = load();
  a.ev(`S.sessions=[];S.session={startedAt:Date.now()-59000,lastCheckAt:Date.now()-59000,status:'RUNNING'};endSession(Date.now(),'LAMP',true)`);
  assert.equal(a.state().sessions.length, 0);
  a.ev(`S.session={startedAt:Date.now()-61000,lastCheckAt:Date.now()-61000,status:'RUNNING'};endSession(Date.now(),'LAMP',true)`);
  assert.deepEqual(a.state().sessions.map(x => x.minutes), [1]);
  fin(a);
});

test('스탠드: 직접 입력은 켠 뒤 지난 시간 안이어야 한다', () => {
  const a = load();
  a.ev(`S.session={startedAt:Date.now()-10*6e4,lastCheckAt:Date.now()-10*6e4,status:'NEEDS_CONFIRM'};openF('lamp');panelView={mode:'cmanual'};renderPanel()`);
  a.doc.getElementById('cm').value = '600';
  a.click('#panel [data-act=confirmManual]');
  assert.match(a.doc.getElementById('cmE').textContent, /지난 시간/);
  assert.ok(a.state().session, '거절되면 세션이 남아야 해요');
  fin(a);
});

test('오늘 읽은 시간: 한국 시간 종료일이 오늘인 세션만 센다', () => {
  const a = load();
  a.ev(`S.sessions=[{startedAt:Date.now()-20*6e4,endedAt:Date.now(),minutes:20,by:'LAMP'},{startedAt:Date.now()-31*36e5,endedAt:Date.now()-30*36e5,minutes:45,by:'LAMP'}]`);
  assert.equal(a.ev('todayMin()'), 20);
  fin(a);
});

test('진행률: 전체 쪽수가 없으면 0, 있으면 퍼센트', () => {
  const a = load();
  assert.equal(a.ev('(()=>{const r={totalPages:null,page:50,progress:50};updProgress(r);return r.progress})()'), 0);
  assert.equal(a.ev('(()=>{const r={totalPages:100,page:50};updProgress(r);return r.progress})()'), 50);
  assert.equal(a.ev('(()=>{const r={totalPages:100,page:150};updProgress(r);return r.progress})()'), 100);
  fin(a);
});

test('책 등록: 전체 쪽수는 빈 값 또는 1~9999 (음수·초대형은 막는다)', () => {
  const cases = [['-10', null], ['0', null], ['', null], ['1e21', 9999], ['99999', 9999], ['320', 320]];
  for (const [input, expected] of cases) {
    const a = load();
    a.ev(`S.reading=null;openF('sofa');panelView={t:'책',a:'저자',tp:'${input}'};renderPanel()`);
    a.click('#panel [data-act=addBook]');
    assert.equal(a.state().reading.totalPages, expected, `입력 "${input}"`);
    fin(a);
  }
});

test('월 목표: 범위를 벗어나면 1~99로 맞추고 빈 값은 이전 값을 유지한다 (이번 달 목표는 S.goals에 달별로 저장)', () => {
  const a = load();
  const goal = () => a.ev('goalFor(curYM()).goal');
  a.ev(`openF('calendar')`);
  a.change('#goal', '0'); assert.equal(goal(), 1);
  a.change('#goal', '500'); assert.equal(goal(), 99);
  assert.equal(a.doc.getElementById('goal').value, '99', '칸 값도 같이 바뀌어야 해요');
  a.change('#goal', ''); assert.equal(goal(), 99);
  fin(a);
});

test('완독일: 연도까지 저장하고, 작년 같은 달 책은 이번 달 완독 수에 세지 않는다', () => {
  const { y, m } = kstToday();
  const a = load();
  a.ev(`S.reading={id:7,title:'신규',author:'a',totalPages:100,page:100,progress:100,notes:[],startedAt:'11.17'};S.session=null;openF('sofa');panelView={mode:'finish',rating:4};renderPanel()`);
  a.click('#panel [data-act=doFinish]');
  const last = a.state().finished.at(-1).finishedAt;
  assert.match(last, /^\d{4}\.\d{1,2}\.\d{2}$/);
  a.ev(`S.finished=[{id:91,title:'a',finishedAt:'${y - 1}.${m}.05',notes:[],rooms:[]},{id:92,title:'b',finishedAt:'${y}.${m}.05',notes:[],rooms:[]}]`);
  assert.equal(a.ev('calData().done'), 1, '작년 같은 달 책을 세면 안 돼요');
  fin(a);
});

test('완독일 이관: 연도 없는 예전 값은 불러올 때 오늘 이전 가장 가까운 날짜로 연도가 붙는다', () => {
  const { y, m, d } = kstToday();
  const s = load().state();
  s.finished = [{ id: 1, title: 'x', finishedAt: '11.01', notes: [], rooms: [] }];
  s.dropped = [{ id: 2, title: 'z', finishedAt: '12.25', notes: [] }];
  const a = load({ state: s });
  const yr = (mo, dd) => ((mo > m || (mo === m && dd > d)) ? y - 1 : y);
  const t = a.state();
  assert.equal(t.finished[0].finishedAt, `${yr(11, 1)}.11.01`);
  assert.equal(t.dropped[0].finishedAt, `${yr(12, 25)}.12.25`);
  fin(a);
});

test('광장 글은 하루가 지나면 불러올 때 지워진다', () => {
  const s = load().state();
  s.plaza = [{ who: '@a', text: '오래됨', ts: Date.now() - 25 * 36e5, mine: false }, { who: '@b', text: '최근', ts: Date.now() - 36e5, mine: false }];
  const a = load({ state: s });
  assert.deepEqual(a.state().plaza.map(p => p.text), ['최근']);
  fin(a);
});

test('저장 실패: 저장소가 막히면 한 번만 알린다', async () => {
  const a = load();
  a.w.Storage.prototype.setItem = () => { throw new Error('quota'); };
  a.ev('save()'); await sleep(20);
  const toast = a.doc.getElementById('toast');
  assert.match(toast.textContent, /저장 공간/);
  toast.textContent = '';
  a.ev('save()'); await sleep(20);
  assert.equal(toast.textContent, '', '연속 실패에는 다시 알리지 않아요');
  fin(a);
});

test('광장 대화: 광장 안에서만 채팅창이 뜨고, 40자로 자르고, 밖에서는 보내지 않고, 글자는 그대로 보인다(HTML 주입 방지)', async () => {
  const a = load();
  a.ev('enterVillage()'); await sleep(350);
  assert.equal(a.ev('VIEW'), 'village');
  const wrap = a.doc.getElementById('stageWrap');
  // 광장 밖: 채팅창이 없다
  a.ev(`Object.assign(sim,{x:2,z:5});syncPlazaChat()`);
  assert.ok(!wrap.classList.contains('pz'), '광장 밖에서는 채팅창이 숨어야 해요');
  // 광장 안: 채팅창이 뜬다
  a.ev(`Object.assign(sim,{x:PLAZA.cx,z:PLAZA.cz});syncPlazaChat()`);   // 광장 한가운데 (광장 위치가 바뀌어도 맞도록 좌표를 직접 쓰지 않는다)
  assert.ok(a.ev('inPlaza(PLAZA.cx,PLAZA.cz)'));
  assert.ok(wrap.classList.contains('pz'), '광장 안에서는 채팅창이 떠야 해요');
  a.doc.getElementById('pz').value = '가'.repeat(60); a.ev('plazaSend()');
  assert.equal(a.state().plaza.at(-1).text.length, 40);
  a.doc.getElementById('pz').value = '<img src=x onerror=alert(1)>'; a.ev('plazaSend()');
  assert.equal(a.doc.querySelector('#pzLog img'), null, '태그가 요소로 만들어지면 안 돼요');
  assert.match(a.doc.getElementById('pzLog').textContent, /<img src=x/);
  // 공백만
  const n = a.state().plaza.length;
  a.doc.getElementById('pz').value = '   '; a.ev('plazaSend()');
  assert.equal(a.state().plaza.length, n);
  // 광장 밖
  a.ev(`Object.assign(sim,{x:2,z:5})`);
  a.doc.getElementById('pz').value = '밖에서'; a.ev('plazaSend()');
  assert.equal(a.state().plaza.length, n, '광장 밖에서는 보내지면 안 돼요');
  assert.match(a.doc.getElementById('pzE').textContent, /걸어가는 중/);
  fin(a);
});

test('공유방 가져오기: 내 책에 없으면 "나중에 읽을 책"에 담고 다 읽은 책으로 세지 않는다', () => {
  const a = load();
  a.ev(`S.news=[${room('c1', '미지의책', '저자', '안녕')},${room('c2', '미지의책', '저자', '또')},${room('c3', '아몬드', '손원평', '좋았어')}];openF('window')`);
  const finished0 = a.state().finished.length;
  for (const id of ['c1', 'c2', 'c3']) a.click(`#panel [data-act=import][data-id=${id}]`);
  const s = a.state();
  assert.deepEqual(s.later.map(b => `${b.title}:${b.rooms.length}`), ['미지의책:2'], '같은 책은 한 항목에 공유방이 쌓여야 해요');
  assert.equal(s.finished.length, finished0, '다 읽은 책이 늘면 안 돼요');
  assert.equal(s.finished.find(b => b.title === '아몬드').rooms.length, 2, '이미 읽은 책에는 공유방 탭이 붙어야 해요 (데모 1개 + 가져온 1개)');
  assert.ok(s.news.every(n => n.done));
  fin(a);
});

test('공유방 스포 안내: 안 읽은 책이면 대화는 전부 보이고 띠에서 "나중에 읽을 책"에 담을 수 있다 (#43)', () => {
  const a = load();
  const mk = (id, book) => `{id:'${id}',kind:'OPEN',title:'방${id}',book:'${book}',author:'저자',rtype:'SAME',agreed:true,people:2,max:8,members:['@가'],owner:'@가',messages:[{id:'m${id}',who:'@가',text:'결말이 놀라워요',page:300,ts:Date.now()}],period:'11.01 ~ 11.08'}`;
  a.ev(`S.news=[${mk('o1', '미지의책')},${mk('o2', '아몬드')}];S.news.forEach(rcNorm)`);
  assert.equal(a.ev(`rcSpoil(S.news[0])`), true, '안 읽은 책은 스포 안내');
  assert.equal(a.ev(`rcSpoil(S.news[1])`), false, '다 읽은 책은 안내가 없어요');
  a.ev(`panelOpen='room:o1';panelView={};renderPanel()`);
  assert.ok(a.ev(`document.querySelector('#panel .rspoil.bar')`), '대화 위에 스포 띠');
  assert.ok(a.ev(`document.getElementById('rcLog').textContent.includes('결말이 놀라워요')`), '쪽수가 앞서도 글은 가려지지 않아요');
  a.click('#panel [data-act=rcLater]');
  assert.deepEqual(a.state().later.map(b => b.title), ['미지의책']);
  assert.ok(a.ev(`document.querySelector('#panel .rspoil.bar').textContent.includes('담았어요')`));
  fin(a);
});

test('나중에 읽을 책: 소파에 올리면 목록에서 빠지고 공유방 기록이 따라와 완독 후 책장에 남는다', () => {
  const a = load();
  a.ev(`S.news=[${room('c1', '미지의책', '저자', '안녕')}];openF('window')`);
  a.click('#panel [data-act=import][data-id=c1]');
  a.ev(`closePanel();openF('sofa');panelView={t:'미지의책',a:'저자',tp:'200'};renderPanel()`);
  a.click('#panel [data-act=addBook]');
  let s = a.state();
  assert.equal(s.later.length, 0);
  assert.equal(s.reading.rooms.length, 1);
  a.ev(`openF('sofa');panelView={mode:'finish',rating:5};renderPanel()`);
  a.click('#panel [data-act=doFinish]');
  s = a.state();
  assert.equal(s.finished.find(b => b.title === '미지의책').rooms.length, 1);
  fin(a);
});

test('창문: 대화 없는 종료 방은 가져오기 버튼이 없다', () => {
  const a = load();
  a.ev(`S.news=[{id:'e1',kind:'CLOSED',title:'빈',book:'책',messages:[],deleteAt:Date.now()+5e8,done:false}];openF('window')`);
  assert.equal(a.doc.querySelector('#panel [data-act=import]'), null);
  assert.match(a.doc.getElementById('panel').textContent, /가져올 대화가 없어요/);
  fin(a);
});

test('거울 셔플: 색은 색 이름이 아니라 색 값(#...)으로 저장된다', () => {
  const a = load();
  a.ev(`openF('mirror')`);
  for (let i = 0; i < 12; i++) { a.click('#panel [data-act=shuffle]'); assert.match(a.ev('tempAvatar.color'), /^#[0-9a-fA-F]{3,8}$/); }
  fin(a);
});

test('키보드: 창을 열면 포커스가 창 제목으로 가고, 닫으면 열었던 버튼으로 돌아온다', () => {
  const a = load();
  const btn = a.doc.querySelector('#srBtns button[data-f=shelf]');
  btn.focus();
  a.ev(`openF('shelf')`);
  assert.equal(a.doc.activeElement.tagName, 'H2');
  assert.ok(a.doc.getElementById('panel').contains(a.doc.activeElement));
  a.ev('closePanel()');
  assert.equal(a.doc.activeElement, btn);
  fin(a);
});

test('동작 줄이기: prefers-reduced-motion 규칙이 애니메이션과 전환을 끈다', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'prototype', 'style.css'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{[^}]*animation:none!important[^}]*transition:none!important/);
});
