// 공용 · 기본 상태(defaultState), localStorage 불러오기·이관, 저장(save)

function defaultState() {
  return {
    user: { nickname: '조약돌', handle: 'pebble' },
    streak: 7,
    reading: null,
    finished: [
      {
        id: 1,
        title: '아몬드',
        author: '손원평',
        rating: 4,
        review: '감정을 배워가는 이야기라 오래 남았다',
        finishedAt: '10.12',
        notes: [
          { type: 'QUOTE', content: '누구도 무엇도 탓하지 않았다.', page: 88, at: '10.08' },
          { type: 'MEMO', content: '윤재가 곤이를 이해하는 장면에서 멈춰서 생각함', page: 150, at: '10.10' },
        ],
        rooms: [
          {
            title: '『아몬드』 같이 읽기',
            period: '10.13 ~ 10.20',
            messages: [
              { who: '나', text: '결말에서 엄마 장면이 제일 기억에 남았어요' },
              { who: '참여자 A', text: '저는 곤이 시점으로 다시 읽어보고 싶어졌어요' },
              { who: '참여자 B', text: '감정을 모른다는 설정이 오히려 감정을 더 크게 느끼게 했던 것 같아요' },
            ],
          },
        ],
      },
      {
        id: 2,
        title: '불편한 편의점',
        author: '김호연',
        rating: 3,
        review: '',
        finishedAt: '10.25',
        notes: [],
        rooms: [],
      },
      {
        id: 3,
        title: '어린 왕자',
        author: '생텍쥐페리',
        rating: 5,
        review: '볼 때마다 다른 문장이 보인다',
        finishedAt: '11.01',
        notes: [{ type: 'QUOTE', content: '가장 중요한 것은 눈에 보이지 않아.', page: 92, at: '11.01' }],
        rooms: [],
      },
      {
        id: 4,
        title: '사피엔스',
        author: '유발 하라리',
        rating: 4,
        review: '',
        finishedAt: '11.06',
        notes: [],
        rooms: [],
      },
      { id: 5, title: '채식주의자', author: '한강', rating: 4, review: '', finishedAt: '11.11', notes: [], rooms: [] },
    ],
    dropped: [],
    avatar: defAvatar(),
    unlocked: { glasses: true },
    newItem: true,
    session: null,
    sessions: [],
    recommendations: {},
    onboard: 0,
    seen: {},
    newsSeen: {},
    goals: {},
    plaza: [],
    later: [], // later: 나중에 읽을 책 (공유방에서 가져왔는데 내 책장에 없는 책)
    news: [
      { id: 'n1', kind: 'OPEN', title: '『작별하지 않는다』 같이 읽기', sub: '오늘 22:00 종료 · 12명 참여 중' },
      {
        id: 'n2',
        kind: 'SOON',
        title: '『소년이 온다』 이야기방',
        sub: '11.20 개방',
        alarm: false,
        opensAt: Date.UTC(2026, 10, 19, 15, 0, 0),
      },
      {
        id: 'n3',
        kind: 'CLOSED',
        title: '『불편한 편의점』 이야기방',
        sub: '가져오기 마감 D-2',
        deleteAt: Date.now() + 2 * 864e5,
        book: '불편한 편의점',
        author: '김호연',
        done: false,
        period: '11.03 ~ 11.10',
        messages: [
          { who: '나', text: '독고 씨가 변해가는 과정이 좋았어요' },
          { who: '참여자 A', text: '편의점이라는 공간이 하나의 동네처럼 느껴졌어요' },
        ],
      },
      {
        id: 'n4',
        kind: 'CLOSED',
        title: '『모순』 이야기방',
        sub: '가져오기 마감 D-5',
        deleteAt: Date.now() + 5 * 864e5,
        book: '모순',
        author: '양귀자',
        done: false,
        period: '11.06 ~ 11.13',
        messages: [
          { who: '나', text: '안진진의 선택이 이해되면서도 아팠어요' },
          { who: '참여자 A', text: '제목이 끝까지 읽어야 이해되는 책이었어요' },
        ],
      },
    ],
  };
}
let S;
try {
  S = JSON.parse(localStorage.getItem('myroom-proto-v1'));
} catch (e) {}
if (!S) S = defaultState();
if (!S.recommendations) S.recommendations = {}; // 이웃집별 미확인 추천 한 권. me는 내 집에 도착한 책
if (!S.roomLog) S.roomLog = [];
if (!S.sessions) S.sessions = [];
if (S.session === undefined) S.session = null;
if (S.reading && !S.reading.id) S.reading.id = Date.now();
if (!S.avatar || !S.avatar.expr) S.avatar = defAvatar();
if (!S.newsSeen) S.newsSeen = {};
// 월 목표 이력 (결정 #39): 예전의 한 값(S.goal)은 이번 달부터만 기록하고, 그 이전 달은 "목표 기록 없음"으로 둔다
if (!S.goals) {
  S.goals = {};
  if (S.goal >= 1)
    S.goals[new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(0, 7)] = {
      goal: Math.min(99, Math.round(S.goal)),
      changes: [],
    };
}
delete S.goal;
if (!S.later) S.later = [];
if (!S.plaza) S.plaza = [];
S.plaza = S.plaza.filter((m) => Date.now() - m.ts < 864e5); // 광장 대화는 하루 뒤 사라진다
S.news.forEach((n) => {
  if (n.kind === 'SOON' && !n.opensAt) n.opensAt = Date.UTC(2026, 10, 19, 15, 0, 0);
  if (n.kind === 'CLOSED' && !n.deleteAt) {
    const m = /D-(\d+)/.exec(n.sub || '');
    n.deleteAt = Date.now() + (m ? +m[1] : 3) * 864e5;
  }
});
// 완독일에 연도를 붙인다. 예전 저장값은 '월.일'뿐이라, 오늘(한국 시간) 이전에서 가장 가까운 그 날짜로 정한다
(() => {
  const [ty, tm, td] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).split('-').map(Number);
  [...S.finished, ...(S.dropped || [])].forEach((b) => {
    const m = /^(\d+)\.(\d+)$/.exec(b.finishedAt || '');
    if (m) {
      const mo = +m[1],
        d = +m[2];
      b.finishedAt = (mo > tm || (mo === tm && d > td) ? ty - 1 : ty) + '.' + mo + '.' + String(d).padStart(2, '0');
    }
  });
  // 메모·인용구 날짜, 읽기 시작일, 나중에 읽을 책 담은 날도 같은 방식으로 연도를 붙인다 (열린 결정 Q ①)
  const addY = (s) => {
    const m = /^(\d+)\.(\d+)$/.exec(s || '');
    return m
      ? (+m[1] > tm || (+m[1] === tm && +m[2] > td) ? ty - 1 : ty) + '.' + +m[1] + '.' + String(+m[2]).padStart(2, '0')
      : s;
  };
  [S.reading, ...S.finished, ...(S.dropped || []), ...S.later].filter(Boolean).forEach((b) => {
    if (b.startedAt) b.startedAt = addY(b.startedAt);
    if (b.addedAt) b.addedAt = addY(b.addedAt);
    (b.notes || []).forEach((n) => {
      if (n.at) n.at = addY(n.at);
    });
  });
})();
S.onboard = 0; // 첫 방문 안내는 평소에 뜨지 않고, 데모 초기화를 눌렀을 때만 뜬다
let saveBad = 0; // 저장이 막혀도 화면은 계속 쓰되, 한 번은 알린다 (setTimeout: 바로 뒤에 오는 성공 토스트가 덮어쓰지 못하게)
const save = () => {
  try {
    localStorage.setItem('myroom-proto-v1', JSON.stringify(S));
    saveBad = 0;
  } catch (e) {
    if (!saveBad) {
      saveBad = 1;
      setTimeout(() => toast('저장 공간이 부족하거나 막혀 있어요. 이 기록이 기기에 남지 않을 수 있어요'), 0);
    }
  }
};

