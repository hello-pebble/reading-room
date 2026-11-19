// 시작 순서: 브라우저 알림, 이벤트·타이머 연결(bind*), 채팅 도배 방지. 앞의 base·state·stage·render·panel.js를 먼저 읽는다

function entryFlash() {
  if (!window.matchMedia('(hover: none)').matches) return;
  ORDER.forEach((f, i) =>
    setTimeout(
      () => {
        hl(f, true);
        setTimeout(() => hl(f, false), 350);
      },
      300 + i * 180,
    ),
  );
}
// 브라우저 알림: 이 페이지를 열어 둔 동안 온다. 창을 닫은 뒤에도 받으려면 서버 푸시가 필요하다 (DATA_API.md).
function notifyState() {
  if (!('Notification' in window)) return 'none';
  return Notification.permission === 'granted' ? 'on' : Notification.permission === 'denied' ? 'off' : 'ask';
}
function askNotify() {
  if (!('Notification' in window)) return Promise.resolve();
  return Promise.resolve(Notification.requestPermission()).then(() => {
    if (panelOpen) renderPanel();
  });
}
function notify(title, body, tag, onclick) {
  if (notifyState() === 'on') {
    try {
      const n = new Notification(title, { body, tag, icon: G3 ? G3.snap(S.avatar, 'head') : undefined });
      n.onclick = () => {
        window.focus();
        n.close();
        if (onclick) onclick();
      };
      return;
    } catch (e) {}
  }
  toast(title + ' · ' + body); // 알림을 못 보낼 때는 화면 안내로 대신한다
}
function fireDue() {
  const ses = S.session;
  if (ses) {
    if (ses.status === 'NEEDS_CONFIRM' && !ses.notifiedConfirm) {
      ses.notifiedConfirm = true;
      save();
      notify(
        '확인이 필요해요',
        fmtClock(ses.startedAt) + '에 켠 스탠드가 아직 켜져 있어요. 언제까지 읽었는지 알려 주세요.',
        'confirm',
        () => openF('lamp'),
      );
    } else if (
      ses.status === 'RUNNING' &&
      Date.now() - ses.lastCheckAt >= CHECK &&
      ses.notifiedAt !== ses.lastCheckAt
    ) {
      ses.notifiedAt = ses.lastCheckAt;
      save();
      notify(
        '아직 읽고 있어요?',
        (S.reading ? '『' + S.reading.title + '』을 ' : '') + '읽은 지 60분이 지났어요. 계속 읽고 있나요?',
        'check',
      );
    }
  }

  fireSharedRoomsDue();
}
bindSharedRoomEvents();
bindVillageEvents();
bindRoomEvents();
bindRoomTimer();
bindNeighborEvents();
// 채팅 도배 방지 (결정 #61, 서버와 같은 규칙): 3초에 3건까지, 내 직전 글과 같은 글은 30초 안에 다시 못 보낸다.
// 광장과 공유방은 따로 센다. chatGate는 막을 이유(문구)를 돌려주고, 보낸 뒤에는 chatMark로 남긴다. 막힌 시도는 세지 않는다.
const CHAT_WINDOW = 3000,
  CHAT_MAX = 3,
  CHAT_DUP = 30000,
  chatLog = { plaza: [], room: [] };
function chatGate(kind, text, now = Date.now()) {
  const log = chatLog[kind];
  while (log.length && now - log[0].t >= CHAT_DUP) log.shift();
  if (log.filter((x) => now - x.t < CHAT_WINDOW).length >= CHAT_MAX) return '조금 뒤에 보내 주세요';
  const last = log[log.length - 1];
  if (last && last.text === text.trim()) return '같은 말을 연달아 보낼 수 없어요';
  return '';
}
function chatMark(kind, text, now = Date.now()) {
  chatLog[kind].push({ t: now, text: text.trim() });
}
setInterval(fireDue, 5000);
render();
renderPanel();
entryFlash();
checkSession(true);
