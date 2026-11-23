// 내 방 · 책 찾기: 제목·저자·ISBN 검색과 서버 검색 주소 연결 (room.js에서 이어진다)

// 책 검색: 제목·저자·ISBN, 또는 ISBN이 들어 있는 책 링크. 인터넷이 없으면 직접 입력한다.
// ISBN-10이면 13자리로 바꾼다 (978 + 앞 9자리 + 검사 숫자). 올바른 ISBN이 아니면 빈 문자열
function toIsbn13(s) {
  s = String(s).replace(/[-\s]/g, '').toUpperCase();
  if (/^97[89]\d{10}$/.test(s)) {
    let t = 0;
    for (let i = 0; i < 12; i++) t += +s[i] * (i % 2 ? 3 : 1);
    return (10 - (t % 10)) % 10 === +s[12] ? s : '';
  }
  if (/^\d{9}[\dX]$/.test(s) && [...s].reduce((t, c, i) => t + (c === 'X' ? 10 : +c) * (10 - i), 0) % 11 === 0) {
    const b = '978' + s.slice(0, 9);
    let t = 0;
    for (let i = 0; i < 12; i++) t += +b[i] * (i % 2 ? 3 : 1);
    return b + ((10 - (t % 10)) % 10);
  }
  return '';
}
async function searchBooks(q) {
  q = q.trim();
  if (!q) return { err: '검색어를 적어 주세요' };

  let query = q,
    isbn = '';
  if (/^https?:\/\//i.test(q)) {
    const m = q.match(/97[89]\d{10}|(?<!\d)\d{9}[\dXx](?!\d)/);
    if (!m) return { err: '이 링크에서 책을 찾지 못했어요. 제목으로 찾아 보세요' };
    isbn = toIsbn13(m[0]);
    query = 'isbn:' + (isbn || m[0]);
  } else if (/^[\dXx\s-]{10,17}$/.test(q)) {
    isbn = toIsbn13(q);
    if (!isbn) return { err: 'ISBN이 올바르지 않아요. 숫자 10자리 또는 13자리를 확인해 주세요' };
    query = 'isbn:' + isbn;
  }
  // 서버 검색 주소를 넣으면 한국 책은 국립중앙도서관(백엔드 GET /books/search)에서 먼저 찾고, 실패하면 아래 구글 북스·Open Library로 넘어간다
  if (BOOK_SEARCH_URL) {
    try {
      const res = await fetch(BOOK_SEARCH_URL + '?q=' + encodeURIComponent(q));
      if (res.status === 400) return { err: (await res.json()).message };
      if (res.ok)
        return {
          items: (await res.json()).map((x) => ({
            title: x.title,
            author: x.author || '',
            pages: x.totalPages || 0,
            isbn: x.isbn || '',
            cover: x.coverUrl || '',
          })),
        };
    } catch (e) {}
  }
  const get = async (url) => {
    const ctl = new AbortController(),
      tm = setTimeout(() => ctl.abort(), 7000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(tm);
    }
  };
  // 1순위: 구글 북스 (키 없이 쓰면 공용 한도가 금방 차서 자주 실패한다. BOOK_API_KEY에 키를 넣으면 안정적)
  const viaGoogle = async () => {
    const j = await get(
      'https://www.googleapis.com/books/v1/volumes?maxResults=6&printType=books&q=' +
        encodeURIComponent(query) +
        (BOOK_API_KEY ? '&key=' + BOOK_API_KEY : ''),
    );
    return (j.items || [])
      .map((it) => {
        const v = it.volumeInfo || {},
          ids = v.industryIdentifiers || [];
        return {
          title: v.title || '',
          author: (v.authors || []).join(', '),
          pages: v.pageCount || 0,
          isbn: (ids.find((x) => x.type === 'ISBN_13') || ids[0] || {}).identifier || '',
          cover: ((v.imageLinks || {}).thumbnail || '').replace(/^http:/, 'https:').replace('&edge=curl', ''),
        };
      })
      .filter((x) => x.title);
  };
  // 2순위: Open Library (키 없음. ISBN으로는 잘 찾고, 한국어 제목 검색은 약하다)
  const viaOpenLibrary = async () => {
    const j = await get(
      'https://openlibrary.org/search.json?limit=6&fields=title,author_name,number_of_pages_median,isbn,cover_i&q=' +
        encodeURIComponent(query),
    );
    return (j.docs || [])
      .map((d) => ({
        title: d.title || '',
        author: (d.author_name || []).join(', '),
        pages: d.number_of_pages_median || 0,
        isbn: (d.isbn || []).find((x) => x.length === 13) || (d.isbn || [])[0] || '',
        cover: d.cover_i ? 'https://covers.openlibrary.org/b/id/' + d.cover_i + '-M.jpg' : '',
      }))
      .filter((x) => x.title);
  };
  // ISBN으로 찾을 때는 Open Library의 정확한 ISBN 조회를 쓴다(검색 API는 다른 판을 섞어 준다)
  const viaOpenLibraryIsbn = async () => {
    const j = await get('https://openlibrary.org/api/books?format=json&jscmd=data&bibkeys=ISBN:' + isbn),
      d = j['ISBN:' + isbn];
    return d && d.title
      ? [
          {
            title: d.title,
            author: (d.authors || []).map((a) => a.name).join(', '),
            pages: d.number_of_pages || 0,
            isbn,
            cover: (d.cover || {}).medium || '',
          },
        ]
      : [];
  };
  let items = [],
    failed = 0;
  const sources = isbn
    ? [async () => (await viaGoogle()).map((x) => ({ ...x, isbn })), viaOpenLibraryIsbn]
    : [viaGoogle, viaOpenLibrary];
  for (const f of sources) {
    try {
      items = await f();
      if (items.length) break;
    } catch (e) {
      failed++;
    }
  }
  if (items.length) return { items };
  if (failed >= 2)
    return {
      err: navigator.onLine
        ? '책 정보를 가져오지 못했어요. 아래에 직접 적어 주세요'
        : '인터넷에 연결되어 있지 않아요. 아래에 직접 적어 주세요',
    };
  return { items: [] };
}
// 백엔드 책 검색 주소. 주소 끝에 ?searchApi=http://localhost:8080/books/search 를 붙여 한 번 열면 저장된다(지우려면 ?searchApi=). 비어 있으면 서버 없이 구글 북스·Open Library만 쓴다
const BOOK_SEARCH_URL = (() => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('searchApi')) {
      const v = q.get('searchApi');
      v ? localStorage.setItem('rr-search-url', v) : localStorage.removeItem('rr-search-url');
    }
    // 서버 연결 모드(?api=)에서는 따로 정하지 않아도 그 서버의 책 검색(국립중앙도서관)을 쓴다. ?searchApi=로 정한 주소가 있으면 그쪽이 먼저다
    return localStorage.getItem('rr-search-url') || (API.enabled ? API.base + '/books/search' : '');
  } catch (e) {
    return API.enabled ? API.base + '/books/search' : '';
  }
})();
const BOOK_API_KEY = ''; // 구글 북스 API 키 (선택)
// 서점 검색(카카오) 결과에는 쪽수가 없어서, 고른 책의 ISBN으로 서버(국립중앙도서관)에서 쪽수·표지를 채운다.
// 이미 적은 쪽수·표지는 덮어쓰지 않고, 조회가 안 되면 아무것도 바꾸지 않는다(직접 적으면 된다).
async function fillBookDetails(isbn) {
  if (!BOOK_SEARCH_URL || !isbn) return;
  try {
    const res = await fetch(BOOK_SEARCH_URL + '?q=' + encodeURIComponent(isbn));
    if (!res.ok) return;
    const x = (await res.json())[0];
    if (!x || panelView.isbn !== isbn || panelOpen !== 'sofa') return; // 그 사이 다른 책을 골랐거나 창을 닫았다
    let changed = false;
    if (!(+panelView.tp > 0) && x.totalPages) ((panelView.tp = x.totalPages), (changed = true));
    if (!panelView.cover && x.coverUrl) ((panelView.cover = x.coverUrl), (changed = true));
    if (changed) renderPanel();
  } catch (e) {}
}
async function runSearch() {
  panelView.msg = '찾는 중…';
  panelView.res = null;
  renderPanel();
  const r = await searchBooks(panelView.q || '');
  if (panelOpen !== 'sofa' || S.reading) return;
  if (r.err) {
    panelView.msg = r.err;
  } else if (!r.items.length) {
    panelView.msg = '찾지 못했어요. 아래에 직접 적어 주세요';
  } else {
    panelView.msg = '';
    panelView.res = r.items;
  }
  renderPanel();
}
