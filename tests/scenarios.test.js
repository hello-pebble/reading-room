// 시나리오 테스트: frontend/index.html을 가상 브라우저(jsdom)에 올려 실제 패널·버튼·로직을 돌린다.
// 3D(three.js)는 올리지 않는다. 화면 그림은 못 보지만 기록·규칙·패널 동작은 확인한다.
// 실행: npm test   (npm install 뒤)
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, closeAll, sleep, kstToday, fakeServer } = require('./load');
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

test('이웃집 추천: 읽는 중·완독만 선택하고, 집마다 한 권을 저장하며 확인 후 다시 꽂는다', () => {
  const a = load();
  a.ev(`S.reading={id:99,title:'읽는 중인 책',author:'저자',notes:[],page:10};
    S.dropped=[{id:100,title:'포기한 책'}];S.later=[{id:101,title:'나중 책'}];
    ROOM_L=L;VIEW='village';openV('neighbor:neighbor-0');openNeighbor('shelf')`);
  assert.equal(a.ev('VIEW'), 'neighbor');
  const text = a.doc.getElementById('panel').textContent;
  assert.match(text, /읽는 중인 책/);
  assert.doesNotMatch(text, /포기한 책|나중 책/);
  assert.equal(a.ev("putRecommendation('finished:100')"), false);
  assert.equal(a.ev("putRecommendation('later:101')"), false);
  a.click('#panel [data-act=giftPut][data-key=reading]');
  assert.equal(a.state().recommendations['neighbor-0'].book.title, '읽는 중인 책');
  assert.equal(a.state().reading.title, '읽는 중인 책', '추천해도 내 책은 그대로 남아야 해요');
  assert.equal(a.ev("putRecommendation('finished:1')"), false);
  const restored = load({ state: a.state() });
  restored.ev("ROOM_L=L;VIEW='village';visitNeighbor('neighbor-0');openNeighbor('shelf')");
  assert.equal(restored.doc.querySelector('[data-act=giftPut]'), null);
  restored.ev("neighborAction('giftRead',{dataset:{house:'neighbor-0'}})");
  assert.ok(restored.state().recommendations['neighbor-0'], '방문자는 집 주인 대신 확인 처리할 수 없어요');
  restored.click('[data-act=giftOwner]');
  restored.click('[data-act=giftRead]');
  assert.equal(restored.state().recommendations['neighbor-0'], undefined);
  assert.ok(restored.doc.querySelector('[data-act=giftPut]'));
  assert.equal(restored.ev("putRecommendation('finished:1')"), true);
  restored.ev("leaveNeighbor();visitNeighbor('neighbor-1')");
  assert.equal(restored.ev("putRecommendation('finished:1')"), true, '다른 집에는 별도로 추천할 수 있어요');
  fin(restored);
  fin(a);
});

test('추천받은 책: 내 책장에 표시하고 확인하면 칸을 비우며, 추천할 책이 없으면 빈 안내를 보인다', () => {
  const a = load();
  a.ev(`S.recommendations.me={from:'neighbor-0',book:{title:'추천받은 책',author:'저자'},at:Date.now()};render();openF('shelf')`);
  assert.match(a.doc.getElementById('panel').textContent, /추천받은 책/);
  assert.equal(a.doc.getElementById('giftMark').style.display, 'block');
  a.click('[data-act=giftRead]');
  assert.equal(a.state().recommendations.me, undefined);
  assert.equal(a.doc.getElementById('giftMark').style.display, 'none');
  a.ev("S.finished=[];S.reading=null;closePanel();ROOM_L=L;VIEW='village';visitNeighbor('neighbor-0');openNeighbor('shelf')");
  assert.match(a.doc.getElementById('panel').textContent, /아직 추천할 수 있는 책이 없어요/);
  assert.equal(a.doc.querySelector('[data-act=giftPut]'), null);
  fin(a);
});

test('모닥불 이름: 직접 지은 방 이름이 마을 목록에 책 제목 대신 그대로 보인다', () => {
  const a = load();
  const input = (id, value) => { const el = a.doc.getElementById(id); el.value = value; el.dispatchEvent(new a.w.Event('input', { bubbles: true })); };
  a.ev("VIEW='village';openV('fire:new')");
  a.change('#rbook', 'typed');
  input('rbookt', '읽는 책');
  input('rname', '내가 지은 이름');
  a.click('#panel [data-act=rcreate]');
  assert.ok(a.ev("vilList()").some(r => r.short === '내가 지은 이름'));
  fin(a);
});

