// 책 · 서버 연결 모드(?api=)의 책·메모·완독/포기 불러오기와 저장 (서버 연결 2단계). ?api가 없으면 아무것도 하지 않는다.
// 서버가 기준이다: 저장이 실패하면 화면 상태는 바꾸지 않고 서버가 준 문구를 보여 준다. 스탠드 타이머(시간 기록)는 다음 단계다.
let BOOK_SAVE_DELAY = 600; // 쪽수 입력은 멈춘 뒤 이만큼(ms) 기다렸다가 한 번만 서버에 저장한다
const BOOK_BUSY = {};

// 서버의 시각(UTC)을 화면의 날짜 모양('2026.11.05', 한국 시간)으로
function kstYmd(iso) {
  if (!iso) return '';
  const [y, m, d] = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).split('-');
  return y + '.' + +m + '.' + d;
}
const noteFromServer = (n) => ({ id: n.id, type: n.type, content: n.content, page: n.page, at: kstYmd(n.createdAt) });
// 서버의 책 → 화면 상태 S의 책 모양. 공유방 기록(rooms)은 공유방 연결 단계에서 채운다.
function bookFromServer(b, notes) {
  const book = {
    id: b.id,
    title: b.title,
    author: b.author || '',
    cover: b.coverUrl || '',
    isbn: b.isbn || '',
    totalPages: b.totalPages || null,
    page: b.currentPage,
    progress: b.percent == null ? 0 : b.percent,
    notes: notes || [],
    rooms: [],
    startedAt: kstYmd(b.startedAt),
  };
  if (b.status !== 'READING')
    Object.assign(book, { rating: b.rating || 0, review: b.oneLineReview || '', finishedAt: kstYmd(b.finishedAt) });
  return book;
}

// 로그인한 뒤(와 새로고침 때) 서버의 책·메모로 화면 상태를 채운다. 데모 책은 사라진다.
async function loadBooks() {
  const [reading, done, dropped, later] = await Promise.all(
    ['READING', 'DONE', 'DROPPED', 'LATER'].map((s) => API.get('/books?status=' + s)),
  );
  const withNotes = async (b) => bookFromServer(b, (await API.get('/books/' + b.id + '/notes')).slice().reverse()); // 서버는 새 메모부터 준다
  const byDate = (x, y) => new Date(x.finishedAt) - new Date(y.finishedAt);
  S.reading = reading[0] ? await withNotes(reading[0]) : null;
  S.finished = await Promise.all(done.sort(byDate).map(withNotes));
  S.dropped = await Promise.all(dropped.sort(byDate).map(withNotes));
  S.later = later.map((b) => ({ ...bookFromServer(b, []), addedAt: kstYmd(b.startedAt) }));
  save();
  render();
  if (panelOpen) renderPanel();
}

// 소파에 책 올리기 (제목·저자 확인은 roomAction이 이미 했다)
async function serverAddBook(title, author, totalPages) {
  if (BOOK_BUSY.add) return;
  BOOK_BUSY.add = true;
  try {
    const b = await API.post('/books', {
      title,
      author,
      isbn: panelView.isbn || undefined,
      coverUrl: panelView.cover || undefined,
      totalPages: totalPages || undefined,
      currentPage: 0,
    });
    S.reading = bookFromServer(b, []);
    panelView = {};
    if (S.onboard === 1) S.onboard = 2;
    save();
    render();
    renderPanel();
    toast('소파에 『' + title + '』을 올렸어요');
  } catch (e) {
    toast(e.message);
  } finally {
    BOOK_BUSY.add = false;
  }
}

// 현재 쪽·전체 쪽: 입력이 멈추면 한 번만 저장한다
let bookSaveTimer = null,
  bookSavePending = null;
function queueBookSave(r) {
  bookSavePending = { id: r.id, currentPage: r.page, totalPages: r.totalPages };
  clearTimeout(bookSaveTimer);
  bookSaveTimer = setTimeout(flushBookSave, BOOK_SAVE_DELAY);
}
async function flushBookSave() {
  clearTimeout(bookSaveTimer);
  const p = bookSavePending;
  bookSavePending = null;
  if (!p) return;
  const body = { totalPages: p.totalPages };
  if (p.currentPage != null) body.currentPage = p.currentPage;
  try {
    await API.patch('/books/' + p.id, body);
  } catch (e) {
    toast(e.message);
  }
}

// 메모·인용구 추가: 서버가 정한 현재 쪽·퍼센트를 따른다
async function serverAddNote(content, page) {
  const rd = S.reading;
  if (BOOK_BUSY.note) return;
  BOOK_BUSY.note = true;
  try {
    const n = await API.post('/books/' + rd.id + '/notes', {
      type: panelView.type || 'MEMO',
      content,
      page: page || undefined,
    });
    const raised = page && n.currentPage > (rd.page || 0);
    rd.notes.push(noteFromServer(n));
    rd.page = n.currentPage;
    rd.progress = n.percent == null ? 0 : n.percent;
    panelView.draft = '';
    if (raised) toast(page + '쪽까지 읽은 걸로 기록했어요' + (rd.totalPages ? ' (' + rd.progress + '%)' : ''));
    save();
    render();
    renderPanel();
  } catch (e) {
    toast(e.message);
  } finally {
    BOOK_BUSY.note = false;
  }
}
async function serverDelNote(i) {
  const rd = S.reading,
    n = rd.notes[i];
  if (!n || !n.id) return;
  try {
    await API.del('/books/' + rd.id + '/notes/' + n.id);
    rd.notes.splice(i, 1);
    save();
    renderPanel();
  } catch (e) {
    toast(e.message);
  }
}
// 스탠드를 끌 때 적은 쪽수·한 줄 메모도 서버에 저장한다
async function syncStandStop(r, memo) {
  queueBookSave(r);
  if (!memo) return;
  try {
    r.notes.push(noteFromServer(await API.post('/books/' + r.id + '/notes', { type: 'MEMO', content: memo })));
    save();
    if (panelOpen) renderPanel();
  } catch (e) {
    toast(e.message);
  }
}

// 완독·포기: 서버가 먼저 받아들여야 소파에서 책장으로 옮긴다
async function serverEndBook(kind, rating, review) {
  const r = S.reading;
  if (!r || BOOK_BUSY.end) return;
  BOOK_BUSY.end = true;
  try {
    await flushBookSave(); // 입력 중이던 쪽수를 먼저 저장한다
    const b = await API.post(
      '/books/' + r.id + (kind === 'finish' ? '/finish' : '/drop'),
      kind === 'finish' ? { rating: rating || undefined, oneLineReview: review || undefined } : {},
    );
    if (S.session) endSession(Date.now(), 'FINISH', true);
    (kind === 'finish' ? S.finished : S.dropped).push({ ...bookFromServer(b, r.notes), rooms: r.rooms || [] });
    S.reading = null;
    panelView = {};
    save();
    closePanel();
    render();
    if (kind === 'finish') {
      if (G3) G3.flash('shelf');
      toast('『' + r.title + '』을 책장에 꽂았어요');
    } else toast('소파를 비웠어요');
  } catch (e) {
    toast(e.message);
  } finally {
    BOOK_BUSY.end = false;
  }
}
