// 공유방 · 대화 데이터와 화면(글 목록·보내기·참여자·방 정보·방 창) (shared-room.js에서 이어진다)

// ===== 공유방 대화 (결정 #38, 기능 정의서 RC-01~RC-17) =====
const MAXMSG = 300;
const NAMEPOOL = [
  '@나무',
  '@달빛',
  '@구름',
  '@바다',
  '@모래',
  '@하늘',
  '@바람',
  '@여울',
  '@노을',
  '@이끼',
  '@솔',
  '@봄비',
  '@담쟁이',
  '@반딧불',
  '@물결',
  '@새벽',
  '@고래',
  '@해님',
  '@도토리',
  '@별빛',
  '@안개',
  '@돌담',
  '@산들',
  '@풀잎',
  '@종이배',
  '@낮달',
  '@오솔길',
  '@소나기',
  '@온새미',
  '@아침',
];
const BOOKPOOL = ['아몬드', '어린 왕자', '사피엔스', '채식주의자', '불편한 편의점', '모순', '데미안', '82년생 김지영'];
const ROOM_SAY = [
  '처음엔 느리게 읽히다가 중반부터 확 빨려 들어갔어요',
  '이 장면에서 한참 멈춰 있었어요',
  '문장이 너무 좋아서 밑줄 쳤어요',
  '저는 이 인물이 이해되면서도 답답했어요',
  '여기까지 읽은 분 계세요?',
  '다음 장이 기대돼요',
  '잠깐 덮어 두고 생각 좀 했어요',
  '오늘은 여기까지 읽고 쉴게요',
  '마음에 남는 문장이 있어요',
  '예상 못 한 전개였어요',
  '분위기가 확 달라지는 부분이었어요',
  '같이 읽으니까 끝까지 읽게 돼요',
];
const rcKey = (s) => String(s || '').replace(/[『』\s]/g, '');
const roomBook = (n) => n.book || shortTitle(n);
const rcMine = (m) => m.who === '나' && !m.left;
const tagBook = (t) => {
  t = String(t || '').trim();
  return t.length > 8 ? t.split(/\s+/)[0] : t;
}; // 제목이 8자를 넘으면 맨 앞 단어만
// 각자 읽기 방은 이름 옆에 그 사람이 읽는 책을 붙인다. 서버 연결 모드는 참여자 명단의 실제 책(없으면 붙이지 않는다, 결정 #92)
const rcBookTag = (n, name) => {
  if (n.rtype !== 'OWN') return '';
  if (!API.enabled && name === '나') return ' 『' + tagBook(n.book) + '』';
  if (name === '나') return n.myBook ? ' 『' + tagBook(n.myBook) + '』' : ''; // 서버 연결 모드의 n.book은 방 이름이라 쓰지 않는다
  if (!API.enabled) return ' 『' + tagBook(BOOKPOOL[rcHash(name) % BOOKPOOL.length]) + '』';
  const p = (n.parts || []).find((x) => x.nickname === name);
  return p && p.bookTitle ? ' 『' + tagBook(p.bookTitle) + '』' : '';
};
const rcName = (m) => (m.left ? '나간 참여자' : m.who === '나' ? S.user.nickname : m.who);
const rcHash = (s) => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
const rcColor = (s) => SPINE[rcHash(s) % SPINE.length];
const rcEmpty = (n) => n.messages && !(n.srv && !n.msgLoaded) && !n.messages.some((m) => !m.del); // 서버 방은 글을 열어 보기 전에는 비었다고 단정하지 않는다
// 내 읽기 위치: 다 읽었거나 포기한 책이면 전부 열림(all), 읽는 중이면 현재 쪽, 아니면 쪽수 없음
function myPos(n) {
  const b = rcKey(roomBook(n));
  if ([...S.finished, ...S.dropped].some((x) => rcKey(x.title) === b)) return { all: true };
  if (S.reading && rcKey(S.reading.title) === b) return { page: S.reading.page > 0 ? S.reading.page : null };
  return { page: null };
}
// 스포 안내 (RC-06, #43): 대화는 전부 보인다. 같은 책 방인데 내가 완독·포기하지 않은 책이면 입장 전과 대화 위에서 스포를 알리고, 그 자리에서 "나중에 읽을 책"에 담을 수 있다
function rcSpoil(n) {
  if (n.rtype === 'OWN' || !n.book) return false;
  const k = rcKey(roomBook(n));
  return ![...S.finished, ...(S.dropped || [])].some((b) => rcKey(b.title) === k);
}
const rcLater = (n) => S.later.some((b) => rcKey(b.title) === rcKey(roomBook(n)));
function rcUnread(n) {
  if (n.srv) return !!n.unread; // 새 글 별은 서버가 센다 (rooms.js)
  return !!(n.agreed && n.kind === 'OPEN' && n.messages.some((m) => !m.del && !rcMine(m) && m.ts > (n.lastRead || 0)));
}
const rcPage = (n) => {
  if (panelView.pg !== undefined) return panelView.pg;
  const p = myPos(n);
  return p.all ? null : p.page;
};
const rcMembersOf = (n, c) => {
  const o = rcHash(n.id) % NAMEPOOL.length;
  return Array.from(
    { length: Math.max(0, Math.min(c, NAMEPOOL.length)) },
    (_, i) => NAMEPOOL[(o + i) % NAMEPOOL.length],
  );
};
// 옛 형식 방을 대화용 필드로 보정하고, 열린 남의 방에는 시연용 글을 몇 개 깔아 둔다
function rcNorm(n) {
  if (n.srv) return; // 서버의 방은 서버가 준 값 그대로 쓴다 (가짜 참여자·대화를 채우지 않는다)
  if (!n.rtype) n.rtype = 'SAME';
  if (!n.book) n.book = shortTitle(n);
  if (!n.max || n.max > RMAX) n.max = RMAX; // 방 최대 인원은 10명까지 (예전에 더 크게 만든 방도 맞춘다)
  if (!n.people) {
    const m = /(\d+)명/.exec(n.sub || '');
    n.people = m ? +m[1] : n.mine ? 1 : n.kind === 'CLOSED' ? 3 : 12;
  }
  if (!n.inviteCode) n.inviteCode = genCode();
  if (!n.members) n.members = n.mine ? [] : rcMembersOf(n, n.people - 1);
  if (n.owner === undefined) n.owner = n.mine ? '나' : n.members[0] || '';
  if (!n.messages) n.messages = [];
  n.messages.forEach((m, i) => {
    if (!m.id) m.id = 'm' + n.id + '_' + i;
    if (!m.ts) m.ts = Date.now() - (n.messages.length - i) * 5 * 3600e3;
  });
  if (n.agreed === undefined) n.agreed = n.kind === 'CLOSED' && n.messages.length > 0;
  if (n.lastRead === undefined) n.lastRead = 0;
  if (n.kind === 'OPEN' && !n.mine && !n.seeded && !n.messages.length && n.members.length) {
    n.seeded = true;
    [12, 34, 52, 88, 121, 160, 205, 260].forEach((pg, i) =>
      n.messages.push({
        id: 'm' + n.id + 's' + i,
        who: n.members[i % n.members.length],
        text: ROOM_SAY[i % ROOM_SAY.length],
        page: n.rtype === 'OWN' ? null : pg,
        ts: Date.now() - (8 - i) * 4 * 3600e3,
      }),
    );
  }
}
// 모닥불 장면에 있을 때 글을 보내거나 받으면 그 사람 머리 위에 말풍선을 띄운다.
function campBubble(n, m) {
  if (VIEW !== 'shared' || CAMP_ID !== n.id || !G3 || m.del) return;
  const i = rcMine(m) ? -1 : n.members.indexOf(m.who);
  if (i > 8 || (i < 0 && !rcMine(m))) return; // 화면에는 나를 뺀 최대 9명만 있다
  const t = m.text.length > 40 ? m.text.slice(0, 40) + '…' : m.text;
  G3.say(i, t);
}
function rcFakeMsg(n) {
  if (API.enabled || !n.members.length) return; // 체험판 시연용. 서버 연결 모드에서 실제 참여자 이름으로 글을 지어내면 안 된다 (결정 #92)
  const who = n.members[Math.floor(Math.random() * n.members.length)],
    p = myPos(n).page;
  let page = null;
  if (n.rtype !== 'OWN')
    page = p ? Math.max(1, Math.round(p + Math.random() * 100 - 25)) : Math.round(10 + Math.random() * 300);
  const fm = {
    id: 'm' + Date.now() + Math.floor(Math.random() * 99),
    who,
    text: ROOM_SAY[Math.floor(Math.random() * ROOM_SAY.length)],
    page,
    ts: Date.now(),
  };
  n.messages.push(fm);
  campBubble(n, fm);
  if (n.messages.length > 300) n.messages.splice(0, n.messages.length - 300);
  const viewing = panelOpen === 'room:' + n.id && (panelView.tab || 'chat') === 'chat';
  if (viewing) n.lastRead = Date.now();
  save();
  render();
  if (viewing) rcRefresh(n);
}
// 체험판: 참여 중인 열린 방에 가짜 참여자가 가끔 글을 보낸다
// 가져오기 스냅샷: 삭제된 글만 뺀다
function rcSnapshot(n) {
  const names = {};
  let k = 0;
  return n.messages
    .filter((m) => !m.del)
    .map((m) => {
      if (rcMine(m)) return { who: '나', text: m.text, page: m.page };
      const key = m.left ? '나간' : m.who;
      if (!names[key]) names[key] = '참여자 ' + String.fromCharCode(65 + (k++ % 26));
      return { who: names[key], text: m.text, page: m.page };
    });
}
function rcLogHtml(n) {
  const live = n.messages.filter((m) => !m.del);
  let out = '',
    day = '',
    div = false;
  const newN = panelView.readAt ? live.filter((m) => !rcMine(m) && m.ts > panelView.readAt).length : 0;
  if (!live.length && !n.messages.length)
    return n.kind === 'CLOSED'
      ? '<p class="muted">대화가 없는 방이에요.</p>'
      : '<p class="muted">아직 아무 글이 없어요. 첫 마디를 남겨 보세요.</p>';
  n.messages.forEach((m) => {
    const d = mmdd(m.ts);
    if (d !== day) {
      out += `<div class="rd">${d}</div>`;
      day = d;
    }
    if (!div && newN && !m.del && !rcMine(m) && m.ts > panelView.readAt) {
      out += `<div class="rnew" id="rcNew">새 글 ${newN}개</div>`;
      div = true;
    }
    if (m.del) {
      out += `<div class="rm del">삭제된 글</div>`;
      return;
    }
    const mine = rcMine(m);
    out +=
      `<div class="rm${mine ? ' me' : ''}"><div class="rm-h"><i style="background:${rcColor(m.left ? '나간' : m.who)}"></i><b>${esc(rcName(m))}</b>${m.who === n.owner && !m.left ? CROWN : ''}${m.page != null ? `<span class="pg">${m.page}쪽</span>` : ''}<time>${hhmm(m.ts)}</time></div>` +
      `<div class="rm-t">${esc(m.text)}</div>` +
      `</div>`;
  });
  return out;
}
function rcRefresh(n, force) {
  const lg = document.getElementById('rcLog');
  if (!lg) return;
  const atBottom = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 40;
  lg.innerHTML = rcLogHtml(n);
  const dn = document.getElementById('rcDown');
  if (force || atBottom) {
    lg.scrollTop = lg.scrollHeight;
    if (dn) dn.style.display = 'none';
  } else if (dn) dn.style.display = 'inline-block';
}
function rcAfter(id) {
  const n = S.news.find((x) => x.id === id);
  if (!n || !n.agreed || (panelView.tab || 'chat') !== 'chat') return;
  roomChatOpened(n); // 서버의 글을 받기 시작한다 (rooms-chat.js)
  const lg = document.getElementById('rcLog');
  if (lg) {
    const nw = document.getElementById('rcNew');
    lg.scrollTop = nw ? Math.max(0, nw.offsetTop - 8) : lg.scrollHeight;
  }
  if (rcUnread(n)) {
    n.lastRead = Date.now();
    save();
    render();
  }
}
function rcSpoilBar(n) {
  if (!rcSpoil(n)) return '';
  return `<div class="rspoil bar"><span class="grow">📖 안 읽은 책 · 스포 주의</span>${rcLater(n) ? '<span>담았어요 ✓</span>' : `<button data-act="rcLater" data-id="${n.id}">나중에 읽을 책에 담기</button>`}</div>`;
}
function rcBand(n) {
  if (n.kind !== 'CLOSED') return '';
  const left = roomLeft(n),
    k = Math.max(0.3, Math.min(1, left / 7));
  const act = n.done
    ? '<span class="muted">내 서재로 가져옴 ✓</span>'
    : rcEmpty(n)
      ? '<span class="muted">가져올 대화가 없어요</span>'
      : `<button class="primary" data-act="import" data-id="${n.id}">내 서재로 가져오기</button>`;
  return `<div class="rband${left <= 1 ? ' hot' : ''}"><span style="font-size:${Math.round(14 + 16 * k)}px">🔥</span><div class="grow"><b>종료됐어요 · 가져오기 마감 D-${left}</b><div class="muted">${left <= 1 ? '내일 사라져요' : '불이 꺼지면 기록이 사라져요'}</div></div>${act}</div>`;
}
function rcFoot(n) {
  if (n.kind !== 'OPEN') return '';
  let chip = '';
  if (n.rtype !== 'OWN' && !(rcSpoil(n) && rcPage(n) == null)) {
    const pg = rcPage(n); // 안 읽은 책이라 내 쪽수가 없으면 쪽수 칸을 두지 않는다
    chip = panelView.chipEdit
      ? `<div class="row" style="margin-bottom:6px"><input id="rcPg" type="number" min="1" max="9999" value="${pg ?? ''}" placeholder="쪽수" style="width:90px"><button data-act="rcChipOk">적용</button><button data-act="rcChipNone">쪽수 빼기</button></div>`
      : `<div style="margin-bottom:6px"><button class="rchip" data-act="rcChip">📖 ${pg != null ? pg + '쪽' : '쪽수 없음'}</button>${pg == null ? ' <span class="muted rhint">소파에서 쪽수를 적으면 글에 붙어요</span>' : ''}</div>`;
  }
  return `<div class="foot">${chip}<div class="row"><textarea id="rc" rows="2" maxlength="${MAXMSG}" placeholder="이야기를 남겨요" style="flex:1;resize:none">${esc(panelView.draft || '')}</textarea><button class="primary" data-act="rcSend" style="white-space:nowrap">보내기</button></div><div class="muted" id="rcE" style="margin-top:4px"></div></div>`;
}
function rcSend(n) {
  if (API.enabled) return serverRoomSend(n); // 글은 서버가 받는다 (rooms-chat.js)
  const ta = document.getElementById('rc'),
    e = document.getElementById('rcE'),
    t = ta.value.trim().slice(0, MAXMSG);
  if (!t) return;
  const gate = chatGate('room', t);
  if (gate) {
    e.textContent = gate;
    return;
  }
  const pg = n.rtype === 'OWN' ? null : rcPage(n);
  const mm = { id: 'm' + Date.now(), who: '나', text: t, page: pg ?? null, ts: Date.now() };
  n.messages.push(mm);
  campBubble(n, mm);
  if (n.messages.length > 300) n.messages.splice(0, n.messages.length - 300);
  chatMark('room', t);
  panelView.draft = '';
  ta.value = '';
  e.textContent = '';
  n.lastRead = Date.now();
  save();
  render();
  rcRefresh(n, true);
  ta.focus();
}
const CROWN =
  '<svg class="crown" viewBox="0 0 24 24" width="15" height="15" role="img" aria-label="방장"><title>방장</title><path d="M3.2 17.6 2.6 8.4 8 12.4 12 5.6 16 12.4 21.4 8.4 20.8 17.6Z" fill="#f4bb42" stroke="#9c6320" stroke-width="1.4" stroke-linejoin="round"/><rect x="3.2" y="17.6" width="17.6" height="3.2" rx="1.3" fill="#e0952f" stroke="#9c6320" stroke-width="1.4"/><circle cx="2.6" cy="7.6" r="1.5" fill="#fff1c0" stroke="#9c6320" stroke-width="1.1"/><circle cx="12" cy="4.8" r="1.6" fill="#fff1c0" stroke="#9c6320" stroke-width="1.1"/><circle cx="21.4" cy="7.6" r="1.5" fill="#fff1c0" stroke="#9c6320" stroke-width="1.1"/></svg>'; // 방을 연 사람(방장) 표시. 직접 그린 왕관 (작게 써도 또렷하도록 굵은 윤곽선)
