// 공유방 · 개설·초대·보관·알림 버튼 동작, 시간 되면 열고 닫기, 이벤트 연결 (shared-room.js에서 이어진다)

// ===== 개설·초대·보관·알림 버튼 =====
function sharedRoomAction(act, b) {
  if (act === 'cmClose') {
    panelView.sheet = null;
    renderPanel();
    return true;
  }
  if (act === 'alarm') {
    const n = S.news.find((x) => x.id === b.dataset.id);
    if (API.enabled) {
      serverRoomAct(n, 'alarm', (m) => {
        if (!m || !m.alarm) return;
        if (notifyState() === 'ask') askNotify();
        toast(
          notifyState() === 'off' || notifyState() === 'none'
            ? '브라우저 알림이 꺼져 있어요. 열려 있을 때 화면으로만 알려드려요'
            : '개방되면 알려드릴게요',
        );
      });
      return true;
    }
    n.alarm = !n.alarm;
    save();
    if (n.alarm && notifyState() === 'ask') askNotify();
    render();
    renderPanel();
    if (n.alarm)
      toast(
        notifyState() === 'off' || notifyState() === 'none'
          ? '브라우저 알림이 꺼져 있어요. 열려 있을 때 화면으로만 알려드려요'
          : '개방되면 알려드릴게요',
      );
    return true;
  }
  if (rcAct(act, b)) return true;
  if (act === 'newRoom') {
    openV('fire:new');
    return true;
  }
  if (act === 'joinWithCode') {
    openV('board');
    panelView.join = { code: '', err: '', preview: null };
    renderPanel();
    const i = document.getElementById('jl');
    if (i) i.focus();
    return true;
  }
  if (act === 'joinOpen') {
    panelView.join = { code: '', err: '', preview: null };
    renderPanel();
    const i = document.getElementById('jl');
    if (i) i.focus();
    return true;
  }
  if (act === 'joinCheck') {
    joinCheck();
    return true;
  }
  if (act === 'joinConfirm') {
    joinConfirm();
    return true;
  }
  if (act === 'copyCode') {
    const n = S.news.find((x) => x.id === b.dataset.id);
    if (n && n.inviteCode) copyCode(n);
    return true;
  }
  if (act === 'rkind') {
    panelView.nf.kind = b.dataset.v;
    renderPanel();
    return true;
  }
  if (act === 'rstart') {
    panelView.nf.start = b.dataset.v;
    renderPanel();
    return true;
  }
  if (act === 'rhours') {
    panelView.nf.hours = +b.dataset.v;
    renderPanel();
    return true;
  }
  if (act === 'rvis') {
    panelView.nf.vis = b.dataset.v;
    renderPanel();
    return true;
  }
  if (act === 'rcreate') {
    createRoom();
    return true;
  }
  if (act === 'copyLink') {
    const n = S.news.find((x) => x.id === b.dataset.id);
    if (n) {
      copyLink(n);
      b.classList.add('done');
      b.innerHTML = ICON_CHECK;
      setTimeout(() => {
        b.classList.remove('done');
        b.innerHTML = ICON_COPY;
      }, 1500);
    }
    return true;
  }
  if (act === 'shareLink') {
    const n = S.news.find((x) => x.id === b.dataset.id);
    if (n) navigator.share({ title: '모닥불에 초대해요', text: n.title, url: inviteLink(n) }).catch(() => {});
    return true;
  }
  if (act === 'friendIn') {
    const n = S.news.find((x) => x.id === b.dataset.id);
    if (!n) return true;
    if (n.people >= n.max) {
      toast('정원이 가득 찼어요 (' + n.people + '/' + n.max + '명)');
      return true;
    }
    n.people++;
    n.members.push(NAMEPOOL.find((x) => !n.members.includes(x)) || '@친구');
    save();
    if (VIEW === 'shared' && G3) G3.setView('shared', n);
    render();
    renderPanel();
    toast('친구가 들어왔어요 (' + n.people + '/' + n.max + '명)');
    return true;
  }
  if (act === 'closeRoom') {
    const n = S.news.find((x) => x.id === b.dataset.id);
    if (!n) return true;
    if (API.enabled) {
      const camp = VIEW === 'shared' && CAMP_ID === n.id;
      serverRoomAct(n, 'close', () => {
        toast(n.kind === 'SOON' ? '모닥불을 취소했어요' : '모닥불을 일찍 껐어요. 마을 게시판에 7일 동안 남아요');
        if (camp) endCampToPlaza(0);
        closePanel();
      });
      return true;
    }
    if (n.kind === 'SOON') {
      S.news = S.news.filter((x) => x !== n);
      toast('모닥불을 취소했어요');
    } else {
      n.kind = 'CLOSED';
      n.closesAt = Date.now();
      n.deleteAt = Date.now() + 7 * DAY;
      toast('모닥불을 일찍 껐어요. 마을 게시판에 7일 동안 남아요');
      if (VIEW === 'shared' && CAMP_ID === n.id) {
        const m = recordCampTime(n, Date.now());
        endCampToPlaza(m);
      }
    }
    save();
    render();
    buildSr();
    closePanel();
    return true;
  }
  if (act === 'openNow') {
    const n = S.news.find((x) => x.id === b.dataset.id);
    n.opensAt = Date.now();
    fireDue();
    return true;
  }
  if (act === 'import') {
    const n = S.news.find((x) => x.id === b.dataset.id);
    if (API.enabled) {
      serverRoomAct(n, 'import', (m, res) => {
        if (!res) return;
        const bk = [S.reading, ...S.finished, ...S.dropped, ...S.later].find((x) => x && x.id === res.bookId);
        const t = bk ? bk.title : '책';
        toast(
          res.bookCreated
            ? '『' + t + '』' + eulReul(t) + ' "나중에 읽을 책"에 담고 공유방 기록을 같이 넣었어요'
            : res.bookStatus === 'READING'
              ? '『' + t + '』' + eulReul(t) + ' 읽는 중이라, 다 읽으면 책장에 공유방 탭이 생겨요'
              : '『' + t + '』에 공유방 탭이 생겼어요',
        );
        if (bk) loadBookRooms(bk.id).catch(() => {});
      });
      return true;
    }
    if (rcEmpty(n)) {
      toast('가져올 대화가 없어요');
      return true;
    }
    if (!n.book) {
      toast('이 방에는 내 책이 정해지지 않아서 가져올 곳이 없어요');
      return true;
    }
    const rec = { title: n.title, period: n.period, rtype: n.rtype, messages: rcSnapshot(n) }; // 다른 참여자는 익명, 삭제된 글은 뺀다
    // 내가 읽은 책(다 읽은 책·포기한 책·읽는 중)에 있으면 거기에 붙이고, 없으면 "나중에 읽을 책"에 담는다 (다 읽은 책으로 세지 않는다)
    let bk = S.finished.find((x) => x.title === n.book) || S.dropped.find((x) => x.title === n.book),
      msg = '『' + n.book + '』에 공유방 탭이 생겼어요';
    if (!bk && S.reading && S.reading.title === n.book) {
      bk = S.reading;
      if (!bk.rooms) bk.rooms = [];
      msg = '『' + n.book + '』' + eulReul(n.book) + ' 읽는 중이라, 다 읽으면 책장에 공유방 탭이 생겨요';
    }
    if (!bk) {
      bk = S.later.find((x) => x.title === n.book);
      if (!bk) {
        bk = {
          id: Date.now(),
          title: n.book,
          author: n.author || '',
          cover: n.cover || '',
          isbn: n.isbn || '',
          addedAt: ymd(),
          notes: [],
          rooms: [],
        };
        S.later.push(bk);
        msg = '『' + n.book + '』' + eulReul(n.book) + ' "나중에 읽을 책"에 담고 공유방 기록을 같이 넣었어요';
      }
    }
    if (!bk.rooms) bk.rooms = [];
    bk.rooms.push(rec);
    n.done = true;
    save();
    render();
    renderPanel();
    toast(msg);
    return true;
  }
  return false;
}

