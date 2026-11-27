// 실제 브라우저 테스트: 3D가 그려지는지, 화면이 넘치거나 겹치지 않는지, 실제 클릭·키보드로 흐름이 되는지 본다.
// 실행: npm run e2e   (처음에는 npx playwright install chromium)
const { test, expect } = require('@playwright/test');

// 새 방문자 상태로 연다 (이전 테스트의 저장값을 지운다). 콘솔 오류는 모아 둔다.
async function open(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|429|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.removeItem('myroom-proto-v1'));
  await page.goto('/index.html');
  await page.waitForFunction('typeof G3!=="undefined"'); // 페이지 스크립트가 끝날 때까지
  return errors;
}
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

test('이웃집: 집과 책장 실제 클릭, 책 꽂기, 재방문·확인·다시 추천', async ({ page }, info) => {
  const errors = await open(page);
  await page.evaluate('enterVillage()');
  await page.waitForFunction("VIEW==='village'");
  const hit = async f => {
    const pt = await page.evaluate(f => {
      const r = document.getElementById('stage').getBoundingClientRect();
      for (let y = .12; y < .95; y += .025) for (let x = .03; x < .97; x += .025) {
        const p = {clientX:r.x+r.width*x,clientY:r.y+r.height*y};
        if([[0,0],[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dy])=>G3.pick({clientX:p.clientX+dx,clientY:p.clientY+dy})?.f===f)) return {x:p.clientX,y:p.clientY};
      }
      return null;
    }, f);
    expect(pt, f+'의 실제 클릭 영역').not.toBeNull();
    await page.mouse.click(pt.x,pt.y);
  };
  await hit('neighbor:neighbor-0');
  await page.waitForFunction("VIEW==='neighbor'");
  await expect(page.locator('#stageWrap')).toHaveCSS('border-top-width','0px');
  await expect(page.locator('#stageWrap')).toHaveCSS('border-top-left-radius','0px');
  const visibleTargets = await page.evaluate(() => {
    const r=document.getElementById('stage').getBoundingClientRect(),targets=new Set();
    for(let y=.1;y<.95;y+=.05)for(let x=.05;x<.95;x+=.05){
      const p=G3.pick({clientX:r.x+r.width*x,clientY:r.y+r.height*y});
      if(p)targets.add(p.f||'floor');
    }
    return [...targets];
  });
  expect(visibleTargets).toEqual(['shelf']);
  await hit('shelf');
  await expect(page.locator('#panel')).toContainText('나무의 책장');
  await page.locator('#panel [data-act=giftPut]').first().click();
  await expect(page.locator('#backdrop')).not.toHaveClass(/open/);
  expect(await page.evaluate("S.recommendations['neighbor-0'].book.title")).toBe('아몬드');
  await expect(page.locator('#toast')).not.toHaveClass(/show/, {timeout:5000});
  await page.screenshot({path:`test-results/neighbor-${info.project.name}.png`});
  expect(await noHScroll(page)).toBe(true);
  await page.reload();
  await page.waitForFunction("typeof G3!=='undefined'");
  await page.evaluate('enterVillage()');
  await page.waitForFunction("VIEW==='village'");
  await page.locator('#srBtns [data-f="neighbor:neighbor-0"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction("VIEW==='neighbor'");
  await hit('shelf');
  await expect(page.locator('#panel [data-act=giftPut]')).toHaveCount(0);
  await page.locator('#panel details summary').click();
  await page.locator('[data-act=giftOwner]').click();
  await page.locator('[data-act=giftRead]').click();
  await expect(page.locator('#panel [data-act=giftPut]').first()).toBeVisible();
  await page.locator('#panel [data-act=giftPut]').first().click();
  await page.locator('#neighborExit').click();
  await expect(page.locator('#minimap')).toBeVisible();
  await page.evaluate('leaveVillage()');
  await page.waitForFunction("VIEW==='room'");
  await hit('sofa');
  await expect(page.locator('#panel')).toContainText('소파');
  expect(errors).toEqual([]);
});

