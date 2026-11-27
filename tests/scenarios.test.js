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

test('책 제목 뒤 을/를: 마지막 글자의 받침을 따른다', () => {
  const a = load();
  const t = (s) => a.ev(`eulReul(${JSON.stringify(s)})`);
  assert.equal(t('채식주의자'), '를');
  assert.equal(t('소년이 온다'), '를');
  assert.equal(t('데미안'), '을');
  assert.equal(t('어린 왕자 (개정판)'), '을');
  assert.equal(t('1984'), '를');
  assert.equal(t('2023'), '을');
  assert.equal(t('Dune'), '을(를)');
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

// ---- 마을 키보드 이동 (결정 #99): 방향키·WASD. 화면이 비스듬히 내려다보므로 화면 위 = 마을 좌표 (-x,-z) 쪽 ----
const key = (a, type, code, target) => (target || a.doc).dispatchEvent(new a.w.KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
const vilAt = async (a) => {
  a.ev('enterVillage()');
  await sleep(350);
  a.ev('Object.assign(sim, { x: 10, z: 12, mode: "idle", after: null })');
};
const pos = (a) => JSON.parse(a.ev('JSON.stringify([sim.x, sim.z])'));

test('키보드 이동: 마을에서 방향키·WASD를 누르는 동안 화면 방향으로 걷고, 떼면 멈추며, 대각선도 같은 속도다', async () => {
  const a = load();
  await vilAt(a);
  key(a, 'keydown', 'ArrowUp');
  a.ev('stepSim(0.5)');
  let [x, z] = pos(a);
  assert.ok(x < 10 && z < 12 && Math.abs(10 - x - (12 - z)) < 1e-6, '화면 위로 = 마을 (-x,-z) 쪽');
  const straight = Math.hypot(10 - x, 12 - z);
  assert.ok(Math.abs(straight - 4.6 * 0.5) < 1e-6, '마을 걷기 속도 그대로');
  key(a, 'keyup', 'ArrowUp');
  a.ev('stepSim(0.5)');
  assert.deepEqual(pos(a), [x, z], '떼면 멈춘다');
  // 대각선(위+오른쪽 = W+D)도 같은 속도
  a.ev('Object.assign(sim, { x: 10, z: 12 })');
  key(a, 'keydown', 'KeyW');
  key(a, 'keydown', 'KeyD');
  a.ev('stepSim(0.5)');
  [x, z] = pos(a);
  assert.ok(Math.abs(Math.hypot(x - 10, z - 12) - straight) < 1e-6, '대각선이 더 빠르지 않다');
  assert.ok(z < 12 && Math.abs(x - 10) < 1e-6, '위+오른쪽 = 마을 -z 쪽');
  key(a, 'keyup', 'KeyW');
  key(a, 'keyup', 'KeyD');
  fin(a);
});

test('키보드 이동: 입력칸·한글 조합 중·창이 열린 동안에는 움직이지 않고, 창을 벗어나면 눌린 키를 잊는다', async () => {
  const a = load();
  await vilAt(a);
  const still = (why) => {
    a.ev('stepSim(0.5)');
    assert.deepEqual(pos(a), [10, 12], why);
  };
  const pz = a.doc.getElementById('pz'); // 마을 어디서나 떠 있는 채팅 입력칸 (결정 #94)
  pz.focus();
  key(a, 'keydown', 'KeyW', pz);
  still('채팅에 w를 쳐도 걷지 않는다');
  key(a, 'keyup', 'KeyW', pz);
  pz.blur();
  a.doc.dispatchEvent(new a.w.KeyboardEvent('keydown', { code: 'KeyA', key: 'ㅁ', isComposing: true, bubbles: true }));
  still('한글 조합 중');
  key(a, 'keyup', 'KeyA');
  a.ev(`openV('board'); Object.assign(sim, { x: 10, z: 12, mode: 'idle', after: null })`); // 게시판을 열면 게시판 앞으로 걸어가므로 멈춰 두고 키만 본다
  key(a, 'keydown', 'ArrowLeft');
  still('창이 열린 동안');
  key(a, 'keyup', 'ArrowLeft');
  a.ev('closePanel()');
  key(a, 'keydown', 'ArrowDown');
  a.w.dispatchEvent(new a.w.Event('blur'));
  still('창을 벗어나면 눌린 키를 잊는다 (keyup을 못 받아도 혼자 걷지 않는다)');
  key(a, 'keyup', 'ArrowDown');
  key(a, 'keydown', 'ArrowDown');
  a.ev(`openV('board'); Object.assign(sim, { x: 10, z: 12, mode: 'idle', after: null })`);
  still('걷던 중에 창이 열리면 멈춘다');
  a.ev('closePanel()');
  still('창을 닫은 뒤에는 키를 새로 눌러야 걷는다');
  key(a, 'keyup', 'ArrowDown');
  fin(a);
});

test('키보드 이동: 글을 보낸 뒤 비어 있는 채팅 입력칸에서는 방향키로 걷고(글이 있으면 안 걷는다), Esc로 입력칸을 빠져나오면 WASD도 된다 (결정 #100)', async () => {
  const a = load();
  await vilAt(a);
  const pz = a.doc.getElementById('pz');
  pz.focus();
  pz.value = '안녕';
  key(a, 'keydown', 'ArrowUp', pz);
  a.ev('stepSim(0.5)');
  key(a, 'keyup', 'ArrowUp', pz);
  assert.deepEqual(pos(a), [10, 12], '쓰던 글이 있으면 방향키는 글자 사이를 옮기는 데 쓴다');
  pz.value = '';
  key(a, 'keydown', 'ArrowUp', pz);
  a.ev('stepSim(0.5)');
  key(a, 'keyup', 'ArrowUp', pz);
  assert.notDeepEqual(pos(a), [10, 12], '비어 있으면 방향키로 걷는다 (보낸 뒤 커서가 남아 있어도)');
  a.ev('Object.assign(sim, { x: 10, z: 12 })');
  key(a, 'keydown', 'KeyW', pz);
  a.ev('stepSim(0.5)');
  key(a, 'keyup', 'KeyW', pz);
  assert.deepEqual(pos(a), [10, 12], 'WASD는 입력칸에서는 글자다');
  pz.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  assert.notEqual(a.doc.activeElement, pz, 'Esc로 입력칸을 빠져나온다');
  key(a, 'keydown', 'KeyW');
  a.ev('stepSim(0.5)');
  key(a, 'keyup', 'KeyW');
  assert.notDeepEqual(pos(a), [10, 12], '빠져나오면 WASD로 걷는다');
  fin(a);
});

test('키보드 이동: 클릭으로 가던 중 키를 누르면 그 이동과 도착 동작을 취소하고, 마을 경계를 넘지 않는다', async () => {
  const a = load();
  await vilAt(a);
  a.ev('window.ARRIVED = 0; walkTo(20, 20, () => { window.ARRIVED++; })');
  key(a, 'keydown', 'ArrowRight');
  a.ev('stepSim(0.3)');
  key(a, 'keyup', 'ArrowRight');
  for (let i = 0; i < 40; i++) a.ev('stepSim(0.1)');
  assert.notEqual(a.ev('sim.mode'), 'walk', '클릭 이동은 취소된다');
  assert.equal(a.ev('window.ARRIVED'), 0, '취소된 이동의 도착 동작(집·게시판 열기)은 실행되지 않는다');
  // 경계: 오래 눌러도 클릭 이동과 같은 경계 안
  key(a, 'keydown', 'ArrowUp');
  for (let i = 0; i < 100; i++) a.ev('stepSim(0.1)');
  key(a, 'keyup', 'ArrowUp');
  const [x, z] = pos(a);
  assert.ok(x >= a.ev('L.minX || 1.1') - 1e-9 && z >= a.ev('L.minZ || 0.8') - 1e-9, '마을 밖으로 나가지 않는다');
  // 다시 클릭하면 클릭 이동으로
  a.ev('walkTo(10, 12)');
  assert.equal(a.ev('sim.mode'), 'walk');
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

test('마을 대화: 마을 어디서나 채팅창이 뜨고 보낼 수 있으며(결정 #94), 300자로 자르고(결정 #93), 마을을 떠나면 숨고, 글자는 그대로 보인다(HTML 주입 방지)', async () => {
  const a = load();
  a.ev('enterVillage()'); await sleep(350);
  assert.equal(a.ev('VIEW'), 'village');
  const wrap = a.doc.getElementById('stageWrap');
  // 광장 밖이어도 마을 안이면 채팅창이 뜬다 (결정 #94)
  a.ev(`Object.assign(sim,{x:2,z:5});syncPlazaChat()`);
  assert.ok(!a.ev('inPlaza(2,5)'));
  assert.ok(wrap.classList.contains('pz'), '마을 어디서나 채팅창이 떠야 해요');
  a.doc.getElementById('pz').value = '가'.repeat(310); a.ev('plazaSend()');
  assert.equal(a.state().plaza.at(-1).text.length, 300);
  assert.equal(a.doc.getElementById('pz').maxLength, 300);
  a.doc.getElementById('pz').value = '<img src=x onerror=alert(1)>'; a.ev('plazaSend()');
  assert.equal(a.doc.querySelector('#pzLog img'), null, '태그가 요소로 만들어지면 안 돼요');
  assert.match(a.doc.getElementById('pzLog').textContent, /<img src=x/);
  // 공백만
  const n = a.state().plaza.length;
  a.doc.getElementById('pz').value = '   '; a.ev('plazaSend()');
  assert.equal(a.state().plaza.length, n);
  // 광장 밖에서도 보낸다
  a.doc.getElementById('pz').value = '밖에서'; a.ev('plazaSend()');
  assert.equal(a.state().plaza.at(-1).text, '밖에서', '광장 밖에서도 보낼 수 있어요');
  // 마을을 떠나면 숨는다
  a.ev("VIEW = 'room'; syncPlazaChat()");
  assert.ok(!wrap.classList.contains('pz'), '마을 밖에서는 채팅창이 숨어야 해요');
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

test('서버 연결 첫 화면: 체험판 예시(조약돌·예시 책·예시 공유방) 없이 빈 내 방으로 시작한다 (결정 #96)', async () => {
  const srv = fakeServer();
  srv.down = true; // 서버 응답이 오기 전(또는 닿지 않을 때) 보이는 화면
  const a = load({ api: srv });
  assert.equal(text(a, 'hdrName'), '내 방');
  assert.doesNotMatch(a.doc.querySelector('header, .hdr, #hdrName').parentElement.textContent, /조약돌|@pebble/, '머리말에 예시 이름이 없다');
  const s = a.state();
  assert.equal(s.user.nickname, '');
  assert.equal(s.finished.length, 0, '예시 완독 책이 없다');
  assert.equal(s.news.length, 0, '예시 공유방이 없다');
  assert.equal(s.streak, 0);
  await settle(); // 서버에 닿지 않아 뜨는 안내까지 끝난 뒤 닫는다
  fin(a);
});

test('서버 연결: 토큰이 없으면 로그인 창이 뜨고, 새 계정은 닉네임 정하기로 이어진다', async () => {
  const srv = fakeServer();
  const a = load({ dev: true, api: srv });
  await settle();
  assert.equal(a.ev('API.enabled'), true);
  assert.equal(a.ev('panelOpen'), 'login');
  assert.deepEqual(srv.calls, [], '로그인 전에는 서버를 부르지 않아요');
  val(a, 'loginLabel', 'alice');
  a.click('#panel [data-act=login]');
  await settle();
  assert.equal(srv.calls[0].path, '/dev/login', '처음 부르는 곳은 로그인이에요(이어서 책을 불러와요)');
  assert.equal(srv.calls[0].auth, undefined, '로그인 요청에는 토큰이 없어요');
  assert.ok(a.w.localStorage.getItem(TOKEN), '토큰이 저장돼요');
  assert.equal(a.ev('panelOpen'), 'nickname', '새 계정이라 닉네임부터 정해요');
  assert.match(text(a, 'panel'), /한글·영문·숫자 1~5자/);
  fin(a);
});

test('닉네임 정하기: 규칙에 안 맞으면 서버 문구를 보여 주고 열려 있으며, 맞으면 헤더가 바뀌고 닫힌다', async () => {
  const srv = fakeServer();
  const b = load({ dev: true, api: srv, local: { [TOKEN]: srv.seed('alice') } }); // 닉네임을 아직 안 정한 계정
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
  const a = load({ dev: true, api: srv });
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
  const a = load({ dev: true, api: srv, local: { [TOKEN]: token } });
  await settle();
  assert.equal(srv.calls[0].path, '/me', '내 정보를 먼저 불러와요(이어서 책을 불러와요)');
  assert.equal(a.ev('panelOpen'), null);
  assert.equal(text(a, 'hdrName'), '나무의 방');
  assert.equal(a.ev('S.user.publicId'), srv.users.alice.publicId);
  assert.equal(a.doc.getElementById('logoutBtn').hidden, false);
  fin(a);
});

test('토큰이 만료·무효면 토큰을 지우고 로그인 창으로 돌아간다', async () => {
  const srv = fakeServer();
  const a = load({ dev: true, api: srv, local: { [TOKEN]: 'tok-없는토큰' } });
  await settle();
  assert.equal(a.ev('panelOpen'), 'login');
  assert.equal(a.w.localStorage.getItem(TOKEN), null);
  assert.match(text(a, 'acctErr'), /다시 로그인/);
  assert.equal(a.doc.getElementById('logoutBtn').hidden, true);
  fin(a);
});

test('닉네임 바꾸기: 헤더 버튼으로 다시 열고(닫을 수 있다) 바꾸면 헤더에 바로 보인다', async () => {
  const srv = fakeServer();
  const a = load({ dev: true, api: srv, local: { [TOKEN]: srv.seed('alice', '나무') } });
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
  const a = load({ dev: true, api: srv, local: { [TOKEN]: token } });
  await settle();
  a.click('#logoutBtn');
  await settle();
  assert.deepEqual(srv.calls.map((c) => c.path).filter((p) => !/^\/(books|sessions|me\/reading-time|me\/calendar|me\/recommendation|plaza|rooms)/.test(p)), ['/me', '/auth/logout']);
  assert.equal(srv.tokens[token], undefined, '서버의 토큰도 사라져요');
  assert.equal(a.w.localStorage.getItem(TOKEN), null);
  assert.equal(a.ev('panelOpen'), 'login');
  assert.equal(a.doc.getElementById('nickBtn').hidden, true);
  fin(a);
});

// ---- 서버 연결 2단계: 책·메모·완독/포기 (서버가 기준) ----
const bookApp = async (setup) => {
  const srv = fakeServer();
  const token = srv.seed('alice', '나무');
  if (setup) setup(srv);
  const a = load({ dev: true, api: srv, local: { [TOKEN]: token } });
  a.ev('BOOK_SAVE_DELAY=20'); // 쪽수 저장 대기를 줄인다
  await settle();
  await settle();
  return { srv, a };
};
const readingSeed = (srv, extra = {}) =>
  srv.seedBook('alice', { title: '데미안', author: '헤세', totalPages: 200, currentPage: 50, ...extra });
const sofa = (a) => a.ev("openF('sofa')");
const calls = (srv, method, re) => srv.calls.filter((c) => c.method === method && re.test(c.path));

test('서버 책 불러오기: 읽는 책·완독·포기와 메모를 서버에서 불러온다(데모 책은 사라진다)', async () => {
  const { a } = await bookApp((srv) => {
    readingSeed(srv, { notes: [{ content: '첫 메모' }, { type: 'QUOTE', content: '새는 알을 깨고', page: 50 }] });
    srv.seedBook('alice', { title: '아몬드', author: '손원평', status: 'DONE', rating: 4, oneLineReview: '좋았다', finishedAt: '2026-10-12T03:00:00Z', notes: [{ content: '끝' }] });
    srv.seedBook('alice', { title: '사피엔스', status: 'DONE', finishedAt: '2026-11-01T03:00:00Z' });
    srv.seedBook('alice', { title: '포기한 책', status: 'DROPPED', finishedAt: '2026-11-05T03:00:00Z' });
  });
  const s = a.state();
  assert.equal(s.reading.title, '데미안');
  assert.equal(s.reading.page, 50);
  assert.equal(s.reading.totalPages, 200);
  assert.equal(s.reading.progress, 25);
  assert.equal(s.reading.startedAt, '2026.11.17');
  assert.deepEqual(s.reading.notes.map((n) => [n.type, n.content, n.page]), [['MEMO', '첫 메모', null], ['QUOTE', '새는 알을 깨고', 50]], '오래된 메모부터');
  assert.deepEqual(s.finished.map((b) => b.title), ['아몬드', '사피엔스'], '완독일 순서');
  assert.equal(s.finished[0].rating, 4);
  assert.equal(s.finished[0].review, '좋았다');
  assert.equal(s.finished[0].finishedAt, '2026.10.12');
  assert.equal(s.finished[0].notes[0].content, '끝');
  assert.deepEqual(s.dropped.map((b) => b.title), ['포기한 책']);
  assert.ok(!s.finished.some((b) => b.title === '불편한 편의점'), '데모 책은 사라져요');
  assert.match(text(a, 'hdrStats'), /읽은 책 2권/);
  sofa(a);
  assert.match(text(a, 'panel'), /새는 알을 깨고/);
  fin(a);
});

test('책 올리기: 서버에 저장하고 서버 번호가 책 번호가 되며, 서버가 거절하면 상태를 바꾸지 않는다', async () => {
  const { srv, a } = await bookApp();
  assert.equal(a.state().reading, null);
  sofa(a);
  a.ev("panelView.t='데미안';panelView.a='헤세';panelView.tp='200'");
  a.click('#panel [data-act=addBook]');
  await settle();
  const post = calls(srv, 'POST', /^\/books$/)[0];
  assert.deepEqual([post.body.title, post.body.author, post.body.totalPages, post.body.currentPage], ['데미안', '헤세', 200, 0]);
  assert.equal(a.state().reading.id, srv.users.alice.books[0].id, '서버 번호를 써요');
  assert.match(text(a, 'toast'), /소파에 『데미안』을 올렸어요/);
  // 서버는 이미 읽는 책이 있다고 거절한다: 화면에는 없는 척하게 만들고 다시 올려 본다
  a.ev('S.reading=null');
  sofa(a);
  a.ev("panelView.t='다른 책';panelView.a='저자'");
  a.click('#panel [data-act=addBook]');
  await settle();
  assert.equal(a.state().reading, null, '거절되면 화면 상태는 그대로예요');
  assert.match(text(a, 'toast'), /소파에 이미 읽는 책이 있어요/);
  assert.equal(srv.users.alice.books.length, 1);
  fin(a);
});

test('쪽수 입력: 멈춘 뒤 한 번만 서버에 저장한다', async () => {
  const { srv, a } = await bookApp((s) => readingSeed(s, { currentPage: 0 }));
  sofa(a);
  a.ev("(()=>{const i=document.getElementById('pg');for(const v of [10,20,30]){i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}))}})()");
  assert.equal(calls(srv, 'PATCH', /^\/books\//).length, 0, '입력하는 동안에는 서버를 부르지 않아요');
  await settle();
  const patches = calls(srv, 'PATCH', /^\/books\//);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].body.currentPage, 30);
  assert.equal(srv.users.alice.books[0].currentPage, 30);
  assert.equal(a.state().reading.page, 30);
  fin(a);
});

test('메모: 추가하면 서버 응답의 쪽수·퍼센트가 반영되고, 삭제하면 서버에서도 지운다', async () => {
  const { srv, a } = await bookApp((s) => readingSeed(s, { currentPage: 10 }));
  sofa(a);
  a.ev("panelView.draft='좋았다'");
  val(a, 'np', '80');
  a.click('#panel [data-act=addNote]');
  await settle();
  const post = calls(srv, 'POST', /\/notes$/)[0];
  assert.deepEqual([post.body.type, post.body.content, post.body.page], ['MEMO', '좋았다', 80]);
  const s = a.state();
  assert.equal(s.reading.page, 80);
  assert.equal(s.reading.progress, 40);
  assert.equal(s.reading.notes.length, 1);
  assert.ok(s.reading.notes[0].id, '서버가 준 번호가 있어요');
  assert.match(text(a, 'panel'), /좋았다/);
  a.click('#panel [data-act=delNote]');
  await settle();
  assert.equal(calls(srv, 'DELETE', /\/notes\/\d+$/).length, 1);
  assert.equal(srv.users.alice.books[0].notes.length, 0, '서버에서도 지워져요');
  assert.equal(a.state().reading.notes.length, 0);
  assert.equal(a.state().reading.page, 80, '읽은 쪽은 줄지 않아요');
  fin(a);
});

test('완독·포기: 서버에 별점과 한줄평을 보내고 책장으로 옮긴다', async () => {
  const { srv, a } = await bookApp((s) => readingSeed(s, { notes: [{ content: '메모' }] }));
  sofa(a);
  a.click('#panel [data-act=finish]');
  a.ev("panelView.rating=4;panelView.review='오래 남을 책'");
  a.click('#panel [data-act=doFinish]');
  await settle();
  const post = calls(srv, 'POST', /\/finish$/)[0];
  assert.deepEqual([post.body.rating, post.body.oneLineReview], [4, '오래 남을 책']);
  const s = a.state();
  assert.equal(s.reading, null);
  assert.equal(s.finished.length, 1);
  assert.deepEqual([s.finished[0].title, s.finished[0].rating, s.finished[0].review, s.finished[0].notes.length], ['데미안', 4, '오래 남을 책', 1]);
  assert.equal(srv.users.alice.books[0].status, 'DONE');
  assert.match(text(a, 'hdrStats'), /읽은 책 1권/);
  // 다음 책을 올리고 포기한다
  sofa(a);
  a.ev("panelView.t='포기할 책';panelView.a='저자'");
  a.click('#panel [data-act=addBook]');
  await settle();
  a.click('#panel [data-act=drop]');
  a.click('#panel [data-act=doDrop]');
  await settle();
  assert.equal(calls(srv, 'POST', /\/drop$/).length, 1);
  assert.deepEqual(a.state().dropped.map((b) => b.title), ['포기할 책']);
  assert.equal(a.state().reading, null);
  fin(a);
});

test('완독을 서버가 거절하면 책은 소파에 그대로 있고 서버 문구가 나온다', async () => {
  const { srv, a } = await bookApp((s) => readingSeed(s));
  srv.users.alice.books[0].status = 'DONE'; // 다른 기기에서 이미 끝낸 책
  sofa(a);
  a.click('#panel [data-act=finish]');
  a.click('#panel [data-act=doFinish]');
  await settle();
  assert.equal(a.state().reading.title, '데미안');
  assert.equal(a.state().finished.length, 0);
  assert.match(text(a, 'toast'), /읽는 중인 책이 아니에요/);
  fin(a);
});

test('다른 계정으로 로그인하면 그 계정의 책으로 바뀐다', async () => {
  const { srv, a } = await bookApp((s) => {
    readingSeed(s);
    s.seed('bob', '밥');
  });
  assert.equal(a.state().reading.title, '데미안');
  a.click('#logoutBtn');
  await settle();
  val(a, 'loginLabel', 'bob');
  a.click('#panel [data-act=login]');
  await settle();
  await settle();
  assert.equal(a.state().reading, null, '밥에게는 읽는 책이 없어요');
  assert.equal(a.state().finished.length, 0);
  assert.equal(text(a, 'hdrName'), '밥의 방');
  fin(a);
});

test('서버에 닿지 않으면 로그인 창에 안내가 나온다', async () => {
  const srv = fakeServer();
  srv.down = true;
  const a = load({ dev: true, api: srv });
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

// ---- 서버 연결 2‑2단계: 스탠드 타이머·직접 기록 (서버 시각이 기준) ----
const MIN = 60000;
const lamp = (a) => a.ev("openF('lamp')");

test('서버 스탠드 복원: 켜져 있던 스탠드를 서버에서 불러오고 서버 시계가 달라도 경과 시간이 맞다', async () => {
  const { a } = await bookApp((srv) => {
    readingSeed(srv);
    srv.skew = 5 * MIN; // 서버 시계가 5분 앞서 있다
    srv.seedSession('alice', { startedAt: srv.now() - 20 * MIN });
  });
  const s = a.state().session;
  assert.equal(s.status, 'RUNNING');
  assert.ok(s.id > 0);
  const el = a.ev('elapsed()');
  assert.ok(el > 19.9 * MIN && el < 20.5 * MIN, '경과 시간은 약 20분이에요: ' + el);
  fin(a);
});

test('서버 스탠드 켜기: 서버가 만든 기록 번호로 켜지고, 이미 켜져 있으면 그 스탠드를 이어받는다', async () => {
  const { srv, a } = await bookApp((s) => readingSeed(s));
  assert.equal(a.state().session, null);
  a.ev('startTimer()');
  await settle();
  assert.equal(calls(srv, 'POST', /^\/sessions\/start$/).length, 1);
  const id = a.state().session.id;
  assert.equal(id, srv.users.alice.sess[0].id);
  // 다른 기기에서 켜 둔 상태로 다시 켜려 하면 이어받는다
  a.ev('S.session = null');
  a.ev('startTimer()');
  await settle();
  assert.equal(a.state().session.id, id);
  fin(a);
});

test('서버 스탠드 켜기 실패: 책이 없으면 서버 문구가 나오고 켜지지 않는다', async () => {
  const { a } = await bookApp();
  a.ev('S.reading = {id: 1, title: "x", notes: [], page: 0, progress: 0}'); // 화면만 어긋난 상태
  a.ev('startTimer()');
  await settle();
  assert.equal(a.state().session, null);
  assert.match(text(a, 'toast'), /소파에 책을 먼저 올려 주세요/);
  fin(a);
});

test('서버 스탠드 끄기: 쪽수·메모와 함께 서버에 보내고, 서버가 센 분을 기록에 넣는다', async () => {
  const { srv, a } = await bookApp((s) => {
    readingSeed(s);
    s.seedSession('alice', { startedAt: s.now() - 30 * MIN });
  });
  lamp(a);
  a.click('#panel [data-act=stopAsk]');
  val(a, 'sp', '90');
  a.ev("panelView.memo = '좋은 장면'");
  a.click('#panel [data-act=stopSave]');
  await settle();
  const c = calls(srv, 'POST', /\/sessions\/\d+\/stop$/);
  assert.equal(c.length, 1);
  assert.equal(c[0].body.endPage, 90);
  assert.equal(c[0].body.memo, '좋은 장면');
  assert.equal(c[0].body.endedBy, 'LAMP');
  assert.equal(calls(srv, 'POST', /\/notes$/).length, 0, '메모는 스탠드 끄기에 실려 가고 따로 보내지 않아요');
  const st = a.state();
  assert.equal(st.session, null);
  assert.equal(st.sessions.length, 1);
  assert.equal(st.sessions[0].minutes, 30);
  assert.equal(st.reading.page, 90);
  assert.equal(st.reading.notes.at(-1).content, '좋은 장면');
  assert.equal(srv.users.alice.books[0].currentPage, 90);
  fin(a);
});

test('서버 스탠드 끄기 실패: 서버 문구를 보이고 스탠드는 그대로 켜져 있다', async () => {
  const { srv, a } = await bookApp((s) => {
    readingSeed(s);
    s.seedSession('alice', { startedAt: s.now() - 30 * MIN });
  });
  srv.users.alice.sess[0].status = 'DONE'; // 다른 기기에서 먼저 끈 경우도 서버는 200이라 화면은 끝으로 맞춘다
  srv.users.alice.sess[0].endedAt = srv.now();
  lamp(a);
  a.click('#panel [data-act=stopAsk]');
  a.click('#panel [data-act=stopSave]');
  await settle();
  assert.equal(a.state().session, null);
  srv.down = true;
  a.ev('S.session = {id: 999, bookId: 1, startedAt: Date.now() - 600000, lastCheckAt: Date.now(), status: "RUNNING"}');
  lamp(a);
  a.click('#panel [data-act=stopAsk]');
  a.click('#panel [data-act=stopSave]');
  await settle();
  assert.notEqual(a.state().session, null, '서버에 닿지 않으면 끄지 않아요');
  assert.match(text(a, 'toast'), /서버에 연결할 수 없어요/);
  fin(a);
});

test('서버 [계속]: 서버가 받은 확인 시각으로 알림 줄이 사라진다', async () => {
  const { srv, a } = await bookApp((s) => {
    readingSeed(s);
    s.seedSession('alice', { startedAt: s.now() - 70 * MIN });
  });
  a.ev('renderNotice()');
  assert.match(a.doc.getElementById('notice').textContent, /아직 읽고 있어요/);
  a.click('#notice [data-n=cont]');
  await settle();
  assert.equal(calls(srv, 'POST', /\/check$/).length, 1);
  assert.ok(Date.now() - a.state().session.lastCheckAt < 5000);
  a.ev('renderNotice()');
  assert.equal(a.doc.getElementById('notice').style.display, 'none');
  fin(a);
});

test('서버 확인 필요: 마지막 확인까지·직접 입력·기록 안 함이 서버 규칙으로 처리된다', async () => {
  const mk = (extra) => bookApp((s) => {
    readingSeed(s);
    s.seedSession('alice', { startedAt: s.now() - 4 * 3600000, lastCheckAt: s.now() - 4 * 3600000 + 100 * MIN, status: 'NEEDS_CONFIRM', ...extra });
  });
  {
    const { srv, a } = await mk();
    assert.equal(a.state().session.status, 'NEEDS_CONFIRM');
    lamp(a);
    a.click('#panel [data-act=confirmLast]');
    await settle();
    assert.deepEqual(calls(srv, 'POST', /\/confirm$/)[0].body, { until: 'LAST_CHECK' });
    assert.equal(a.state().session, null);
    assert.equal(a.state().sessions[0].minutes, 100);
    fin(a);
  }
  {
    const { srv, a } = await mk();
    lamp(a);
    a.click('#panel [data-act=cmanual]');
    val(a, 'cm', '45');
    a.click('#panel [data-act=confirmManual]');
    await settle();
    assert.deepEqual(calls(srv, 'POST', /\/confirm$/)[0].body, { until: 'MINUTES', minutes: 45 });
    assert.equal(a.state().sessions[0].minutes, 45);
    fin(a);
  }
  {
    const { srv, a } = await mk();
    lamp(a);
    a.click('#panel [data-act=discard]');
    await settle();
    assert.deepEqual(calls(srv, 'POST', /\/confirm$/)[0].body, { discard: true });
    assert.equal(a.state().session, null);
    assert.equal(a.state().sessions.length, 0);
    fin(a);
  }
});

test('서버 직접 기록: 오늘·어제 분을 서버에 보내고 서버가 만든 기록을 넣는다', async () => {
  const { srv, a } = await bookApp((s) => readingSeed(s));
  lamp(a);
  a.click('#panel [data-act=manual]');
  a.click('#panel [data-act=mday][data-d="1"]');
  val(a, 'mm', '25');
  a.click('#panel [data-act=manualSave]');
  await settle();
  assert.deepEqual(calls(srv, 'POST', /\/sessions\/manual$/)[0].body, { minutes: 25, daysAgo: 1 });
  assert.equal(a.state().sessions.length, 1);
  assert.equal(a.state().sessions[0].source, 'MANUAL');
  assert.equal(a.state().sessions[0].minutes, 25);
  fin(a);
});

test('서버 오늘 읽은 시간: 로그인하면 서버가 센 오늘 분이 더해진다', async () => {
  const { a } = await bookApp((s) => {
    readingSeed(s);
    s.seedSession('alice', { startedAt: s.now() - 90 * MIN, endedAt: s.now() - 30 * MIN, status: 'DONE', endedBy: 'LAMP' });
  });
  assert.equal(a.ev('todayMin()'), 60);
  fin(a);
});

// ---- 서버 연결 3단계: 달력·월 목표 (서버가 독서한 날·연속일·목표를 센다) ----
const kdOf = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const calCalls = (srv) => calls(srv, 'GET', /^\/me\/calendar/);
const goalInput = (a) => a.doc.getElementById('goal');
const doneToday = (s, minutes = 30) =>
  s.seedSession('alice', { startedAt: s.now() - minutes * MIN - MIN, endedAt: s.now() - MIN, status: 'DONE', endedBy: 'LAMP' });

test('서버 달력: 이번 달 독서한 날·연속일·완독 수를 서버에서 불러와 보여 준다', async () => {
  const { srv, a } = await bookApp((s) => {
    readingSeed(s);
    doneToday(s);
    s.seedBook('alice', { title: '끝낸 책', totalPages: 100, status: 'DONE', finishedAt: new Date().toISOString() });
  });
  assert.equal(calCalls(srv).length, 1, '로그인 때 이번 달을 한 번 불러와요');
  assert.match(a.ev('hdrText()'), /1일 연속 기록/);
  lamp(a);
  a.ev(`openF('calendar')`);
  const today = +kdOf(Date.now()).slice(8);
  const on = [...a.doc.querySelectorAll('#panel .cal i.on')].map((i) => +i.textContent);
  assert.deepEqual(on, [today]);
  assert.match(a.doc.getElementById('panel').textContent, /1일/);
  assert.equal(goalInput(a).value, '1');
  assert.match(text(a, 'goalStat'), /1/);
  fin(a);
});

test('서버 달력: 지난 달로 가면 그 달을 서버에서 불러온다(연속일은 이번 달만)', async () => {
  const { srv, a } = await bookApp((s) => {
    readingSeed(s);
    s.seedSession('alice', { startedAt: s.now() - 40 * 86400000, endedAt: s.now() - 40 * 86400000 + 30 * MIN, status: 'DONE', endedBy: 'LAMP' });
  });
  a.ev(`openF('calendar')`);
  a.click('#panel [data-act=calPrev]');
  await settle();
  const prev = calCalls(srv).map((c) => c.path).find((p) => /month=/.test(p));
  assert.ok(prev, '지난 달을 요청해요');
  assert.equal(a.ev('panelView.calOff'), -1);
  assert.ok(a.doc.querySelectorAll('#panel .cal i').length >= 28);
  fin(a);
});

test('서버 월 목표: 칸을 벗어나면 1~99로 맞춰 서버에 보내고, 서버가 준 변경 기록을 보여 준다', async () => {
  const { srv, a } = await bookApp((s) => readingSeed(s));
  a.ev(`openF('calendar')`);
  a.change('#goal', '5');
  await settle();
  assert.deepEqual(calls(srv, 'PUT', /^\/me\/goal$/)[0].body, { monthlyGoal: 5 });
  assert.equal(goalInput(a).value, '5');
  assert.match(text(a, 'goalNote'), /목표를 바꿨어요 · 1→5권/);
  a.change('#goal', '500');
  await settle();
  assert.equal(calls(srv, 'PUT', /^\/me\/goal$/).at(-1).body.monthlyGoal, 99);
  assert.equal(goalInput(a).value, '99');
  const n = calls(srv, 'PUT', /^\/me\/goal$/).length;
  a.change('#goal', '');
  await settle();
  assert.equal(calls(srv, 'PUT', /^\/me\/goal$/).length, n, '빈 값은 보내지 않아요');
  a.click('#panel [data-act=goalDec]');
  await settle();
  assert.equal(calls(srv, 'PUT', /^\/me\/goal$/).at(-1).body.monthlyGoal, 98);
  assert.equal(goalInput(a).value, '98');
  fin(a);
});

test('서버 월 목표 실패: 서버 문구를 보이고 목표는 그대로다', async () => {
  const { srv, a } = await bookApp((s) => readingSeed(s));
  a.ev(`openF('calendar')`);
  srv.down = true;
  a.change('#goal', '7');
  await settle();
  assert.match(text(a, 'toast'), /서버에 연결할 수 없어요/);
  assert.equal(goalInput(a).value, '1');
  fin(a);
});

test('서버 달력 새로고침: 스탠드를 끄거나 완독하면 이번 달을 다시 불러와 연속일·완독 수가 바뀐다', async () => {
  const { srv, a } = await bookApp((s) => {
    readingSeed(s);
    s.seedSession('alice', { startedAt: s.now() - 30 * MIN });
  });
  assert.equal(a.ev('calData().streak'), 0);
  const before = calCalls(srv).length;
  lamp(a);
  a.click('#panel [data-act=stopAsk]');
  a.click('#panel [data-act=stopSave]');
  await settle();
  await settle();
  assert.ok(calCalls(srv).length > before, '끈 뒤 다시 불러와요');
  assert.equal(a.ev('calData().streak'), 1);
  sofa(a);
  a.click('#panel [data-act=finish]');
  a.click('#panel [data-act=doFinish]');
  await settle();
  await settle();
  assert.equal(a.ev('calData().done'), 1);
  fin(a);
});

// ---- 서버 연결 4단계: 마을 광장 대화 (서버의 글을 나눠 본다. 가짜 이웃의 말은 끈다) ----
const plazaApp = async (setup) => {
  const r = await bookApp((s) => {
    s.seed('bob', '밥');
    if (setup) setup(s);
  });
  r.a.ev('PLAZA_POLL = 30'); // 새 글 확인 간격을 줄인다
  return r;
};
const enterPlaza = async (a) => {
  a.ev('enterVillage()');
  await sleep(350);
  a.ev('Object.assign(sim, { x: PLAZA.cx, z: PLAZA.cz }); syncPlazaChat()');
  await settle();
};
const pzLog = (a) => a.doc.getElementById('pzLog');
const say = (a, t) => {
  a.doc.getElementById('pz').value = t;
  a.ev('plazaSend()');
};

test('서버 광장: 들어가면 서버의 최근 글을 불러오고 내 글은 내 말로 보인다(가짜 이웃의 말은 없다)', async () => {
  const { srv, a } = await plazaApp((s) => {
    s.seedPlaza('bob', '안녕하세요', 5000);
    s.seedPlaza('alice', '반가워요', 3000);
  });
  await enterPlaza(a);
  assert.match(pzLog(a).textContent, /밥.*안녕하세요/);
  assert.equal(pzLog(a).querySelectorAll('.msg.me').length, 1);
  assert.match(pzLog(a).querySelector('.msg.me').textContent, /반가워요/);
  assert.ok(calls(srv, 'GET', /^\/plaza\/messages$/).length >= 1, '광장에 들어서면 받아 와요(로그인 때 이웃집 주인을 뽑으며 한 번 더 부른다)');
  assert.ok(!a.state().plaza.some((m) => /^@/.test(m.who)), '가짜 이웃의 말은 서버 연결 모드에 없어요');
  assert.match(a.doc.getElementById('pzHead').textContent, /접속 \(01\/100\)/, '광장 접속 인원은 서버가 센다 (결정 #91)');
  fin(a);
});

test('창문: 테스트 도구(다른 날씨 보기)는 체험판에만 있고 서버 연결 모드에는 없다', async () => {
  const proto = load();
  proto.ev("openF('window')");
  assert.ok(proto.doc.querySelector('[data-act="sceneNext"]'), '체험판에는 있다');
  fin(proto);
  const { a } = await plazaApp();
  a.ev("openF('window')");
  await settle();
  assert.equal(a.doc.querySelector('[data-act="sceneNext"]'), null, '실서버에서는 안 보인다');
  assert.doesNotMatch(a.doc.getElementById('panel').textContent, /테스트 도구/);
  fin(a);
});

test('서버 광장 접속 인원:들어서면 연결해 인원을 보이고, 다른 사람이 오가면 바뀌며, 떠나면 연결을 끊는다 (결정 #91)', async () => {
  const { srv, a } = await plazaApp();
  const head = () => a.doc.getElementById('pzHead').textContent;
  await enterPlaza(a);
  assert.equal(srv.presence.length, 1, '광장에 들어서면 접속으로 센다');
  assert.match(head(), /접속 \(01\/100\)/);
  const bye = srv.joinPlaza('bob');
  await sleep(30);
  assert.match(head(), /접속 \(02\/100\)/);
  assert.equal(a.ev('PZ.people.map((p) => p.nickname).join()'), '밥','나는 빼고 다른 사람만 광장에 세운다');
  bye();
  await sleep(30);
  assert.match(head(), /접속 \(01\/100\)/);
  a.ev('Object.assign(sim, { x: 2, z: 5 }); syncPlazaChat()');
  await settle();
  assert.equal(srv.presence.length, 1, '광장 밖이어도 마을 안이면 접속으로 센다 (결정 #94)');
  a.ev("VIEW = 'room'; syncPlazaChat()");
  await settle();
  assert.equal(srv.presence.length, 0, '마을을 떠나면 연결을 끊는다');
  assert.equal(a.ev('PZ.people'), null);
  fin(a);
});

test('서버 광장: 마을에 있는 동안 새 글만 받아 보고, 마을을 떠나면 확인을 멈춘다', async () => {
  const { srv, a } = await plazaApp((s) => s.seedPlaza('bob', '첫 글', 2000));
  await enterPlaza(a);
  srv.seedPlaza('bob', '새로 온 글');
  await sleep(120);
  assert.match(pzLog(a).textContent, /새로 온 글/);
  assert.equal([...pzLog(a).querySelectorAll('.msg')].filter((m) => /첫 글/.test(m.textContent)).length, 1, '같은 글이 두 번 보이면 안 돼요');
  assert.ok(calls(srv, 'GET', /\?since=/).length >= 1, '그 뒤로는 since로 새 글만 물어요');
  a.ev("VIEW = 'room'; syncPlazaChat()");
  await settle();
  const n = srv.calls.length;
  await sleep(120);
  assert.equal(srv.calls.length, n, '마을 밖에서는 서버에 묻지 않아요');
  fin(a);
});

test('서버 광장: 글을 보내면 서버가 만든 글이 보이고 칸이 비며, 서버가 거절하면 문구를 보이고 글은 남는다', async () => {
  const { srv, a } = await plazaApp();
  await enterPlaza(a);
  say(a, '  안녕  ');
  await settle();
  assert.deepEqual(calls(srv, 'POST', /^\/plaza\/messages$/)[0].body, { content: '안녕' });
  assert.equal(srv.plaza.at(-1).nickname, '나무');
  assert.match(pzLog(a).querySelector('.msg.me').textContent, /안녕/);
  assert.equal(a.doc.getElementById('pz').value, '');
  say(a, '안녕');
  await settle();
  assert.match(a.doc.getElementById('pzE').textContent, /같은 말을 연달아 보낼 수 없어요/);
  assert.equal(a.doc.getElementById('pz').value, '안녕', '거절되면 쓰던 글이 남아요');
  assert.equal(pzLog(a).querySelectorAll('.msg.me').length, 1);
  a.ev('Object.assign(sim, { x: 2, z: 5 })');
  say(a, '광장 밖에서');
  await settle();
  assert.equal(calls(srv, 'POST', /plaza/).length, 3, '광장 밖이어도 마을 안이면 보낸다 (결정 #94)');
  fin(a);
});

test('서버 광장: 글자는 그대로 보인다(HTML 주입 방지)', async () => {
  const { a } = await plazaApp((s) => s.seedPlaza('bob', '<img src=x onerror=alert(1)>', 1000));
  await enterPlaza(a);
  assert.equal(pzLog(a).querySelector('img'), null);
  assert.match(pzLog(a).textContent, /<img src=x/);
  fin(a);
});

// ---- 서버 연결 5‑1단계: 마을 게시판과 공유방 개설·입장·나가기·닫기 (서버의 방이 기준) ----
const HR = 3600000;
const roomApp = async (setup) => {
  const r = await bookApp((s) => {
    s.seed('bob', '밥');
    if (setup) setup(s);
  });
  return r;
};
const toVillage = async (a) => {
  a.ev('enterVillage()');
  await sleep(350);
};
// alice(나)를 방에 참여시켜 둔다 (agreed: 보관 동의까지)
const joinSeeded = (s, room, agreed) => room.parts.push({ uid: s.users.alice.id, agreed: agreed ? Date.now() : false, left: false });
const newsOf = (a) => a.state().news;

test('서버 마을 게시판: 로그인하면 내가 참여한 서버의 방만 불러오고 체험판 방은 사라진다(가짜 참여자·대화도 없다)', async () => {
  const { a } = await roomApp((s) => {
    joinSeeded(s, s.seedRoom('bob', { title: '『데미안』 같이 읽기', max: 6 }), false);
    const mine = s.seedRoom('alice', { kind: 'OWN', title: '나의 모닥불', openAt: Date.now() + 5 * HR });
    mine.parts.splice(0, 1, { uid: s.users.alice.id, agreed: false, left: false });
  });
  const news = newsOf(a);
  assert.equal(news.length, 2, '서버가 준 두 개뿐이에요');
  const open = news.find((n) => n.kind === 'OPEN'), soon = news.find((n) => n.kind === 'SOON');
  assert.equal(open.title, '『데미안』 같이 읽기');
  assert.equal(open.max, 6);
  assert.equal(open.people, 2);
  assert.equal(open.mine, false);
  assert.equal(open.agreed, false);
  assert.equal(soon.mine, true);
  assert.match(soon.inviteCode, /^INVITE/, '개설자에게는 서버의 초대 코드가 와요');
  assert.deepEqual(open.messages, []);
  assert.deepEqual(open.members, []);
  assert.equal(open.inviteCode, '', '개설자가 아니면 초대 코드가 없고 만들어 채우지 않아요');
  fin(a);
});

test('서버 모닥불 피우기: 서버가 만든 방이 게시판에 생기고, 서버가 거절하면 문구를 보이고 방은 생기지 않는다', async () => {
  const { srv, a } = await roomApp((s) => readingSeed(s, { isbn: '9788937460777' }));
  await toVillage(a);
  a.ev(`openV('fire:new')`);
  a.click('#panel [data-act=rcreate]');
  await settle();
  const c = calls(srv, 'POST', /^\/rooms$/);
  assert.equal(c.length, 1);
  assert.equal(c[0].body.kind, 'SAME');
  assert.equal(c[0].body.isbn, '9788937460777');
  assert.equal(c[0].body.bookId, srv.users.alice.books[0].id);
  assert.equal(c[0].body.maxParticipants, 8);
  assert.equal(c[0].body.hours, 3);
  assert.equal(c[0].body.visibility, 'INVITE');
  assert.equal(c[0].body.title, undefined, '이름을 비우면 서버가 정해요');
  const n = newsOf(a).find((x) => x.mine);
  assert.ok(n && n.kind === 'OPEN');
  assert.match(n.title, /데미안/);
  assert.equal(a.ev('panelView.created'), n.id);
  // 같은 책 방을 더 열어 동시에 열 수 있는 수(2개)를 넘긴다
  a.ev(`openV('fire:new')`);
  a.click('#panel [data-act=rcreate]');
  await settle();
  a.ev(`openV('fire:new')`);
  a.click('#panel [data-act=rcreate]');
  await settle();
  assert.match(a.doc.getElementById('rerr').textContent, /동시에 열 수 있는 모닥불은 2개/);
  assert.equal(newsOf(a).filter((x) => x.mine).length, 2);
  fin(a);
});

test('서버 초대 코드 입장: [초대 코드로 입장] → 확인하면 방 이름·책·진행 시간·인원을 보이고 → [이 방에 입장] → 보관 동의 → 모닥불 (결정 #95)', async () => {
  const { srv, a } = await roomApp((s) => {
    s.seedRoom('bob', { title: '밥의 모닥불', code: 'ABCD2345', max: 3 });
    const full = s.seedRoom('bob', { title: '가득 찬 방', code: 'FULL2345', max: 2 });
    full.parts.push({ uid: 999, agreed: false, left: false });
    s.seedRoom('bob', { title: '끝난 방', code: 'DONE2345', openAt: Date.now() - 5 * 3600e3, hours: 1 });
  });
  await toVillage(a);
  a.ev(`openV('board')`);
  a.click('#panel [data-act=joinOpen]');
  const inp = () => a.doc.getElementById('jl'),
    err = () => a.doc.getElementById('jlE').textContent,
    check = async (v) => {
      inp().value = v;
      a.click('#panel [data-act=joinCheck]');
      await settle();
    };
  assert.equal(inp().placeholder, '8자리 초대 코드를 입력해 주세요');
  await check('123');
  assert.match(err(), /8자리 초대 코드를 입력해 주세요/);
  await check('ZZZZ9999');
  assert.match(err(), /초대 코드를 찾을 수 없어요/);
  await check('done2345');
  assert.match(err(), /이미 끝난 모닥불이에요/);
  assert.equal(a.doc.getElementById('joinPreview'), null);
  assert.equal(calls(srv, 'POST', /^\/rooms\/join$/).length, 0, '확인만으로는 들어가지 않는다');
  // 정원이 찬 방: 미리보기는 보이지만 입장은 서버가 거절하고, 이유를 입력창 아래에 보인다
  await check('https://x.test/#join=FULL2345');
  a.click('#panel [data-act=joinConfirm]');
  await settle();
  assert.match(err(), /정원이 가득 찼어요/);
  assert.equal(newsOf(a).filter((x) => x.joined).length, 0, '들어가지 못했다 (남의 방은 보이기만 한다, 결정 #97)');
  // 정상 코드 (소문자·띄어쓰기·하이픈도 된다)
  await check(' abcd-2345 ');
  const card = a.doc.getElementById('joinPreview').textContent;
  assert.match(card, /밥의 모닥불/);
  assert.match(card, /책: 데미안/);
  assert.match(card, /진행 시간: /);
  assert.match(card, /참여 인원: 1\/3명/);
  a.click('#panel [data-act=joinConfirm]');
  await settle();
  assert.deepEqual(calls(srv, 'POST', /^\/rooms\/join$/).at(-1).body, { code: 'ABCD2345' });
  const n = newsOf(a).find((x) => x.title === '밥의 모닥불');
  assert.equal(n.joined, true);
  assert.equal(n.locked, false);
  assert.equal(n.people, 2, '참여 인원이 바로 바뀐다');
  assert.equal(n.agreed, false);
  assert.equal(a.ev('panelOpen'), 'room:' + n.id, '들어오면 그 방의 보관 동의 창이 열린다');
  a.click('#panel [data-act=rcAgree]');
  await settle();
  await settle();
  assert.equal(a.ev('VIEW'), 'shared', '동의하면 모닥불로 이동한다');
  assert.ok(calls(srv, 'GET', /\/participants$/).length >= 1, '참여자 목록을 바로 받는다');
  assert.equal(a.ev(`S.news.find((x) => x.id === '${n.id}').parts.map((p) => p.nickname).join()`), '밥');
  fin(a);
});

test('방 정보의 초대 코드: 방을 만든 사람에게 코드와 [코드 복사]가 보이고, 누르면 코드를 복사한다', async () => {
  const { a } = await roomApp((s) => {
    s.seedRoom('alice', { title: '내 모닥불', code: 'MINE2345' }).parts[0].agreed = Date.now();
  });
  await toVillage(a);
  a.ev("navigator.clipboard = { writeText: (t) => { window.COPIED = t; return Promise.resolve(); } }");
  a.ev(`openV('room:${newsOf(a)[0].id}')`); // 동의한 열린 방은 모닥불 장면으로 간다
  await settle();
  a.click('#campSide [data-camp=info]'); // 오른쪽 위 ⓘ 방 정보
  await settle();
  assert.match(a.doc.getElementById('invCode').textContent, /MINE2345/);
  a.click('[data-act=copyCode]');
  await settle();
  assert.equal(a.ev('window.COPIED'), 'MINE2345');
  assert.match(text(a, 'toast'), /초대 코드를 복사했어요/);
  fin(a);
});

test('서버 보관 동의와 나가기: 동의하면 서버에 기록되고, 나가면 서버에서 나온 뒤 게시판에서 사라진다', async () => {
  const { srv, a } = await roomApp((s) => joinSeeded(s, s.seedRoom('bob', { title: '밥의 모닥불' }), false));
  await toVillage(a);
  const id = newsOf(a)[0].id;
  a.ev(`openV('room:${id}')`);
  a.click('#panel [data-act=rcAgree]');
  await settle();
  assert.equal(calls(srv, 'POST', /\/agree$/).length, 1);
  assert.equal(newsOf(a)[0].agreed, true);
  assert.ok(srv.rooms[0].parts.find((p) => p.uid === srv.users.alice.id).agreed);
  // 나가기
  a.ev(`rcAct('rcLeave', { dataset: { id: '${id}' } })`);
  await settle();
  assert.equal(calls(srv, 'DELETE', /\/participants\/me$/).length, 1);
  assert.equal(newsOf(a)[0].joined, false, '나온 방은 참여 중이 아니다');
  assert.equal(newsOf(a)[0].locked, true, '열려 있는 동안은 보이지만 다시 들어가려면 초대 코드가 필요하다 (결정 #97)');
  fin(a);
});

test('서버 모닥불 닫기: 열린 방은 일찍 끄고(종료로 바뀜), 예정 방은 취소하면 사라진다', async () => {
  const { srv, a } = await roomApp((s) => {
    s.seedRoom('alice', { title: '열린 방' });
    s.seedRoom('alice', { title: '예정 방', openAt: Date.now() + 5 * HR });
  });
  await toVillage(a);
  const open = newsOf(a).find((n) => n.title === '열린 방'), soon = newsOf(a).find((n) => n.title === '예정 방');
  a.ev(`sharedRoomAction('closeRoom', { dataset: { id: '${soon.id}' } })`);
  await settle();
  assert.equal(newsOf(a).some((n) => n.title === '예정 방'), false);
  a.ev(`sharedRoomAction('closeRoom', { dataset: { id: '${open.id}' } })`);
  await settle();
  assert.equal(calls(srv, 'POST', /\/close$/).length, 2);
  const closed = newsOf(a).find((n) => n.title === '열린 방');
  assert.equal(closed.kind, 'CLOSED');
  assert.ok(closed.deleteAt > Date.now());
  fin(a);
});

test('서버 모닥불 피우기: ISBN이 없는 책으로는 같은 책 방을 못 열고 서버 문구가 나온다(각자 읽기 방은 열린다)', async () => {
  const { srv, a } = await roomApp((s) => readingSeed(s)); // 직접 적은 책이라 ISBN이 없다
  await toVillage(a);
  a.ev(`openV('fire:new')`);
  a.click('#panel [data-act=rcreate]');
  await settle();
  assert.match(a.doc.getElementById('rerr').textContent, /같은 책 방은 책\(isbn\)이 필요해요/);
  assert.equal(newsOf(a).length, 0);
  a.click('#panel [data-act=rkind][data-v=OWN]');
  a.click('#panel [data-act=rcreate]');
  await settle();
  assert.equal(calls(srv, 'POST', /^\/rooms$/).at(-1).body.kind, 'OWN');
  assert.equal(newsOf(a).length, 1);
  fin(a);
});

test('남의 모닥불: 참여하지 않아도 게시판에 보이고, 누르면 초대 코드가 필요하다고 안내하며 [초대 코드로 입장]으로 이어진다. 창문 소식에는 없다 (결정 #97)', async () => {
  const { a } = await roomApp((s) => s.seedRoom('bob', { title: '밥의 모닥불', code: 'BOBS2345' }));
  await toVillage(a);
  const n = newsOf(a)[0];
  assert.equal(n.title, '밥의 모닥불');
  assert.equal(n.locked, true);
  a.ev(`openV('board')`);
  assert.match(text(a, 'panel'), /밥의 모닥불/);
  assert.match(text(a, 'panel'), /초대 코드 필요/);
  a.ev(`openV('room:${n.id}')`);
  assert.match(text(a, 'panel'), /초대 코드가 필요해요/);
  assert.equal(a.doc.querySelector('#panel [data-act=rcAgree]'), null, '동의하고 들어가기는 없다');
  a.click('#panel [data-act=joinWithCode]');
  assert.equal(a.ev('panelOpen'), 'board');
  assert.ok(a.doc.getElementById('jl'), '게시판의 초대 코드 입력칸이 열린다');
  a.ev(`closePanel(); openF('window')`);
  assert.doesNotMatch(text(a, 'panel'), /밥의 모닥불/, '창문은 내 방·참여한 방 소식만');
  fin(a);
});

test('서버 초대 링크: #join= 코드로 열면 로그인이 끝난 뒤에 그 방에 들어간다', async () => {
  const { srv, a } = await roomApp((s) => s.seedRoom('bob', { title: '밥의 모닥불', code: 'LINK234' }));
  assert.equal(newsOf(a)[0].locked, true, '들어가기 전에는 보이기만 한다 (결정 #97)');
  a.ev(`PENDING_JOIN = 'LINK234'; afterSignIn()`);
  await settle();
  await settle();
  assert.deepEqual(calls(srv, 'POST', /^\/rooms\/join$/).at(-1).body, { code: 'LINK234' });
  assert.equal(newsOf(a)[0].joined, true);
  assert.equal(a.ev('PENDING_JOIN'), '', '한 번만 들어가요');
  fin(a);
});

// ---- 서버 연결 5‑2단계: 공유방 대화·읽음 (서버의 글을 보고, 보내고, 읽음을 알린다) ----
// 밥의 열린 방에 나(alice)가 보관 동의까지 하고 들어가 있다. 글: 밥(12쪽) · 나 · 나간 사람(다람)
const chatRoom = (s, o = {}) => {
  s.seed('carol', '다람');
  const r = s.seedRoom('bob', { title: '『데미안』 같이 읽기', ...o });
  joinSeeded(s, r, true);
  r.parts.push({ uid: s.users.carol.id, agreed: Date.now(), left: true });
  s.seedRoomMsg(r, 'bob', '안녕하세요', { page: 12, agoMs: 9000 });
  s.seedRoomMsg(r, 'alice', '반가워요', { agoMs: 8000 });
  s.seedRoomMsg(r, 'carol', '저는 나갈게요', { agoMs: 7000 });
  return r;
};
const chatApp = async (setup) => {
  const r = await roomApp(setup);
  r.a.ev('ROOM_POLL = 30'); // 새 글 확인 간격을 줄인다
  return r;
};
const openChat = async (a, n) => {
  await toVillage(a);
  a.ev(`openV('room:${n.id}')`); // 열린 방에 동의했으면 모닥불 장면으로 들어가고 대화창이 뜬다
  await settle();
  await settle();
};

test('서버 공유방 대화: 방을 열면 서버의 글을 불러와 보여 준다(내 글은 나, 나간 사람은 "나간 참여자", 쪽수 표시)', async () => {
  const { srv, a } = await chatApp((s) => chatRoom(s));
  const n = newsOf(a)[0];
  await openChat(a, n);
  assert.equal(a.ev('VIEW'), 'shared');
  const msgs = JSON.parse(a.ev(`JSON.stringify(S.news[0].messages.map((m) => [m.who, m.text, m.page, !!m.left]))`));
  assert.deepEqual(msgs, [['밥', '안녕하세요', 12, false], ['나', '반가워요', null, false], ['나간 참여자', '저는 나갈게요', null, true]]);
  const html = a.ev(`rcLogHtml(S.news[0])`);
  assert.match(html, /밥/);
  assert.match(html, /나간 참여자/);
  assert.match(html, /12쪽/);
  assert.ok(calls(srv, 'GET', /\/messages$/).length >= 1);
  fin(a);
});

test('서버 공유방 대화: 열려 있는 동안 새 글만 받아 보고, 창을 닫으면 확인을 멈춘다', async () => {
  const { srv, a } = await chatApp((s) => chatRoom(s));
  await openChat(a, newsOf(a)[0]);
  srv.seedRoomMsg(srv.rooms[0], 'bob', '새로 온 글');
  await sleep(120);
  const texts = JSON.parse(a.ev(`JSON.stringify(S.news[0].messages.map((m) => m.text))`));
  assert.deepEqual(texts.filter((t) => t === '새로 온 글'), ['새로 온 글'], '한 번만 들어와요');
  assert.ok(calls(srv, 'GET', /\/messages\?after=\d+$/).length >= 1, '그 뒤로는 마지막 글 번호(after)로 물어요');
  a.ev('closePanel()');
  await settle();
  const n = srv.calls.length;
  await sleep(120);
  assert.equal(srv.calls.filter((c, i) => i >= n && /^\/rooms\/\d+\/messages/.test(c.path)).length, 0, '창이 없으면 서버에 묻지 않아요 (마을 대화 /plaza/messages는 따로 센다)');
  fin(a);
});

test('서버 공유방 보내기: 서버가 만든 글이 보이고 칸이 비며, 서버가 거절하면 문구를 보이고 쓰던 글이 남는다', async () => {
  const { srv, a } = await chatApp((s) => chatRoom(s));
  await openChat(a, newsOf(a)[0]);
  const ta = a.doc.getElementById('rc');
  ta.value = '  오늘 읽었어요  ';
  a.ev(`panelView.pg = 30; rcAct('rcSend', null)`);
  await settle();
  const c = calls(srv, 'POST', /\/messages$/);
  assert.deepEqual(c[0].body, { content: '오늘 읽었어요', page: 30 });
  assert.equal(a.ev(`S.news[0].messages.at(-1).text`), '오늘 읽었어요');
  assert.equal(a.ev(`rcMine(S.news[0].messages.at(-1))`), true);
  assert.equal(a.doc.getElementById('rc').value, '');
  a.doc.getElementById('rc').value = '오늘 읽었어요';
  a.ev(`rcAct('rcSend', null)`);
  await settle();
  assert.match(a.doc.getElementById('rcE').textContent, /같은 말을 연달아 보낼 수 없어요/);
  assert.equal(a.doc.getElementById('rc').value, '오늘 읽었어요');
  assert.equal(a.ev(`S.news[0].messages.filter((m) => m.text === '오늘 읽었어요').length`), 1);
  fin(a);
});

test('서버 공유방 읽음: 다른 사람의 새 글이 있으면 별이 켜지고, 대화창을 열어 보면 읽음을 서버에 알려 꺼진다', async () => {
  const { srv, a } = await chatApp((s) => {
    const r = chatRoom(s);
    r.parts.find((p) => p.uid === s.users.alice.id).lastRead = Date.now() - 8500; // 밥의 첫 글 뒤에 읽었다
  });
  const n = newsOf(a)[0];
  assert.equal(n.unread, true);
  assert.equal(a.ev(`rcUnread(S.news[0])`), true);
  assert.match(a.ev(`roomCard(S.news[0])`), /새 글/);
  await openChat(a, n);
  assert.ok(calls(srv, 'POST', /\/read$/).length >= 1, '열어 보면 읽음을 알려요');
  await settle();
  assert.equal(a.ev(`rcUnread(S.news[0])`), false);
  fin(a);
});

test('서버 종료된 공유방: 보관 동의한 방은 대화를 읽을 수 있고(보내기 칸은 없다), 열 때만 불러온다', async () => {
  const { srv, a } = await chatApp((s) => chatRoom(s));
  srv.rooms[0].closedAt = Date.now() - 1000; // 방이 끝났다
  await srv.fetch('http://api.test/rooms', { headers: {} }).catch(() => {});
  const { a: b } = { a };
  b.ev('loadRooms()');
  await settle();
  const n = newsOf(b)[0];
  assert.equal(n.kind, 'CLOSED');
  await toVillage(b);
  b.ev(`openV('room:${n.id}')`);
  await settle();
  await settle();
  assert.equal(b.ev('VIEW'), 'village', '종료된 방은 모닥불에 들어가지 않고 창으로 읽어요');
  assert.match(b.doc.getElementById('rcLog').textContent, /안녕하세요/);
  assert.equal(b.doc.getElementById('rc'), null, '종료된 방에는 보내기 칸이 없어요');
  fin(b);
});

// ---- 서버 연결 5‑3단계: 공유방 개방 알림·내 서재로 가져오기 (서버가 기록한다) ----
const alarmApp = (setup) => roomApp((s) => joinSeeded(s, s.seedRoom('bob', { title: '『소년이 온다』 이야기방', openAt: Date.now() + 5 * HR }), false) || (setup && setup(s)));

test('서버 개방 알림: 예정 방의 [알림 받기]가 서버에 켜고 끄며, 그 사이 열린 방이면 서버 문구가 나온다', async () => {
  const { srv, a } = await alarmApp();
  const n = () => newsOf(a)[0];
  assert.equal(n().kind, 'SOON');
  assert.match(a.ev(`roomCard(S.news[0])`), /알림 받기/, '서버 연결 모드에서도 알림 버튼이 보여요');
  a.ev(`sharedRoomAction('alarm', { dataset: { id: S.news[0].id } })`);
  await settle();
  assert.equal(calls(srv, 'PUT', /\/alarm$/).length, 1);
  assert.equal(n().alarm, true);
  assert.match(a.ev(`roomCard(S.news[0])`), /알림 받는 중/);
  a.ev(`sharedRoomAction('alarm', { dataset: { id: S.news[0].id } })`);
  await settle();
  assert.equal(calls(srv, 'DELETE', /\/alarm$/).length, 1);
  assert.equal(n().alarm, false);
  srv.rooms[0].openAt = Date.now() - 1000; // 그 사이 방이 열렸다
  a.ev(`sharedRoomAction('alarm', { dataset: { id: S.news[0].id } })`);
  await settle();
  assert.match(text(a, 'toast'), /이미 열린 모닥불이에요/);
  assert.equal(n().kind, 'OPEN', '서버 상태로 다시 맞춰요');
  fin(a);
});

// 밥의 끝난 방: 밥(안녕)·나(반가워요), 나는 보관 동의까지 했다
const closedRoom = (s, o = {}) => {
  const r = s.seedRoom('bob', { title: '『데미안』 같이 읽기', isbn: '9788937460777', ...o });
  r.closedAt = Date.now() - 1000;
  joinSeeded(s, r, true);
  if (!o.empty) {
    s.seedRoomMsg(r, 'bob', '안녕하세요', { page: 12, agoMs: 9000 });
    s.seedRoomMsg(r, 'alice', '반가워요', { agoMs: 8000 });
  }
  return r;
};

test('서버 가져오기: 같은 ISBN의 내 책에 붙고, 책의 공유방 탭에서 다른 참여자는 익명으로 보이며, 다시 열어도 가져옴 표시가 남는다', async () => {
  const { srv, a } = await roomApp((s) => {
    s.seedBook('alice', { title: '데미안', author: '헤세', isbn: '9788937460777', totalPages: 200, status: 'DONE', finishedAt: new Date().toISOString() });
    closedRoom(s);
  });
  const n = newsOf(a)[0];
  assert.equal(n.kind, 'CLOSED');
  assert.equal(n.done, false);
  assert.match(a.ev(`roomCard(S.news[0])`), /내 서재로 가져오기/, '글을 아직 안 불러왔어도 가져오기 버튼이 보여요');
  a.ev(`sharedRoomAction('import', { dataset: { id: S.news[0].id } })`);
  await settle();
  await settle();
  const c = calls(srv, 'POST', /\/import$/);
  assert.equal(c.length, 1);
  assert.equal(newsOf(a)[0].done, true);
  assert.match(text(a, 'toast'), /『데미안』에 공유방 탭이 생겼어요/);
  assert.match(a.ev(`roomCard(S.news[0])`), /내 서재로 가져옴/);
  // 새로 불러와도(다른 화면에서 열어도) 가져옴 표시가 남는다
  a.ev('loadRooms()');
  await settle();
  assert.equal(newsOf(a)[0].done, true);
  // 책장에서 책을 열면 가져온 기록을 서버에서 불러온다
  a.ev(`openF('shelf'); panelView = { book: S.finished[0].id, drop: false, list: 'finished' }; roomAction('openBook', { dataset: { id: String(S.finished[0].id), drop: '0' } })`);
  await settle();
  const rooms = JSON.parse(a.ev(`JSON.stringify(S.finished[0].rooms.map((r) => r.messages.map((m) => [m.who, m.text, m.page])))`));
  assert.deepEqual(rooms, [[['참여자 A', '안녕하세요', 12], ['나', '반가워요', null]]]);
  fin(a);
});

test('서버 가져오기: 내 책에 없으면 나중에 읽을 책으로 담기고, 대화가 없거나 책을 못 정하면 서버 문구가 나온다', async () => {
  const { srv, a } = await roomApp((s) => {
    closedRoom(s, { title: '『모모』 같이 읽기', isbn: '9788937462788' });
    closedRoom(s, { title: '빈 방', empty: true });
  });
  const id = (t) => newsOf(a).find((n) => n.title === t).id;
  a.ev(`sharedRoomAction('import', { dataset: { id: '${id('빈 방')}' } })`);
  await settle();
  assert.match(text(a, 'toast'), /가져올 대화가 없어요/);
  a.ev(`sharedRoomAction('import', { dataset: { id: '${id('『모모』 같이 읽기')}' } })`);
  await settle();
  await settle();
  assert.match(text(a, 'toast'), /"나중에 읽을 책"에 담고 공유방 기록을 같이 넣었어요/);
  assert.equal(a.state().later.length, 1);
  assert.equal(a.state().later[0].title, '모모');
  assert.equal(a.state().finished.length, 0, '나중에 읽을 책은 완독으로 세지 않아요');
  fin(a);
});

test('서버 모닥불 참여자: 들어가면 실제 참여자 명단을 받아 나와 나간 사람을 빼고, 각자 읽기 방은 그 사람의 실제 책을 붙인다 (결정 #92)', async () => {
  const { srv, a } = await chatApp((s) => {
    const r = chatRoom(s, { kind: 'OWN' });
    r.parts[0].bookTitle = '싯다르타';
  });
  await openChat(a, newsOf(a)[0]);
  assert.equal(calls(srv, 'GET', /\/participants$/).length, 1);
  assert.equal(a.ev('S.news[0].parts.map((p) => p.nickname).join()'), '밥', '체험판 이웃이 아니라 실제 참여자 (나와 나간 사람은 빠진다)');
  assert.equal(a.ev("rcBookTag(S.news[0], '밥')"), ' 『싯다르타』');
  assert.equal(a.ev("rcBookTag(S.news[0], '모르는')"), '', '서버 연결 모드는 지어낸 책을 붙이지 않는다');
  assert.equal(a.ev("rcBookTag(S.news[0], '나')"), '', '책을 고르지 않았으면 내 이름표에 방 이름을 책처럼 붙이지 않는다');
  const before = a.ev('S.news[0].messages.length');
  a.ev('rcFakeMsg(S.news[0])');
  assert.equal(a.ev('S.news[0].messages.length'), before, '실제 참여자 이름으로 체험판 대사를 지어내지 않는다');
  a.ev('loadRooms()');
  await settle();
  assert.equal(a.ev('S.news[0].parts.length'), 1, '방 목록을 새로 받아도 참여자 명단은 남는다');
  fin(a);
});

// ---- 서버 연결 5‑4단계: 모닥불 머문 시간 (서버가 입장·퇴장 시각으로 센다) ----
test('서버 모닥불 머문 시간: 들어갈 때 서버에 알리고, 나가면 서버가 센 분이 오늘 읽은 시간·달력에 더해진다(화면이 따로 더하지 않는다)', async () => {
  const { srv, a } = await chatApp((s) => chatRoom(s));
  await openChat(a, newsOf(a)[0]);
  assert.equal(calls(srv, 'POST', /\/stay$/).length, 1);
  assert.equal(a.ev('VIEW'), 'shared');
  const cal = calCalls(srv).length;
  srv.skew += 20 * MIN; // 서버 시계로 20분이 지났다
  a.ev('leaveCamp()');
  await settle();
  await settle();
  assert.equal(calls(srv, 'POST', /\/stay\/leave$/).length, 1);
  assert.equal(a.ev('VIEW'), 'village');
  assert.equal(a.ev('todayMin()'), 20);
  assert.match(text(a, 'toast'), /20분을 읽은 시간에 더했어요/);
  assert.equal(a.state().sessions.filter((x) => x.source === 'CAMP').length, 0, '화면이 머문 시간을 따로 기록하지 않아요');
  assert.ok(calCalls(srv).length > cal, '달력도 다시 불러와요');
  fin(a);
});

test('서버 모닥불 머문 시간: 1분 미만은 더해지지 않고, 스탠드 기록과 겹쳐 두 번 세지 않는다', async () => {
  const { srv, a } = await chatApp((s) => {
    chatRoom(s);
    readingSeed(s);
    s.seedSession('alice', { startedAt: s.now() - 30 * MIN, endedAt: s.now(), status: 'DONE', endedBy: 'LAMP' }); // 오늘 30분 읽었다
  });
  assert.equal(a.ev('todayMin()'), 30);
  await openChat(a, newsOf(a)[0]);
  a.ev('leaveCamp()');
  await settle();
  await settle();
  assert.equal(a.ev('todayMin()'), 30, '1분 미만은 더하지 않아요');
  assert.doesNotMatch(text(a, 'toast'), /읽은 시간에 더했어요/);
  await openChat(a, newsOf(a)[0]);
  srv.skew += 15 * MIN;
  a.ev('leaveCamp()');
  await settle();
  await settle();
  assert.equal(a.ev('todayMin()'), 45, '서버가 센 값에서 화면에 있는 기록을 빼고 더해요');
  fin(a);
});

test('서버 모닥불 머문 시간: 방을 일찍 끄면 장면에서 광장으로 돌아가며 머문 시간이 서버에 기록된다', async () => {
  const { srv, a } = await chatApp((s) => {
    const r = chatRoom(s);
    r.parts[0] = { uid: s.users.alice.id, agreed: Date.now(), left: false }; // 내가 연 방
    r.parts.splice(1, 1); // 중복 참여 제거
  });
  await openChat(a, newsOf(a)[0]);
  srv.skew += 10 * MIN;
  a.ev(`sharedRoomAction('closeRoom', { dataset: { id: S.news[0].id } })`);
  await settle();
  await settle();
  await settle();
  assert.equal(calls(srv, 'POST', /\/stay\/leave$/).length, 1);
  assert.equal(a.ev('VIEW'), 'village');
  assert.equal(a.ev('todayMin()'), 10);
  fin(a);
});

test('서버 모닥불 입장: 서버가 거절하면(이미 끝난 방) 서버 문구가 나온다', async () => {
  const { srv, a } = await chatApp((s) => chatRoom(s));
  await toVillage(a);
  srv.rooms[0].closedAt = Date.now() - 1000; // 화면은 아직 모르는 사이에 끝났다
  a.ev(`openV('room:${newsOf(a)[0].id}')`);
  await settle();
  assert.match(text(a, 'toast'), /이미 끝난 모닥불이에요/);
  fin(a);
});

// ---- 서버 연결 6단계: 이웃집 책 추천 (마을의 집은 최근 광장에서 말한 사람이 무작위로 산다) ----
const nbApp = async (setup) => {
  const r = await bookApp((s) => {
    s.seed('bob', '밥');
    s.seed('carol', '다람');
    readingSeed(s, { isbn: '9788937460777' });
    s.seedBook('carol', { title: '모모', author: '엔데', isbn: '9788937462788', status: 'DONE' });
    s.seedPlaza('bob', '안녕', 3000);
    s.seedPlaza('carol', '반가워요', 2000);
    s.seedPlaza('alice', '나도 말했어요', 1000);
    if (setup) setup(s);
  });
  return r;
};
const houseOf = (a, name) => a.ev(`NEIGHBORS.findIndex((n) => n.name === '${name}')`);
const visit = async (a, i) => {
  a.ev(`visitNeighbor('neighbor-${i}')`);
  await settle();
  await settle();
};

test('서버 이웃집 배정: 최근 광장에서 말한 사람(나 제외)이 집에 살고 나머지 집은 빈 집이다', async () => {
  const { a } = await nbApp();
  await toVillage(a);
  const names = JSON.parse(a.ev(`JSON.stringify(NEIGHBORS.map((n) => n.name))`));
  assert.equal(names.filter((n) => n === '밥').length, 1);
  assert.equal(names.filter((n) => n === '다람').length, 1);
  assert.equal(names.filter((n) => n === '나무' || n === '달빛' || n === '구름').length, 0, '체험판 가짜 이웃 이름은 없어요');
  assert.equal(names.filter((n) => n === '빈 집').length, 6);
  assert.equal(names.includes('나무'), false, '나(나무)는 내 집이라 이웃집에 살지 않아요');
  fin(a);
});

test('서버 이웃집 방문·추천: 사는 사람이 있는 집은 서버에서 정보를 받아 들어가고, 책을 꽂으면 서버가 받는다', async () => {
  const { srv, a } = await nbApp();
  await toVillage(a);
  const i = houseOf(a, '밥');
  await visit(a, i);
  assert.equal(a.ev('VIEW'), 'neighbor');
  assert.equal(calls(srv, 'GET', /^\/neighbors\//).length, 1);
  assert.equal(text(a, 'hdrName'), '밥의 집');
  a.ev(`openNeighbor('shelf')`);
  assert.match(a.doc.getElementById('panel').textContent, /데미안/);
  assert.doesNotMatch(a.doc.getElementById('panel').textContent, /테스트 도구/, '집 주인 확인 재현 도구는 체험판에만 있어요');
  a.click('#panel [data-act=giftPut][data-key=reading]');
  await settle();
  const c = calls(srv, 'POST', /\/recommendation$/);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].body, { bookId: srv.users.alice.books[0].id });
  assert.equal(a.ev(`S.recommendations['neighbor-${i}'].book.title`), '데미안');
  a.ev(`openNeighbor('shelf')`);
  assert.match(a.doc.getElementById('panel').textContent, /책장 아래 칸에 꽂아 두었어요/);
  fin(a);
});

test('서버 이웃집 방문: 이미 다른 이웃의 책이 꽂힌 집은 새로 꽂을 수 없고, 빈 집·사라진 집은 서버 문구가 나온다', async () => {
  const { srv, a } = await nbApp((s) => s.seedRecommendation('carol', 'bob', '모모'));
  await toVillage(a);
  await visit(a, houseOf(a, '밥'));
  assert.equal(a.ev('VIEW'), 'neighbor');
  a.ev(`openNeighbor('shelf')`);
  assert.match(a.doc.getElementById('panel').textContent, /집 주인이 확인하면 다시 추천할 수 있어요/);
  assert.equal(a.doc.querySelector('#panel [data-act=giftPut]'), null);
  a.ev(`leaveNeighbor()`);
  await settle();
  const empty = a.ev(`NEIGHBORS.findIndex((n) => n.name === '빈 집')`);
  await visit(a, empty);
  assert.equal(a.ev('VIEW'), 'village', '빈 집에는 들어가지 않아요');
  assert.match(text(a, 'toast'), /아직 이웃이 살지 않는 집이에요/);
  const i = houseOf(a, '다람');
  srv.users.carol.publicId = '99999999-9999-4999-8999-999999999999'; // 그 사이 사라진 집
  await visit(a, i);
  assert.equal(a.ev('VIEW'), 'village');
  assert.match(text(a, 'toast'), /그 집을 찾을 수 없어요/);
  fin(a);
});

test('서버 내 집에 온 추천: 로그인하면 보낸 사람 닉네임과 함께 보이고, 확인하면 서버에 알리고 사라진다', async () => {
  const { srv, a } = await nbApp((s) => s.seedRecommendation('carol', 'alice', '모모'));
  assert.equal(a.ev(`S.recommendations.me.from`), '다람');
  assert.equal(a.ev(`S.recommendations.me.book.title`), '모모');
  assert.match(a.ev('incomingGiftHtml()'), /다람/);
  a.ev(`openF('shelf')`);
  a.click('#panel [data-act=giftRead][data-house=me]');
  await settle();
  assert.equal(calls(srv, 'POST', /\/me\/recommendation\/confirm$/).length, 1);
  assert.equal(a.ev(`S.recommendations.me === undefined`), true);
  assert.equal(a.ev('incomingGiftHtml()'), '');
  fin(a);
});

// ---- 책 검색 연결: 서버 연결 모드에서는 따로 정하지 않아도 서버(국립중앙도서관)의 검색을 쓴다 ----
const searchOf = async (a, q) => {
  a.ev(`searchBooks(${JSON.stringify(q)}).then((r) => { window.__r = r; })`);
  await settle();
  await settle();
  return JSON.parse(a.ev('JSON.stringify(window.__r)'));
};

test('서버 책 검색: 서버 연결 모드에서는 서버의 /books/search로 찾고 화면 모양으로 바꾼다(로그인 토큰은 필요 없다)', async () => {
  const { srv, a } = await bookApp();
  const r = await searchOf(a, '토지');
  const c = calls(srv, 'GET', /^\/books\/search/);
  assert.equal(c.length, 1);
  assert.equal(c[0].path, '/books/search?q=' + encodeURIComponent('토지'));
  assert.deepEqual(r.items, [{ title: '토지 이야기', author: '박경리', pages: 0, isbn: '9788954439497', cover: '' }], '제목 검색 결과에는 쪽수가 없을 수 있어요(카카오)');
  fin(a);
});

test('서버 책 검색: 서버가 말한 검색 오류(400)는 문구 그대로 보이고, 서버가 준비되지 않았으면(503) 오류 없이 다른 검색으로 넘어간다', async () => {
  const { srv, a } = await bookApp();
  srv.search = { status: 400, body: { error: 'BAD_QUERY', message: '이 링크에서 책을 찾지 못했어요. 제목으로 찾아 보세요' } };
  const bad = await searchOf(a, '토지');
  assert.equal(bad.err, '이 링크에서 책을 찾지 못했어요. 제목으로 찾아 보세요');
  srv.search = { status: 503, body: { error: 'SEARCH_UNAVAILABLE', message: '책 검색이 아직 준비되지 않았어요' } };
  const off = await searchOf(a, '토지');
  assert.notEqual(off.err, '책 검색이 아직 준비되지 않았어요', '서버의 준비 안 됨 문구를 그대로 띄우지 않아요');
  assert.ok(srv.calls.some((c) => /googleapis/.test(c.path)), '대신 구글 북스로 찾아 봐요');
  assert.match(off.err, /직접 적어 주세요/, '그쪽도 안 되면 직접 적으라고 안내해요');
  fin(a);
});

test('서버 책 검색: 찾은 책을 고르면 ISBN으로 쪽수·표지를 채우고, 소파에 올리면 ISBN·표지·쪽수가 서버에 함께 저장된다', async () => {
  const { srv, a } = await bookApp();
  sofa(a);
  a.ev(`panelView.q = '토지'; runSearch()`);
  await settle();
  await settle();
  a.click('#panel [data-act=bpick][data-i="0"]');
  assert.equal(a.ev('panelView.tp'), '', '고른 직후에는 쪽수를 모른다(제목 검색 결과에는 없다)');
  await settle();
  await settle();
  const lookup = calls(srv, 'GET', /^\/books\/search/).at(-1);
  assert.equal(lookup.path, '/books/search?q=9788954439497', '고른 책의 ISBN으로 한 번 더 조회해요');
  assert.equal(a.ev('panelView.tp'), 432);
  assert.equal(a.ev('panelView.cover'), 'https://img.test/nl.jpg');
  a.click('#panel [data-act=addBook]');
  await settle();
  const c = calls(srv, 'POST', /^\/books$/);
  assert.equal(c.length, 1);
  assert.equal(c[0].body.title, '토지 이야기');
  assert.equal(c[0].body.isbn, '9788954439497');
  assert.equal(c[0].body.coverUrl, 'https://img.test/nl.jpg');
  assert.equal(c[0].body.totalPages, 432);
  assert.equal(a.state().reading.isbn, '9788954439497');
  fin(a);
});

test('서버 책 검색: 쪽수를 채우지 못해도(조회 실패·이미 직접 적음) 입력은 그대로이고 책을 올릴 수 있다', async () => {
  const { srv, a } = await bookApp();
  sofa(a);
  a.ev(`panelView.q = '토지'; runSearch()`);
  await settle();
  await settle();
  srv.search = { status: 502, body: { error: 'SEARCH_FAILED', message: '책 정보를 가져오지 못했어요' } };
  a.click('#panel [data-act=bpick][data-i="0"]');
  await settle();
  await settle();
  assert.equal(a.ev('panelView.tp'), '', '조회가 실패하면 쪽수는 빈 채로 둬요');
  assert.equal(a.ev('panelView.t'), '토지 이야기');
  a.ev(`panelView.tp = 100`); // 사용자가 직접 적은 쪽수는 덮어쓰지 않는다
  srv.search = null;
  a.ev(`fillBookDetails('9788954439497')`);
  await settle();
  await settle();
  assert.equal(a.ev('panelView.tp'), 100);
  assert.equal(a.ev('panelView.cover'), 'https://img.test/nl.jpg', '쪽수는 그대로 두고 비어 있던 표지만 채워요');
  fin(a);
});

// ---- 게스트로 시작 (결정 #84): 가입·로그인 창 없이 기기 키로 들어간다 ----
const DEVICE = 'myroom-device';
const guestHeader = (a) => text(a, 'hdrName');

test('게스트 시작: 토큰이 없으면 로그인 창 없이 기기 키로 시작하고, 새 계정은 닉네임 정하기로 이어진다', async () => {
  const srv = fakeServer();
  const a = load({ api: srv });
  await settle();
  await settle();
  assert.notEqual(a.ev('panelOpen'), 'login', '이름을 묻는 로그인 창은 없어요');
  assert.equal(a.ev('panelOpen'), 'nickname');
  assert.equal(a.ev('ACCT.locked'), true, '처음 닉네임은 정할 때까지 닫을 수 없어요');
  const key = a.w.localStorage.getItem(DEVICE);
  assert.match(key, /^[A-Za-z0-9_-]{32,128}$/, '기기 키는 서버 규칙에 맞는 무작위 값이에요');
  const c = calls(srv, 'POST', /^\/auth\/guest$/);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].body, { deviceKey: key });
  assert.equal(calls(srv, 'POST', /\/dev\/login$/).length, 0);
  assert.ok(a.w.localStorage.getItem(TOKEN), '받은 토큰을 기기에 둬요');
  assert.equal(a.doc.getElementById('logoutBtn').hidden, true, '게스트는 기기가 곧 계정이라 로그아웃이 없어요');
  assert.equal(a.doc.getElementById('nickBtn').hidden, false);
  val(a, 'nickInput', '나무');
  a.click('#panel [data-act=saveNick]');
  await settle();
  assert.equal(guestHeader(a), '나무의 방');
  fin(a);
});

test('게스트 시작: 같은 기기로 다시 열면(토큰이 없어도) 같은 계정이고, 정해 둔 닉네임이 그대로다', async () => {
  const srv = fakeServer();
  const a = load({ api: srv });
  await settle();
  await settle();
  val(a, 'nickInput', '나무');
  a.click('#panel [data-act=saveNick]');
  await settle();
  const key = a.w.localStorage.getItem(DEVICE);
  a.close();
  const b = load({ api: srv, local: { [DEVICE]: key } }); // 토큰은 잃었지만 기기 키는 남아 있다
  await settle();
  await settle();
  assert.equal(Object.keys(srv.guests).length, 1, '새 계정이 만들어지지 않아요');
  assert.equal(guestHeader(b), '나무의 방');
  assert.notEqual(b.ev('panelOpen'), 'nickname', '닉네임을 이미 정했으니 창이 뜨지 않아요');
  assert.equal(b.w.localStorage.getItem(DEVICE), key, '기기 키는 그대로예요');
  fin(b);
});

test('게스트 시작: 토큰이 만료돼도 로그인 창 없이 같은 기기 키로 조용히 다시 들어온다', async () => {
  const srv = fakeServer();
  const a = load({ api: srv });
  await settle();
  await settle();
  val(a, 'nickInput', '나무');
  a.click('#panel [data-act=saveNick]');
  await settle();
  const key = a.w.localStorage.getItem(DEVICE);
  a.close();
  const b = load({ api: srv, local: { [DEVICE]: key, [TOKEN]: 'tok-만료됐어요' } });
  await settle();
  await settle();
  assert.notEqual(b.ev('panelOpen'), 'login');
  assert.equal(guestHeader(b), '나무의 방');
  assert.equal(Object.keys(srv.guests).length, 1);
  assert.notEqual(b.w.localStorage.getItem(TOKEN), 'tok-만료됐어요', '새 토큰으로 바뀌어요');
  fin(b);
});

test('게스트 시작 실패: 서버에 닿지 않으면 닫을 수 없는 안내와 [다시 시도]가 나오고, 다시 시도하면 이어진다', async () => {
  const srv = fakeServer();
  srv.guestDown = true;
  const a = load({ api: srv });
  await settle();
  await settle();
  assert.equal(a.ev('panelOpen'), 'guestFail');
  assert.match(a.doc.getElementById('panel').textContent, /지금은 시작할 수 없어요/);
  a.ev('closePanel()'); // 바깥 클릭·Esc와 같은 닫기 시도
  assert.equal(a.ev('panelOpen'), 'guestFail', '시작하기 전에는 닫을 수 없어요');
  srv.guestDown = false;
  a.click('#panel [data-act=guestRetry]');
  await settle();
  await settle();
  assert.equal(a.ev('panelOpen'), 'nickname');
  assert.equal(Object.keys(srv.guests).length, 1);
  fin(a);
});

// ---- 기기 옮기기 (이전 코드, 결정 #85): 코드로 다른 기기에서 같은 계정으로 들어온다 ----
const guestDevice = async (srv, nick) => {
  const a = load({ api: srv });
  await settle();
  await settle();
  val(a, 'nickInput', nick);
  a.click('#panel [data-act=saveNick]');
  await settle();
  return a;
};
const issueCode = async (a) => {
  a.click('#transferBtn');
  a.click('#panel [data-act=transferIssue]');
  await settle();
  return a.doc.getElementById('xcode').textContent.replace('-', '');
};
const enterCode = async (b, code) => {
  val(b, 'xin', code);
  b.click('#panel [data-act=transferRedeem]');
  await settle();
  await settle();
};

test('기기 옮기기: 로그인한 뒤 버튼이 보이고, 코드 만들기를 누르면 서버가 준 코드가 ABCD-EFGH 모양으로 보인다', async () => {
  const srv = fakeServer();
  const a = load({ api: srv });
  await settle();
  await settle();
  assert.equal(a.doc.getElementById('transferBtn').hidden, false);
  val(a, 'nickInput', '나무');
  a.click('#panel [data-act=saveNick]');
  await settle();
  a.click('#transferBtn');
  assert.equal(a.ev('panelOpen'), 'transfer');
  a.click('#panel [data-act=transferIssue]');
  await settle();
  assert.equal(calls(srv, 'POST', /^\/me\/transfer-code$/).length, 1);
  assert.match(a.doc.getElementById('xcode').textContent, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.match(a.doc.getElementById('panel').textContent, /까지 쓸 수 있고, 한 번만 쓸 수 있어요/);
  fin(a);
});

test('기기 옮기기: 다른 기기가 코드를 넣으면 같은 계정으로 바뀌고 책이 불러와진다', async () => {
  const srv = fakeServer();
  const a = await guestDevice(srv, '나무');
  const keyA = a.w.localStorage.getItem(DEVICE);
  srv.seedBook('guest:' + keyA, { title: '데미안', author: '헤세', totalPages: 200, currentPage: 50 });
  const code = await issueCode(a);

  const b = load({ api: srv }); // 새 기기: 먼저 자동으로 빈 게스트 계정을 만든다
  await settle();
  await settle();
  assert.equal(b.ev('panelOpen'), 'nickname');
  assert.notEqual(b.state().user.publicId, a.state().user.publicId);
  b.click('#panel [data-act=openTransfer]');
  assert.equal(b.ev('panelOpen'), 'transfer');
  await enterCode(b, code.slice(0, 4) + '-' + code.slice(4).toLowerCase()); // 대소문자·하이픈은 무시한다
  assert.deepEqual(calls(srv, 'POST', /^\/auth\/transfer$/).at(-1).body, { code: code.slice(0, 4) + '-' + code.slice(4).toLowerCase(), deviceKey: b.w.localStorage.getItem(DEVICE) });
  assert.equal(b.state().user.publicId, a.state().user.publicId, '같은 계정이에요');
  assert.equal(b.state().user.nickname, '나무');
  assert.equal(b.state().reading.title, '데미안', '그 계정의 책이 불러와져요');
  assert.notEqual(b.ev('panelOpen'), 'transfer');
  assert.notEqual(b.ev('panelOpen'), 'nickname', '이미 닉네임이 있는 계정이라 닉네임 창이 닫혀요');
  assert.equal(srv.guests[b.w.localStorage.getItem(DEVICE)], srv.guests[keyA], '새 기기 키가 그 계정으로 이어져요');
  assert.match(text(b, 'toast'), /다른 기기의 계정으로 바꿨어요/);
  fin(a);
  fin(b);
});

test('기기 옮기기: 코드는 한 번만 쓸 수 있고, 틀렸거나 비어 있으면 서버·화면 문구가 나오고 창은 열려 있다', async () => {
  const srv = fakeServer();
  const a = await guestDevice(srv, '나무');
  const code = await issueCode(a);
  const b = load({ api: srv });
  await settle();
  await settle();
  b.click('#panel [data-act=openTransfer]');
  b.click('#panel [data-act=transferRedeem]'); // 비어 있다
  assert.match(b.doc.getElementById('acctErr').textContent, /코드를 입력해 주세요/);
  await enterCode(b, 'ABCDEFGH'); // 없는 코드
  assert.match(b.doc.getElementById('acctErr').textContent, /코드가 없거나 만료됐어요/);
  await enterCode(b, 'ab'); // 모양이 틀림
  assert.match(b.doc.getElementById('acctErr').textContent, /코드는 영문·숫자 8자리예요/);
  assert.equal(b.ev('panelOpen'), 'transfer');
  await enterCode(b, code);
  assert.equal(b.state().user.publicId, a.state().user.publicId);
  const c = load({ api: srv });
  await settle();
  await settle();
  c.click('#panel [data-act=openTransfer]');
  await enterCode(c, code); // 같은 코드를 다시
  assert.match(c.doc.getElementById('acctErr').textContent, /코드가 없거나 만료됐어요/);
  fin(a);
  fin(b);
  fin(c);
});

test('기기 옮기기: 처음 닉네임을 정하는 중이면 닫을 수 없고, [닉네임 정하기로]로 돌아올 수 있다', async () => {
  const srv = fakeServer();
  const b = load({ api: srv });
  await settle();
  await settle();
  assert.match(b.doc.getElementById('panel').textContent, /다른 기기에서 쓰던 계정이 있나요/);
  b.click('#panel [data-act=openTransfer]');
  assert.equal(b.ev('panelOpen'), 'transfer');
  b.ev('closePanel()'); // 바깥 클릭·Esc와 같은 닫기 시도
  assert.equal(b.ev('panelOpen'), 'transfer', '새 계정이 닉네임을 정하기 전에는 닫을 수 없어요');
  b.click('#panel [data-act=openNickname]');
  assert.equal(b.ev('panelOpen'), 'nickname');
  assert.equal(b.ev('ACCT.locked'), true);
  fin(b);
});

// ---- 창 모양 (구조): 창 맨 아래 고정 버튼 줄(.foot)은 창의 마지막 요소로 한 번만, 카드 안에는 넣지 않는다 ----
test('계정 창의 모양: 버튼 줄(.foot)은 마지막에 하나뿐이고 카드 안에 있지 않다 (기기 옮기기·닉네임·로그인·시작 실패)', async () => {
  const srv = fakeServer();
  const token = srv.seed('alice', '나무');
  const a = load({ dev: true, api: srv, local: { [TOKEN]: token } });
  await settle();
  await settle();
  const states = {
    '닉네임 바꾸기': "ACCT.locked = false; ACCT.nick = '나무'; openAccount('nickname')",
    '처음 닉네임(잠김)': "ACCT.locked = true; ACCT.nick = ''; openAccount('nickname')",
    '기기 옮기기': "ACCT.locked = false; ACCT.xfer = null; openAccount('transfer')",
    '기기 옮기기(코드 있음)': "ACCT.locked = false; ACCT.xfer = { code: 'FERYU6BX', expiresAt: Date.now() + 600000 }; openAccount('transfer', '코드가 없거나 만료됐어요')",
    '기기 옮기기(잠김)': "ACCT.locked = true; ACCT.xfer = null; openAccount('transfer')",
    '개발용 로그인': "ACCT.locked = false; openAccount('login', '로그인이 만료됐어요')",
    '시작 실패': "ACCT.locked = false; openAccount('guestFail', '서버에 연결할 수 없어요')",
  };
  for (const [name, code] of Object.entries(states)) {
    a.ev('panelOpen = null; ACCT.locked = false');
    a.ev(code);
    const panel = a.doc.getElementById('panel');
    const foots = [...panel.querySelectorAll('.foot')];
    assert.ok(foots.length <= 1, name + ': .foot이 둘 이상이에요');
    if (foots.length) assert.equal(panel.lastElementChild, foots[0], name + ': .foot이 마지막 요소가 아니에요');
    assert.equal(panel.querySelectorAll('.card .foot').length, 0, name + ': 카드 안에 .foot이 있어요');
  }
  fin(a);
});