function fireSharedRoomsDue() {
  // 종료 후 7일이 지난 공유방은 사라진다 (가져온 기록은 내 서재에 남는다)
  // 내가 만든 모닥불은 기간이 끝나면 종료되고, 그때부터 7일 보관된다
  S.news.forEach((n) => {
    if (n.kind === 'OPEN' && n.closesAt && Date.now() >= n.closesAt) {
      n.kind = 'CLOSED';
      n.deleteAt = Date.now() + 7 * DAY;
      if (VIEW === 'shared' && CAMP_ID === n.id) {
        const m = recordCampTime(n, n.closesAt);
        campSince = 0;
        endCampToPlaza(m);
      }
      save();
      buildSr();
      render();
      if (panelOpen && panelOpen !== 'plaza') renderPanel();
    }
  });
  const nb = S.news.length;
  S.news = S.news.filter((n) => !(n.kind === 'CLOSED' && n.deleteAt && Date.now() >= n.deleteAt));
  if (S.news.length !== nb) {
    save();
    render();
    buildSr();
    if (panelOpen && panelOpen !== 'plaza') renderPanel();
  }
  S.news.forEach((n) => {
    if (n.kind === 'SOON' && n.opensAt && Date.now() >= n.opensAt) {
      n.kind = 'OPEN';
      n.sub = '지금 열렸어요';
      if (n.alarm && !n.notified) {
        n.notified = true;
        notify('이야기방이 열렸어요', n.title, 'room-' + n.id, () => openF('window'));
      }
      save();
      render();
      if (panelOpen === 'window') renderPanel();
    }
  });
}