test('각자 읽기 방: 부제에 책 제목 대신 "각자 읽기"를, 이름 옆에는 읽는 책을 붙인다', () => {
  const a = load();
  const input = (id, value) => { const el = a.doc.getElementById(id); el.value = value; el.dispatchEvent(new a.w.Event('input', { bubbles: true })); };
  a.ev("VIEW='village';openV('fire:new')");
  a.click('#panel [data-act=rkind][data-v=OWN]');
  a.change('#rbook', 'typed');
  input('rbookt', '데미안');
  input('rname', '책 자랑');
  a.click('#panel [data-act=rcreate]');
  const room = a.state().news.find(n => n.title === '책 자랑');
  assert.equal(a.ev(`rcBookTag(S.news.find(n=>n.id==='${room.id}'),'나')`), ' 『데미안』');
  assert.match(a.ev(`rcBookTag(S.news.find(n=>n.id==='${room.id}'),'나무')`), /^ 『.+』$/);
  a.ev(`S.news.find(n=>n.id==='${room.id}').book='채식주의자 같은 아주 긴 책 제목'`);
  assert.equal(a.ev(`rcBookTag(S.news.find(n=>n.id==='${room.id}'),'나')`), ' 『채식주의자』');
  a.ev(`S.news.find(n=>n.id==='${room.id}').rtype='SAME'`);
  assert.equal(a.ev(`rcBookTag(S.news.find(n=>n.id==='${room.id}'),'나')`), '');
  fin(a);
});

test('분리된 마을·공유방: 개설 입력, 동의, Enter 전송, 장면 나가기와 재입장이 이어진다', () => {
  const a = load();
  const input = (id, value) => {
    const el = a.doc.getElementById(id);
    el.value = value;
    el.dispatchEvent(new a.w.Event('input', { bubbles: true }));
  };
  a.ev("VIEW='village';openV('fire:new')");
  a.change('#rbook', 'typed');
  input('rbookt', '분리 확인 책');
  input('rname', '분리 확인 모닥불');
  input('rmax', '4');
  a.click('#panel [data-act=rcreate]');
  const room = a.state().news.find(n => n.title === '분리 확인 모닥불');
  assert.equal(room.book, '분리 확인 책');
  assert.equal(room.max, 4);
  a.ev(`openV('room:${room.id}')`);
  a.click('#panel [data-act=rcAgree]');
  assert.equal(a.ev('VIEW'), 'shared');
  input('rc', '공유방에 남기는 글');
  a.doc.getElementById('rc').dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(a.state().news.find(n => n.id === room.id).messages.length, 1, '전송 이벤트가 중복 연결되면 안 돼요');
  a.click('#campSide [data-camp=info]');
  assert.ok(a.doc.getElementById('campModal').classList.contains('open'));
  a.click('#campModalPanel [data-act=cmClose]');
  assert.equal(a.ev('VIEW'), 'shared');
  a.click('#campExit');
  a.click('#panel [data-act=campLeave]');
  assert.equal(a.ev('VIEW'), 'village');
  const restored = load({ state: a.state() });
  restored.ev(`VIEW='village';openV('room:${room.id}')`);
  assert.equal(restored.ev('VIEW'), 'shared');
  assert.match(restored.doc.getElementById('rcLog').textContent, /공유방에 남기는 글/);
  fin(restored);
  fin(a);
});