function rcMembersHtml(n) {
  const rows = [
    { name: S.user.nickname + ' (나)', owner: n.owner === '나' },
    ...n.members.map((x) => ({
      name: x,
      owner: x === n.owner,
      book:
        n.rtype !== 'OWN'
          ? ''
          : API.enabled // 서버 연결 모드는 그 사람이 고른 실제 책 (결정 #92)
            ? ((n.parts || []).find((p) => p.nickname === x) || {}).bookTitle || ''
            : BOOKPOOL[rcHash(x) % BOOKPOOL.length],
    })),
  ];
  return (
    `<div class="muted" style="margin-bottom:6px">참여 ${n.people}/${n.max}명</div><div class="rgrid">` +
    rows
      .map(
        (r) =>
          `<div class="rmem"><div class="row"><i style="width:10px;height:10px;border-radius:50%;background:${rcColor(r.name.replace(' (나)', ''))};display:inline-block;flex:none"></i><b style="font-weight:normal">${esc(r.name)}</b>${r.owner ? CROWN : ''}</div>${r.book ? `<div class="muted rbk">『${esc(r.book)}』</div>` : ''}</div>`,
      )
      .join('') +
    '</div>' +
    '<p class="muted">다른 사람의 진행 정도는 보이지 않아요. 글에 붙은 쪽수만 보여요.</p>'
  );
}
function rcInfoHtml(n, split) {
  // split이면 [본문, 아래 고정 버튼]을 돌려준다
  const state =
    n.kind === 'OPEN'
      ? n.rtype === 'OWN'
        ? '각자 읽는 책 이야기를 나누는 모닥불이에요.'
        : '모닥불이 활활 타고 있어요. 같은 책을 읽은 사람들이 모여 있어요.'
      : n.kind === 'SOON'
        ? '아직 불이 붙지 않았어요. 열리면 모닥불에 불이 붙어요.'
        : '불이 작아지고 있어요. ' + roomLeft(n) + '일 뒤에 꺼지고 기록이 사라져요. 그 전에 내 서재로 가져오세요.';
  const kv = [
    ['종류', n.rtype === 'OWN' ? '각자 읽기' : '같은 책 방' + (n.book ? '' : ' · 책을 아직 안 정했어요')],
    ...(n.rtype === 'OWN' ? [['내가 읽는 책', (API.enabled ? n.myBook : n.book) ? '『' + esc(API.enabled ? n.myBook : n.book) + '』' : '아직 안 정했어요']] : []), // 서버 연결 모드의 n.book은 방 이름이라 참여자 명단의 내 책을 쓴다 (결정 #92)
    ...(n.period ? [['기간', esc(n.period)]] : []),
    ['공개 범위', n.vis === 'public' ? '마을에 공개' : '초대 코드·링크로만'],
  ];
  let h = `<p class="muted">${state}</p><div class="rkv">${kv.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>`;
  if (n.kind !== 'CLOSED') h += inviteBlock(n);
  let a = '',
    tl = '';
  if (n.mine && n.kind !== 'CLOSED')
    a += `<button style="width:100%;margin-top:6px;color:var(--danger)" data-act="closeRoom" data-id="${n.id}">${n.kind === 'SOON' ? '모닥불 취소' : '일찍 끝내기'}</button>`;
  if (n.kind === 'OPEN' && (n.agreed || n.mine) && !API.enabled)
    tl = `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">테스트 도구</summary><div class="row wrap" style="margin-top:8px">${n.agreed && n.rtype !== 'OWN' ? `<button data-act="rcTest" data-id="${n.id}" data-v="sofa">이 책을 소파에 올리기</button><button data-act="rcTest" data-id="${n.id}" data-v="page">내 쪽 +30쪽</button>` : ''}${n.agreed ? `<button data-act="rcTest" data-id="${n.id}" data-v="msg">새 글 도착시키기</button>` : ''}${n.mine ? `<button data-act="friendIn" data-id="${n.id}">친구 1명 들어오기</button>` : ''}</div><p class="muted">친구는 정원이 차면 더 들어올 수 없어요.</p></details>`;
  const tail = '<p class="muted" style="margin-top:10px">공유방 기록은 종료 후 7일 동안만 보관돼요.</p>';
  return split ? [h + tl + tail, a] : h + a + tl + tail;
}
function roomPanel(id) {
  const n = S.news.find((x) => x.id === id);
  if (!n) return head('모닥불') + '<p class="muted">이 공유방은 사라졌어요.</p>';
  const t = shortTitle(n);
  if (panelView.readAt === undefined) panelView.readAt = n.lastRead || 0;
  if (n.locked)
    return (
      head(t) +
      roomCard(n, false, true) +
      `<p class="muted">${esc(n.owner || '방장')}님이 피운 모닥불이에요. 들어가려면 방을 만든 사람에게 받은 초대 코드가 필요해요.</p>` // 결정 #97
    );
  if (n.kind === 'SOON') return head(t) + roomCard(n, false, true) + rcInfoHtml(n); // RC-01 예정 방
  if (!n.agreed) {
    if (n.kind === 'CLOSED')
      return head(t) + roomCard(n, true, true) + '<p class="muted">참여하지 않은 방이라 기록을 볼 수 없어요.</p>';
    return (
      head(t) +
      roomCard(n, true, true) +
      `<div class="card"><b>들어가기 전에</b><p style="margin:6px 0 0">이 방의 글은 종료 후 7일 뒤에 사라져요. 내 서재로 가져가면 다른 사람 이름은 '참여자 A'처럼 바뀌어요.</p>${rcSpoil(n) ? '<p class="rspoil">📖 아직 읽지 않은 책이에요. 대화에 줄거리나 결말이 나올 수 있어요. 들어가서 내용을 보고 "나중에 읽을 책"에 담을 수도 있어요.</p>' : ''}</div><div class="foot"><div class="row"><button class="grow" data-act="rcNo">취소</button><button class="primary grow" data-act="rcAgree" data-id="${n.id}">동의하고 들어가기</button></div></div>`
    );
  } // RC-03
  if (panelView.exitAsk)
    return (
      head(t, true) +
      `<div class="card"><b>모닥불에서 나갈까요?</b><p style="margin:6px 0 0">마을로 돌아가요. 방에서 나가는 건 아니고, 대화는 그대로 남아요.</p></div><div class="foot"><div class="row"><button class="grow" data-act="campStay">계속 있기</button><button class="primary grow" data-act="campLeave">마을로 나가기</button></div></div>`
    );
  const tab = VIEW === 'shared' ? 'chat' : panelView.tab || 'chat'; // 모닥불 장면의 대화창은 항상 대화만 (참여자·방 정보는 별도 모달)
  const state =
    n.kind === 'CLOSED' ? '종료 · D-' + roomLeft(n) : n.closesAt ? clockEnd(n.closesAt) + ' 종료' : '진행 중';
  const tabs = `<div class="seg rtabs">${[
    ['chat', '대화'],
    ['members', '참여자'],
    ['info', '방 정보'],
  ]
    .map(([v, l]) => `<button data-act="rctab" data-v="${v}" class="${tab === v ? 'on' : ''}">${l}</button>`)
    .join('')}</div>`;
  let body = '';
  if (tab === 'chat')
    body =
      rcBand(n) +
      rcSpoilBar(n) +
      `<div class="rlog" id="rcLog">${rcLogHtml(n)}</div><div style="text-align:center"><button class="rchip" id="rcDown" data-act="rcDown" style="display:none">↓ 맨 아래로</button></div>` +
      rcFoot(n);
  if (tab === 'members') body = rcMembersHtml(n);
  if (tab === 'info') body = rcInfoHtml(n);
  const camp = VIEW === 'shared';
  // 책 제목은 한 화면에 한 번만: 장면에서는 위 제목줄이, 모달에서는 창 제목이 맡는다
  const bk =
    n.rtype === 'OWN'
      ? '각자 읽기 · '
      : !camp || rcKey(n.title).includes(rcKey(roomBook(n)))
        ? ''
        : '『' + esc(roomBook(n)) + '』 · ';
  return (
    head(camp ? '대화' : t, true) +
    `<div class="rsub">${bk}참여 ${n.people}/${n.max}명 · ${state}</div>` +
    (camp ? '' : tabs) +
    body
  );
}