function bindSharedRoomEvents() {
  setInterval(() => {
    const l = S.news.filter((n) => n.kind === 'OPEN' && n.agreed && n.members.length);
    if (l.length && Math.random() < 0.6) rcFakeMsg(l[Math.floor(Math.random() * l.length)]);
  }, 12000);

  S.news.forEach(rcNorm);
  save();

  document.getElementById('campExit').addEventListener('click', askExitCamp);

  document.getElementById('campChatToggle').addEventListener('click', toggleCampChat);

  // 배경의 ☁ 참여자 · 🌙 방 정보 버튼: 대화창은 그대로 두고 별도 모달로 연다 (모달의 ✕는 그 창만 닫는다). 같은 버튼을 다시 누르면 닫힌다
  document.getElementById('campSide').addEventListener('click', (e) => {
    const b = e.target.closest('[data-camp]');
    if (!b || VIEW !== 'shared') return;
    panelView.sheet = panelView.sheet === b.dataset.camp ? null : b.dataset.camp;
    panelView.leaveAsk = false;
    panelView.exitAsk = false;
    renderPanel();
  });
  document.getElementById('campModal').addEventListener('click', (e) => {
    if (e.target.id === 'campModal') {
      panelView.sheet = null;
      renderPanel();
    }
  });

  panel.addEventListener('change', (e) => {
    if (e.target.id === 'rbook') {
      panelView.nf.bookSel = e.target.value;
      renderPanel();
    }
  });
  panel.addEventListener('input', (e) => {
    if (e.target.id === 'rc') panelView.draft = e.target.value;
    if (e.target.id === 'rname') panelView.nf.name = e.target.value;
    if (e.target.id === 'rmax') panelView.nf.max = e.target.value;
    if (e.target.id === 'rbookt') panelView.nf.bookTitle = e.target.value;
    if (e.target.id === 'rwhen') panelView.nf.when = e.target.value;
  });
  panel.addEventListener('keydown', (e) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      canHover &&
      e.target.id === 'rc' &&
      !e.isComposing
    ) // 마우스 기기만 Enter로 보낸다. 폰(터치)은 Enter가 줄바꿈이고 [보내기]로 보낸다
    {
      e.preventDefault();
      const n = S.news.find((x) => 'room:' + x.id === panelOpen);
      if (n) rcSend(n);
    }
  });

  document.getElementById('campModalPanel').addEventListener('click', onPanelClick);

  // 초대 링크(#join=코드)로 열면 그 모닥불로 들어간다
  (function () {
    const m = /#join=([A-Za-z0-9]+)/.exec(location.hash);
    if (m) {
      history.replaceState(null, '', location.href.split('#')[0]);
      if (API.enabled)
        PENDING_JOIN = m[1]; // 로그인이 끝난 뒤에 들어간다 (rooms.js)
      else setTimeout(() => joinByCode(m[1]), 700);
    }
  })();
}