test('분리된 내 방: 입력 이벤트로 책·메모를 저장하고 다시 열어도 유지된다', () => {
  const a = load();
  const input = (id, value) => {
    const el = a.doc.getElementById(id);
    el.value = value;
    el.dispatchEvent(new a.w.Event('input', { bubbles: true }));
  };
  a.ev("openF('sofa')");
  input('bt', '분리 확인용 책');
  input('ba', '테스트 저자');
  input('btp', '240');
  a.click('#panel [data-act=addBook]');
  input('nc', '다시 열어도 남는 메모');
  a.click('#panel [data-act=addNote]');
  a.ev("openF('lamp')");
  a.click('#panel [data-act=startTimer]');
  assert.equal(a.state().session.status, 'RUNNING');
  const restored = load({ state: a.state() });
  restored.ev("openF('sofa')");
  assert.match(restored.doc.getElementById('panel').textContent, /다시 열어도 남는 메모/);
  assert.equal(restored.state().reading.totalPages, 240);
  restored.ev("VIEW='village';openV('board')");
  assert.ok(restored.doc.querySelector('#panel [data-act=newRoom]'), '내 방 버튼 처리가 마을 버튼을 가로채면 안 돼요');
  restored.click('#panel [data-act=newRoom]');
  assert.equal(restored.ev('panelOpen'), 'fire:new');
  fin(restored);
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

test('마을 모닥불 자리: 열린 방 → 곧 열릴 방 순서이고, 종료된 방은 마을에 모닥불이 없다', () => {
  const a = load();
  a.ev(`S.news=[${room('k1', 'a', 'x', '.')},{id:'s1',kind:'SOON',title:'s',opensAt:Date.now()+1e6},{id:'o1',kind:'OPEN',title:'o'},${room('k2', 'b', 'x', '.')}]`);
  assert.equal(a.ev(`vilOrder().map(n=>n.kind).join(',')`), 'OPEN,SOON');
  fin(a);
});

test('모닥불 시간: 1~7시간 진행 시간으로 만들고, 하루 3번까지만 피운다', () => {
  const a = load();
  const make = h => { a.ev("VIEW='village';openV('fire:new')"); a.click('#panel [data-act=rkind][data-v=OWN]'); a.click(`#panel [data-act=rhours][data-v="${h}"]`); a.click('#panel [data-act=rcreate]'); };
  make(5);
  const r = a.state().news.find(n => n.mine);
  assert.equal(Math.round((r.closesAt - r.opensAt) / 36e5), 5);
  a.ev("S.news.forEach(n=>{if(n.mine)n.kind='CLOSED'})");   // 동시 2개 제한에 걸리지 않게 종료로 돌린다
  make(1); make(2);
  assert.equal(a.state().roomLog.length, 3);
  a.ev("S.news.forEach(n=>{if(n.mine)n.kind='CLOSED'})");
  make(3);
  assert.equal(a.state().roomLog.length, 3, '하루 3번이 넘으면 만들어지지 않는다');
  assert.match(a.doc.getElementById('rerr').textContent, /하루에 3번/);
  fin(a);
});

test('모닥불 시간: 장면에 머문 시간이 오늘 읽은 시간에 더해지고, 시간이 다 되면 광장으로 돌아온다', () => {
  const a = load();
  a.ev(`S.news=[{id:'c1',kind:'OPEN',title:'방',book:'책',author:'저자',rtype:'OWN',agreed:true,people:1,max:8,mine:true,opensAt:Date.now()-36e5,closesAt:Date.now()+36e5,members:[],messages:[]}];
        VIEW='village';enterCamp(S.news[0]);campSince=Date.now()-30*60000;`);
  assert.equal(a.ev('VIEW'), 'shared');
  a.ev('leaveCamp()');
  assert.equal(a.ev('todayMin()'), 30);
  a.ev('S.sessions.forEach(x=>{x.startedAt-=4e6;x.endedAt-=4e6})');   // 처음 기록과 겹치지 않게 뒤로 민다
  const base = a.ev('todayMin()');
  a.ev(`enterCamp(S.news[0]);campSince=Date.now()-10*60000-1000;S.news[0].closesAt=Date.now()-1;fireSharedRoomsDue()`);
  assert.equal(a.ev('VIEW'), 'village');
  assert.equal(a.state().news[0].kind, 'CLOSED');
  assert.equal(a.ev('todayMin()') - base, 10);
  fin(a);
});

test('공유방 입력: 폰(터치)에서는 Enter가 줄바꿈이라 보내지 않는다', () => {
  const a = load({ touch: true });
  a.ev(`S.news=[{id:'t1',kind:'OPEN',title:'방',book:'책',author:'저자',rtype:'OWN',agreed:true,people:1,max:8,mine:true,members:[],messages:[]}];VIEW='village';openV('room:t1')`);
  const rc = a.doc.getElementById('rc');
  rc.value = '첫 줄';
  rc.dispatchEvent(new a.w.Event('input', { bubbles: true }));
  const ev = new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  rc.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, false);
  assert.equal(a.state().news[0].messages.length, 0);
  fin(a);
});

test('책 검색: ISBN-10은 13자리로 바꾸고 틀린 ISBN은 걸러 낸다', async () => {
  const a = load();
  assert.equal(a.ev(`toIsbn13('8936434128')`), '9788936434120');
  assert.equal(a.ev(`toIsbn13('978-89-364-3412-0')`), '9788936434120');
  assert.equal(a.ev(`toIsbn13('9788936434121')`), '');
  assert.equal(a.ev(`toIsbn13('123')`), '');
  assert.equal(a.ev(`toIsbn13('1234567890')`), '', 'ISBN-10 검사 숫자가 틀리면 거른다');
  const r = await a.ev(`searchBooks('9788936434121')`);
  assert.match(r.err, /ISBN이 올바르지 않아요/);
  fin(a);
});

test('모닥불 인원: 최대 10명까지만 정할 수 있다', () => {
  const a = load();
  const input = (id, value) => { const el = a.doc.getElementById(id); el.value = value; el.dispatchEvent(new a.w.Event('input', { bubbles: true })); };
  a.ev("VIEW='village';openV('fire:new')");
  a.click('#panel [data-act=rkind][data-v=OWN]');
  input('rmax', '11');
  a.click('#panel [data-act=rcreate]');
  assert.match(a.doc.getElementById('rerr').textContent, /2~10명/);
  input('rmax', '10');
  a.click('#panel [data-act=rcreate]');
  assert.equal(a.state().news.filter(n => n.mine).length, 1);
  fin(a);
});

test('공유방 글: 보낸 글은 삭제도 수정도 할 수 없다', () => {
  const a = load();
  a.ev(`S.news=[{id:'d1',kind:'OPEN',title:'방',book:'책',author:'저자',rtype:'OWN',agreed:true,people:1,max:8,mine:true,members:[],messages:[{id:'m1',who:'나',text:'안녕',ts:Date.now()}]}];VIEW='village';openV('room:d1')`);
  assert.equal(a.doc.querySelector('[data-act=rcDelAsk]'), null);
  assert.equal(a.doc.querySelector('.rm-x'), null);
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

test('채팅 도배 방지: 3초에 3건까지, 같은 글은 30초 안에 연속 금지, 광장과 공유방은 따로 센다 (결정 #61)', () => {
  const a = load();
  const gate = (k, t, at) => a.ev(`chatGate(${JSON.stringify(k)},${JSON.stringify(t)},${at})`);
  const mark = (k, t, at) => a.ev(`chatMark(${JSON.stringify(k)},${JSON.stringify(t)},${at})`);
  const T = 1_000_000;
  for (const [i, t] of ['하나', '둘', '셋'].entries()) { assert.equal(gate('room', t, T + i * 1000), ''); mark('room', t, T + i * 1000); }
  assert.equal(gate('room', '넷', T + 2999), '조금 뒤에 보내 주세요', '3초 안에 3건이 찼으면 4번째는 막는다');
  assert.equal(gate('plaza', '넷', T + 2999), '', '광장은 따로 센다');
  assert.equal(gate('room', '넷', T + 3000), '', '첫 글이 3초 밖으로 나가면 한 자리가 난다');
  // 빠르고 짧게 치는 사람(1.1초마다 한 줄)은 막지 않는다
  for (let i = 0; i < 12; i++) { const at = T + 100_000 + i * 1100; assert.equal(gate('plaza', '짧은 글 ' + i, at), ''); mark('plaza', '짧은 글 ' + i, at); }
  // 같은 글: 직전 글과 같고 30초 안이면 막는다 (앞뒤 공백 무시), 직전 글이 아니면 된다
  mark('room', 'ㅋㅋ', T + 200_000);
  assert.equal(gate('room', ' ㅋㅋ ', T + 204_000), '같은 말을 연달아 보낼 수 없어요');
  assert.equal(gate('room', 'ㅋㅋㅋ', T + 204_000), '');
  assert.equal(gate('room', 'ㅋㅋ', T + 229_999), '같은 말을 연달아 보낼 수 없어요');
  assert.equal(gate('room', 'ㅋㅋ', T + 230_000), '', '정확히 30초가 지나면 된다');
  fin(a);
});

test('채팅 도배 방지: 시각을 안 주면 지금 시각으로 센다', () => {
  const a = load();
  a.ev(`chatMark('room','안녕',Date.now())`);
  assert.equal(a.ev(`chatGate('room','안녕')`), '같은 말을 연달아 보낼 수 없어요');
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

test('모닥불 장면 대화창: 대화만 있고 탭이 없으며 책 제목을 반복하지 않는다. 참여자·방 정보는 대화창과 별도 모달로 연다', () => {
  const a = load();
  a.ev(`S.news=[{id:'o1',kind:'OPEN',title:'『미지의책』 같이 읽기',book:'미지의책',author:'저자',rtype:'SAME',agreed:true,people:2,max:8,members:['@가'],owner:'@가',messages:[{id:'m1',who:'@가',text:'안녕하세요',page:null,ts:Date.now()}],period:'11.01 ~ 11.08'}];S.news.forEach(rcNorm);VIEW='shared';CAMP_ID='o1';panelOpen='room:o1';panelView={};renderPanel()`);
  const panel = () => a.ev(`document.querySelector('#panel').textContent`), modal = () => a.ev(`document.querySelector('#campModalPanel').textContent`);
  const isOpen = () => a.ev(`document.querySelector('#campModal').classList.contains('open')`);
  assert.equal(a.ev(`!!document.querySelector('#panel .rtabs')`), false, '장면의 대화창에는 탭이 없어야 해요');
  assert.equal(a.ev(`document.querySelector('#panel .panel-head h2').textContent`), '대화');
  assert.ok(panel().split('미지의책').length - 1 <= 1, '대화창에 책 제목이 반복되면 안 돼요');
  assert.equal(isOpen(), false, '처음에는 모달이 닫혀 있어요');
  a.ev(`panelView.sheet='members';renderPanel()`);
  assert.equal(isOpen(), true);
  assert.equal(a.ev(`document.querySelector('#campModalPanel .panel-head h2').textContent`), '참여자');
  assert.ok(a.ev(`!!document.querySelector('#campModalPanel .cm-body .rgrid .rmem')`), '참여자는 바둑판으로 보여요');
  assert.ok(a.ev(`!!document.getElementById('rcLog')`) && a.ev(`document.querySelector('#panel .panel-head h2').textContent`) === '대화', '모달이 떠도 대화창은 그대로예요');
  a.ev(`panelView.sheet='info';renderPanel()`);
  assert.equal(a.ev(`document.querySelector('#campModalPanel .panel-head h2').textContent`), '방 정보');
  assert.ok(!modal().includes('미지의책'), '방 정보에도 같은 책 방은 책 제목을 다시 쓰지 않아요');
  assert.equal(a.ev(`!!document.querySelector('#campModalPanel [data-act=rcLeaveAsk]')`), false, '방 정보에는 방 나가기 버튼이 없어요');
  a.click('#campModalPanel [data-act=cmClose]');
  assert.equal(isOpen(), false, '모달의 ✕는 모달만 닫아요');
  assert.equal(a.ev(`VIEW`), 'shared', '모달을 닫아도 모닥불 장면에 그대로 있어요');
  fin(a);
});

test('공유방 입력줄: 안 읽은 책이고 내 쪽수가 없으면 쪽수 칸이 없고, 소파에서 읽는 중이면 쪽수 칸이 있다', () => {
  const a = load();
  a.ev(`S.news=[{id:'o1',kind:'OPEN',title:'『미지의책』 같이 읽기',book:'미지의책',author:'저자',rtype:'SAME',agreed:true,people:2,max:8,members:['@가'],owner:'@가',messages:[],period:'11.01 ~ 11.08'}];S.news.forEach(rcNorm);panelOpen='room:o1';panelView={};renderPanel()`);
  assert.equal(a.ev(`!!document.querySelector('#panel [data-act=rcChip]')`), false, '안 읽은 책이고 쪽수가 없으면 쪽수 칸이 없어야 해요');
  assert.ok(a.ev(`!!document.querySelector('#panel #rc')`), '입력칸은 그대로 있어요');
  a.ev(`S.reading={id:1,title:'미지의책',author:'저자',cover:'',isbn:'',totalPages:300,page:50,progress:17,notes:[],startedAt:'2026.11.01'};renderPanel()`);
  assert.ok(a.ev(`document.querySelector('#panel [data-act=rcChip]')?.textContent.includes('50쪽')`), '소파에서 읽는 중이면 내 쪽수가 칸에 보여요');
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
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'frontend', 'css', 'common.css'), 'utf8');
  // 공백·줄바꿈이 있어도 같은 규칙이다 (코드 모양을 정리한 뒤에도 깨지지 않게)
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*animation:\s*none\s*!important[^}]*transition:\s*none\s*!important/,
  );
});

// ---- 서버 연결 1단계 (주소 끝 ?api=): 로그인·닉네임·내 정보. 서버는 fakeServer()로 흉내 낸다 ----
const settle = () => sleep(40); // 화면의 비동기 서버 호출이 끝나길 기다린다
const val = (a, id, v) => (a.ev(`document.getElementById('${id}').value=${JSON.stringify(v)}`), 0);
const text = (a, id) => a.doc.getElementById(id).textContent;
const TOKEN = 'myroom-token';

test('서버 연결: ?api가 없으면 서버를 부르지 않고 프로토타입 그대로 동작한다', async () => {
  const a = load();
  await settle();
  assert.equal(a.ev('API.enabled'), false);
  assert.equal(a.ev('panelOpen'), null);
  assert.equal(a.doc.getElementById('nickBtn').hidden, true);
  assert.equal(a.doc.getElementById('logoutBtn').hidden, true);
  assert.match(text(a, 'hdrStats'), /^@pebble · 읽은 책/, '프로토타입은 핸들 표시 그대로');
  fin(a);
});

test('서버 연결: 토큰이 없으면 로그인 창이 뜨고, 새 계정은 닉네임 정하기로 이어진다', async () => {
  const srv = fakeServer();
  const a = load({ api: srv });
  await settle();
  assert.equal(a.ev('API.enabled'), true);
  assert.equal(a.ev('panelOpen'), 'login');
  assert.deepEqual(srv.calls, [], '로그인 전에는 서버를 부르지 않아요');
  val(a, 'loginLabel', 'alice');
  a.click('#panel [data-act=login]');
  await settle();
  assert.deepEqual(srv.calls.map((c) => c.path), ['/dev/login']);
  assert.equal(srv.calls[0].auth, undefined, '로그인 요청에는 토큰이 없어요');
  assert.ok(a.w.localStorage.getItem(TOKEN), '토큰이 저장돼요');
  assert.equal(a.ev('panelOpen'), 'nickname', '새 계정이라 닉네임부터 정해요');
  assert.match(text(a, 'panel'), /한글·영문·숫자 1~5자/);
  fin(a);
});

test('닉네임 정하기: 규칙에 안 맞으면 서버 문구를 보여 주고 열려 있으며, 맞으면 헤더가 바뀌고 닫힌다', async () => {
  const srv = fakeServer();
  const b = load({ api: srv, local: { [TOKEN]: srv.seed('alice') } }); // 닉네임을 아직 안 정한 계정
  await settle();
  assert.equal(b.ev('panelOpen'), 'nickname');
  for (const bad of ['😀', '여섯글자이름이', 'a b', '나무!']) {
    val(b, 'nickInput', bad);
    b.click('#panel [data-act=saveNick]');
    await settle();
    assert.equal(b.ev('panelOpen'), 'nickname', bad + ': 닫히면 안 돼요');
    assert.match(text(b, 'acctErr'), /한글·영문·숫자로 1~5자예요/, '서버가 준 문구를 그대로 보여요');
  }
  assert.equal(srv.users.alice.nickname, '손님', '거절된 값은 저장되지 않아요');
  val(b, 'nickInput', '나무');
  b.click('#panel [data-act=saveNick]');
  await settle();
  assert.equal(b.ev('panelOpen'), null);
  assert.equal(srv.users.alice.nickname, '나무');
  assert.match(srv.calls.at(-1).auth, /^Bearer tok-/, '닉네임 저장에는 Bearer 토큰을 보내요');
  assert.equal(b.ev('S.user.nickname'), '나무');
  assert.equal(text(b, 'hdrName'), '나무의 방');
  assert.doesNotMatch(text(b, 'hdrStats'), /undefined|@/, '서버 모드의 헤더에는 핸들이 없어요');
  assert.equal(b.doc.getElementById('nickBtn').hidden, false);
  assert.equal(b.doc.getElementById('logoutBtn').hidden, false);
  fin(b);
});

test('로그인 창과 닉네임 정하기는 바깥 클릭·Esc로 닫히지 않는다', async () => {
  const srv = fakeServer();
  const a = load({ api: srv });
  await settle();
  const esc = () => a.w.document.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape' }));
  esc();
  a.click('#backdrop');
  assert.equal(a.ev('panelOpen'), 'login');
  assert.equal(a.doc.querySelector('#panel [data-act=close]'), null, '닫기 버튼도 없어요');
  val(a, 'loginLabel', 'bob');
  a.w.document.getElementById('loginLabel').dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await settle();
  assert.equal(a.ev('panelOpen'), 'nickname', 'Enter로도 로그인돼요');
  esc();
  a.click('#backdrop');
  assert.equal(a.ev('panelOpen'), 'nickname');
  assert.equal(a.doc.querySelector('#panel [data-act=close]'), null);
  fin(a);
});

test('재방문: 저장된 토큰으로 바로 들어가고, 닉네임이 있으면 창이 뜨지 않는다', async () => {
  const srv = fakeServer();
  const token = srv.seed('alice', '나무');
  const a = load({ api: srv, local: { [TOKEN]: token } });
  await settle();
  assert.deepEqual(srv.calls.map((c) => c.path), ['/me']);
  assert.equal(a.ev('panelOpen'), null);
  assert.equal(text(a, 'hdrName'), '나무의 방');
  assert.equal(a.ev('S.user.publicId'), srv.users.alice.publicId);
  assert.equal(a.doc.getElementById('logoutBtn').hidden, false);
  fin(a);
});

test('토큰이 만료·무효면 토큰을 지우고 로그인 창으로 돌아간다', async () => {
  const srv = fakeServer();
  const a = load({ api: srv, local: { [TOKEN]: 'tok-없는토큰' } });
  await settle();
  assert.equal(a.ev('panelOpen'), 'login');
  assert.equal(a.w.localStorage.getItem(TOKEN), null);
  assert.match(text(a, 'acctErr'), /다시 로그인/);
  assert.equal(a.doc.getElementById('logoutBtn').hidden, true);
  fin(a);
});

test('닉네임 바꾸기: 헤더 버튼으로 다시 열고(닫을 수 있다) 바꾸면 헤더에 바로 보인다', async () => {
  const srv = fakeServer();
  const a = load({ api: srv, local: { [TOKEN]: srv.seed('alice', '나무') } });
  await settle();
  a.click('#nickBtn');
  assert.equal(a.ev('panelOpen'), 'nickname');
  assert.equal(a.doc.getElementById('nickInput').value, '나무', '지금 닉네임이 들어 있어요');
  a.click('#panel [data-act=close]');
  assert.equal(a.ev('panelOpen'), null, '이미 정한 뒤에는 닫을 수 있어요');
  a.click('#nickBtn');
  val(a, 'nickInput', '벚꽃');
  a.click('#panel [data-act=saveNick]');
  await settle();
  assert.equal(srv.users.alice.nickname, '벚꽃');
  assert.equal(text(a, 'hdrName'), '벚꽃의 방');
  fin(a);
});

test('로그아웃: 서버에 알리고 토큰을 지운 뒤 로그인 창으로 돌아간다', async () => {
  const srv = fakeServer();
  const token = srv.seed('alice', '나무');
  const a = load({ api: srv, local: { [TOKEN]: token } });
  await settle();
  a.click('#logoutBtn');
  await settle();
  assert.deepEqual(srv.calls.map((c) => c.path), ['/me', '/auth/logout']);
  assert.equal(srv.tokens[token], undefined, '서버의 토큰도 사라져요');
  assert.equal(a.w.localStorage.getItem(TOKEN), null);
  assert.equal(a.ev('panelOpen'), 'login');
  assert.equal(a.doc.getElementById('nickBtn').hidden, true);
  fin(a);
});

test('서버에 닿지 않으면 로그인 창에 안내가 나온다', async () => {
  const srv = fakeServer();
  srv.down = true;
  const a = load({ api: srv });
  await settle();
  val(a, 'loginLabel', 'alice');
  a.click('#panel [data-act=login]');
  await settle();
  assert.equal(a.ev('panelOpen'), 'login');
  assert.match(text(a, 'acctErr'), /서버에 연결할 수 없어요/);
  srv.down = false;
  a.click('#panel [data-act=login]');
  await settle();
  assert.equal(a.ev('panelOpen'), 'nickname', '다시 누르면 이어져요');
  fin(a);
});
