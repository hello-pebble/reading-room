// 공유방 · 대화 화면 버튼 동작(rcAct) (shared-room.js에서 이어진다)

// 대화 화면의 버튼들. 처리했으면 true
function rcAct(act, b) {
  const n =
    (b && b.dataset.id && S.news.find((x) => x.id === b.dataset.id)) ||
    S.news.find((x) => 'room:' + x.id === panelOpen); // data-id가 글 번호일 때는 지금 열린 방
  if (act === 'campToggle') {
    toggleCampChat();
    return true;
  }
  if (act === 'rcLater') {
    if (!n || rcLater(n)) return true;
    if (S.reading && rcKey(S.reading.title) === rcKey(roomBook(n))) {
      toast('이미 소파에서 읽고 있어요');
      return true;
    }
    S.later.push({
      id: Date.now(),
      title: n.book,
      author: n.author || '',
      cover: n.cover || '',
      isbn: n.isbn || '',
      addedAt: ymd(),
      notes: [],
      rooms: [],
    });
    save();
    toast('『' + roomBook(n) + '』을 "나중에 읽을 책"에 담았어요');
    renderPanel();
    return true;
  }
  if (act === 'campStay') {
    panelView.exitAsk = false;
    renderPanel();
    return true;
  }
  if (act === 'campLeave') {
    closePanel();
    return true;
  }
  if (act === 'enterRoom') {
    if (!n) return true;
    if (VIEW !== 'village') {
      closePanel();
      enterVillage();
      setTimeout(() => openV('room:' + n.id), 900);
    } else openV('room:' + n.id);
    return true;
  }
  if (act === 'rcNo') {
    closePanel();
    return true;
  }
  if (act === 'rcAgree') {
    if (!n) return true;
    if (API.enabled) {
      serverRoomAct(n, 'agree', (m) => {
        if (!m) return;
        panelView.readAt = m.lastRead || 0;
        renderPanel();
        enterCamp(m);
      });
      return true;
    }
    if (n.left && n.people >= n.max) {
      toast('정원이 가득 찼어요 (' + n.people + '/' + n.max + '명)');
      return true;
    }
    if (n.left) {
      n.people++;
      n.left = false;
    }
    n.agreed = true;
    n.agreedAt = Date.now();
    save();
    panelView.readAt = n.lastRead || 0;
    renderPanel();
    enterCamp(n);
    render();
    return true;
  }
  if (act === 'rctab') {
    panelView.tab = b.dataset.v;
    panelView.leaveAsk = false;
    renderPanel();
    return true;
  }
  if (act === 'rcChip') {
    panelView.chipEdit = true;
    renderPanel();
    const i = document.getElementById('rcPg');
    if (i) i.focus();
    return true;
  }
  if (act === 'rcChipOk') {
    const v = Math.round(+document.getElementById('rcPg').value);
    panelView.pg = v >= 1 && v <= 9999 ? v : null;
    panelView.chipEdit = false;
    renderPanel();
    return true;
  }
  if (act === 'rcChipNone') {
    panelView.pg = null;
    panelView.chipEdit = false;
    renderPanel();
    return true;
  }
  if (act === 'rcSend') {
    if (n) rcSend(n);
    return true;
  }
  if (act === 'rcDown') {
    const lg = document.getElementById('rcLog');
    if (lg) lg.scrollTop = lg.scrollHeight;
    b.style.display = 'none';
    return true;
  }
  if (act === 'rcLeaveAsk') {
    panelView.leaveAsk = true;
    renderPanel();
    return true;
  }
  if (act === 'rcLeaveNo') {
    panelView.leaveAsk = false;
    renderPanel();
    return true;
  }
  if (act === 'rcLeave') {
    if (!n) return true;
    if (API.enabled) {
      serverRoomAct(n, 'leave', () => {
        closePanel();
        toast('방에서 나왔어요. 내 글은 "나간 참여자"로 남아요');
      });
      return true;
    }
    n.messages.forEach((m) => {
      if (m.who === '나') m.left = true;
    });
    n.agreed = false;
    n.left = true;
    n.people = Math.max(1, n.people - 1);
    save();
    render();
    closePanel();
    toast('방에서 나왔어요. 내 글은 "나간 참여자"로 남아요');
    return true;
  }
  if (act === 'rcTest' && n) {
    const v = b.dataset.v,
      k = rcKey(roomBook(n));
    if (v === 'sofa') {
      if (S.reading && rcKey(S.reading.title) !== k) toast('소파에 다른 책이 있어요. 먼저 정리해 주세요');
      else if (!S.reading) {
        S.reading = {
          id: Date.now(),
          title: roomBook(n),
          author: n.author || '',
          cover: '',
          isbn: '',
          totalPages: 400,
          page: 0,
          progress: 0,
          notes: [],
          startedAt: today(),
        };
        save();
        render();
        toast('소파에 『' + roomBook(n) + '』을 올렸어요 (0쪽)');
      } else toast('이미 소파에 있어요');
    }
    if (v === 'page') {
      if (!S.reading || rcKey(S.reading.title) !== k) toast('먼저 소파에 이 책을 올려 주세요');
      else {
        S.reading.page = Math.min(S.reading.totalPages || 9999, (S.reading.page || 0) + 30);
        updProgress(S.reading);
        save();
        render();
        toast(S.reading.page + '쪽까지 읽은 걸로 기록했어요');
      }
    }
    if (v === 'msg') rcFakeMsg(n);
    return true;
  }
  return false;
}