test('공유방: 동의·대화·별도 정보창·마을로 나가기가 이어진다', async ({ page }, info) => {
  const errors = await open(page);
  await page.evaluate('enterVillage()');
  await page.waitForFunction("VIEW==='village'");
  await page.evaluate("openV('room:n1')");
  await page.locator('#panel [data-act=rcAgree]').click();
  await page.waitForFunction("VIEW==='shared'");
  await page.locator('#rc').fill('분리한 공유방에서 보내요');
  // 폰의 Enter는 줄바꿈이라 보내기 버튼을 누른다
  if (info.project.name === 'mobile') await page.locator('[data-act=rcSend]').click();
  else await page.locator('#rc').press('Enter');
  await expect(page.locator('#rcLog')).toContainText('분리한 공유방에서 보내요');
  await page.locator('#campSide [data-camp=info]').click();
  await expect(page.locator('#campModal')).toHaveClass(/open/);
  await expect(page.locator('#campModalPanel')).toContainText('방 정보');
  await info.attach('공유방 정보', { body: await page.screenshot(), contentType: 'image/png' });
  await page.locator('#campModalPanel [data-act=cmClose]').click();
  expect(await page.evaluate('VIEW')).toBe('shared');
  await page.locator('#campExit').click();
  await page.locator('#panel [data-act=campLeave]').click();
  await page.waitForFunction("VIEW==='village'");
  await expect(page.locator('#minimap')).toBeVisible();
  expect(await noHScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('방: 3D가 그려지고 오류가 없고 가로로 넘치지 않는다', async ({ page }, info) => {
  const errors = await open(page);
  expect(await page.evaluate('G3!==null'), '3D(WebGL)를 시작하지 못했어요').toBe(true);
  await expect(page.locator('#fail')).toBeHidden();
  // 캔버스가 비어 있지 않다: 한 점도 아닌 여러 색이 있다
  const shot = await page.locator('#stage').screenshot();
  await info.attach('방', { body: shot, contentType: 'image/png' });
  expect(shot.length, '캔버스가 비어 보여요').toBeGreaterThan(8000);
  expect(await noHScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('방: 키보드로 가구를 열면 창이 뜨고 화면 안에 들어오며, ESC로 닫힌다', async ({ page }) => {
  const errors = await open(page);
  const btn = page.locator('#srBtns button[data-f=shelf]');
  await btn.focus();
  await page.keyboard.press('Enter');
  const panel = page.locator('#panel');
  await expect(page.locator('#backdrop')).toHaveClass(/open/);
  await expect(panel.locator('.panel-head h2')).toBeFocused();   // 포커스가 창 제목으로 간다
  const vp = page.viewportSize(), box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#backdrop')).not.toHaveClass(/open/);
  await expect(btn).toBeFocused();                               // 닫으면 열었던 버튼으로 돌아온다
  expect(errors).toEqual([]);
});

test('방: 실제 클릭으로 소파를 눌러 창을 열 수 있다 (3D 클릭 판정)', async ({ page }) => {
  await open(page);
  // 페이지 안에서 3D 클릭 판정(G3.pick)으로 소파가 걸리는 화면 좌표를 찾는다 (빠름)
  const pt = await page.evaluate(() => {
    const r = document.getElementById('stage').getBoundingClientRect();
    for (let fy = 0.3; fy <= 0.9; fy += 0.02) for (let fx = 0.2; fx <= 0.85; fx += 0.02) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy, p = G3.pick({ clientX: x, clientY: y });
      if (p && p.f === 'sofa') return { x, y };
    }
    return null;
  });
  expect(pt, '화면 어디에서도 소파가 판정되지 않아요').not.toBeNull();
  // 그 자리를 실제 마우스로 한 번 눌러 클릭 이벤트부터 창이 열리기까지 이어지는지 본다
  await page.mouse.click(pt.x, pt.y);
  await expect.poll(() => page.evaluate('panelOpen')).toBe('sofa');
});

test('마을: 문으로 나가면 미니맵이 오른쪽 위에, 접속 인원이 채팅창 제목에 보이고 화면이 넘치지 않는다', async ({ page }, info) => {
  const errors = await open(page);
  await page.evaluate("openF('door')");
  await page.waitForFunction("VIEW==='village'", null, { timeout: 20000 });
  const mini = page.locator('#minimap');
  await expect(mini).toBeVisible();
  await expect(page.locator('#hint'), '마을에서는 안내 문구를 숨긴다').toBeHidden();
  const m = await mini.boundingBox(), s = await page.locator('#stageWrap').boundingBox();
  expect(Math.abs(m.width - m.height), '미니맵이 정사각형이 아니에요').toBeLessThanOrEqual(1);
  expect(m.y - s.y, '미니맵이 화면 위쪽에 있어야 해요').toBeLessThan(30);
  expect(s.x + s.width - (m.x + m.width), '미니맵이 화면 오른쪽에 있어야 해요').toBeLessThan(30);
  // 마을 어디서나 채팅창이 떠 있으므로(결정 #94) 하단 접속 글자는 숨고 인원은 채팅창 제목에 있다
  await expect(page.locator('#plazaChat')).toBeVisible();
  await expect(page.locator('#online')).toBeHidden();
  await expect(page.locator('#pzHead')).toHaveText(/접속 \(\d{2}\/\d+\)/);
  const c = await page.locator('#plazaChat').boundingBox();
  const overlap = !(c.x + c.width <= m.x + 1 || m.x + m.width <= c.x + 1 || c.y + c.height <= m.y + 1 || m.y + m.height <= c.y + 1);
  expect(overlap, '채팅창이 미니맵을 덮지 않는다').toBe(false);
  expect(await noHScroll(page)).toBe(true);
  await info.attach('마을', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('마을: 마을 어디서나 채팅창이 뜨고 글이 화면에 보이며 화면을 넘지 않는다', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate("openF('door')");
  await page.waitForFunction("VIEW==='village'", null, { timeout: 20000 });
  const chat = page.locator('#plazaChat');
  await page.evaluate("Object.assign(sim,{x:2,z:5});syncPlazaChat()");   // 광장 밖이어도 마을 안이면 보인다 (결정 #94)
  await expect(chat).toBeVisible();
  const vp = page.viewportSize(), box = await chat.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  await page.locator('#pz').fill('안녕하세요 광장입니다');
  await page.keyboard.press('Enter');
  await expect(page.locator('#pzLog')).toContainText('안녕하세요 광장입니다');
  await expect(page.locator('.vbub.me')).toBeVisible();          // 머리 위 말풍선
  expect(errors).toEqual([]);
});

test('폰 폭 경계: 761px와 760px에서 방 구도가 바뀌어도 오류가 없고 넘치지 않는다', async ({ page }) => {
  const errors = await open(page);
  await page.setViewportSize({ width: 761, height: 800 });
  await page.waitForFunction("MQ.matches===false");
  expect(await noHScroll(page)).toBe(true);
  await page.setViewportSize({ width: 760, height: 800 });
  await page.waitForFunction("MQ.matches===true");
  expect(await noHScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

// 창 모양: 모든 창을 열어 보고, 버튼 줄이 창 맨 아래에 하나만 있고 카드와 겹치지 않으며, 컨트롤이 창 밖으로 나가거나 서로 겹치지 않는지 본다.
// (맨 아래 고정 버튼 줄 밑으로 긴 내용이 스크롤되는 것은 의도된 구조라 겹침에서 뺀다.) 데스크톱·폰 두 화면에서 돈다.
test('창 모양: 내 방·마을의 모든 창에서 버튼 줄·카드·입력칸이 겹치거나 넘치지 않는다', async ({ page }) => {
  const errors = await open(page);
  const audit = () => page.evaluate(() => {
    const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const p = document.getElementById('panel'), pr = p.getBoundingClientRect(), issues = [];
    if (!p.innerHTML.trim()) return ['창이 비어 있어요'];
    if (p.scrollWidth > p.clientWidth + 1) issues.push('가로 넘침');
    const sticky = [...p.querySelectorAll('.foot')].filter(f => getComputedStyle(f).position === 'sticky');
    if (sticky.length > 1) issues.push('고정 버튼 줄이 ' + sticky.length + '개');
    sticky.forEach(f => { if (f.parentElement === p && f !== p.lastElementChild) issues.push('고정 .foot이 마지막 요소가 아님'); });
    sticky.forEach(f => p.querySelectorAll('.card').forEach(c => { if (!c.contains(f) && inter(f.getBoundingClientRect(), c.getBoundingClientRect()) > 40) issues.push('.foot이 카드와 겹침'); }));
    const folded = e => { const d = e.closest('details'); return !!d && !d.open; };   // 접힌 "테스트 도구" 상자 안은 보이지 않으니 뺀다
    const ctrls = [...p.querySelectorAll('button,input,textarea,select')].filter(e => e.offsetParent !== null && !folded(e));
    ctrls.forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > pr.right + 1 || r.left < pr.left - 1)) issues.push('창 밖으로 나감: ' + (e.innerText || e.id).slice(0, 12)); });
    for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
      const a = ctrls[i], b = ctrls[j];
      if (a.contains(b) || b.contains(a) || a.closest('.foot') || b.closest('.foot')) continue;   // 고정 버튼 줄 밑 스크롤은 의도된 구조
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), o = inter(ra, rb);
      if (o > 0 && o / Math.min(ra.width * ra.height, rb.width * rb.height) > 0.2) {
        const d = (e, r) => e.outerHTML.slice(0, 90) + ' [' + [r.left, r.top, r.width, r.height].map(Math.round) + ']';
        issues.push('컨트롤끼리 겹침: ' + d(a, ra) + ' <-> ' + d(b, rb));
      }
    }
    return issues;
  });
  const closeAll = () => page.evaluate(() => { panelOpen = null; try { closePanel(); } catch (e) {} });
  const found = [];
  for (const f of ['sofa', 'lamp', 'shelf', 'calendar', 'mirror', 'window']) {
    await closeAll();
    await page.evaluate(n => openF(n), f);
    await page.waitForTimeout(450);
    (await audit()).forEach(i => found.push(f + ': ' + i));
  }
  await closeAll();
  await page.evaluate(() => enterVillage());
  await page.waitForFunction('VIEW==="village"');
  await page.waitForTimeout(500);
  for (const f of ['board', 'fire:new']) {
    await closeAll();
    await page.evaluate(n => openV(n), f);
    await page.waitForTimeout(500);
    (await audit()).forEach(i => found.push(f + ': ' + i));
  }
  // 게시판의 초대 코드 입력칸과 입장 전 확인 카드 (결정 #95)
  await closeAll();
  await page.evaluate(() => { openV('board'); panelView.join = { code: '', err: '', preview: null }; renderPanel(); });
  await page.waitForTimeout(300);
  (await audit()).forEach(i => found.push('board+코드칸: ' + i));
  await page.evaluate(() => { document.getElementById('jl').value = S.news.find(x => x.kind === 'OPEN').inviteCode; return joinCheck(); });
  await page.waitForTimeout(300);
  if (!(await page.locator('#joinPreview').count())) found.push('입장 전 확인 카드가 없음');
  (await audit()).forEach(i => found.push('board+확인카드: ' + i));
  // 모닥불을 피운 뒤 보이는 초대 링크·초대 코드·[코드 복사] 줄
  await closeAll();
  await page.evaluate(() => { openV('fire:new'); panelView.nf.kind = 'OWN'; createRoom(); });
  await page.waitForTimeout(400);
  if (!(await page.locator('#invCode').count())) found.push('초대 코드 줄이 없음');
  (await audit()).forEach(i => found.push('개설 뒤 초대 코드: ' + i));
  expect(found).toEqual([]);
  expect(errors).toEqual([]);
});
