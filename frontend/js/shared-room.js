// 공유방: 모닥불 장면·개설·초대·대화·참여자·가져오기.
// 대화 버튼은 rcAct(), 나머지는 sharedRoomAction(), 초기 연결은 bindSharedRoomEvents().

const RMAX=10;  // 공유방 최대 인원: 의자 6 + 서 있는 자리 4 (결정 #54, #41의 20명을 대체)

const PUBLIC_ROOMS=false; // 베타는 초대만 (결정 #41, 열린 결정 M ②). 켜면 개설 창에 "마을에 공개" 선택지가 다시 나온다

const shortTitle=n=>String(n.title||n.book||'').replace(/[『』]/g,'').replace(/\s*(같이 읽기|이야기방)\s*$/,'').trim();
const HOUR=36e5,sameDay=(a,b)=>mmdd(a)===mmdd(b);
const clockEnd=t=>(sameDay(t,Date.now())?'':mmdd(t)+' ')+fmtClock(t);   // 오늘 끝나면 시각만, 다른 날이면 날짜도
const timeRange=(a,b)=>mmdd(a)+' '+fmtClock(a)+' ~ '+(sameDay(a,b)?'':mmdd(b)+' ')+fmtClock(b);
const roomLeft=n=>n.deleteAt?Math.max(0,Math.ceil((n.deleteAt-Date.now())/DAY)):0;
const roomSub=n=>{
 if(n.kind==='CLOSED'&&n.deleteAt)return (n.done?'가져옴 · ':'')+'가져오기 마감 D-'+roomLeft(n);
 if(n.mine&&n.kind==='SOON')return mmdd(n.opensAt)+' '+fmtClock(n.opensAt)+' 개방 · '+n.people+'/'+n.max+'명';
 if(n.mine&&n.kind==='OPEN')return clockEnd(n.closesAt)+' 종료 · '+n.people+'/'+n.max+'명 참여 중';
 return n.sub};

let campSince=0;
// 모닥불 장면에 머문 시간은 오늘 읽은 시간에 더한다. 스탠드 기록과 겹치는 구간은 한 번만 센다
function recordCampTime(n,end){
 const a=campSince;campSince=0;if(!a)return 0;
 end=Math.min(end,n&&n.closesAt?n.closesAt:end);
 let ms=Math.max(0,end-a);
 const ov=(s,e)=>Math.max(0,Math.min(e,end)-Math.max(s,a));
 S.sessions.forEach(x=>{ms-=ov(x.startedAt,x.endedAt||x.startedAt)});if(S.session)ms-=ov(S.session.startedAt,end);
 const min=Math.floor(Math.max(0,ms)/60000);if(min<1)return 0;
 S.sessions.push({id:end,bookId:S.reading?S.reading.id:null,startedAt:end-min*60000,endedAt:end,minutes:min,source:'CAMP',roomId:n?n.id:null});save();return min;
}
function enterCamp(n){
 if(!n||n.kind!=='OPEN'||!n.agreed||VIEW!=='village')return;
 CAMP_ID=n.id;campSince=Date.now();VIEW='shared';const i=Math.max(0,vilOrder().findIndex(x=>x.id===n.id)),[x,z]=VSLOTS[Math.min(i,VSLOTS.length-1)];
 Object.assign(sim,{x:-2.24,z:-1.28,y:.18,rot:Math.atan2(2.24,1.28),mode:'sit',sit:1,mv:0,after:null});
 const w=document.getElementById('stageWrap');w.classList.add('camp');w.appendChild(backdrop);backdrop.classList.add('camp');panel.setAttribute('aria-modal','false');
 
document.getElementById('campChatToggle').textContent='💬 대화 열기';
 if(G3)G3.setView('shared',n);buildSr();render();
 if(panelOpen)renderPanel();   // 장면이 바뀐 뒤 다시 그려야 대화창이 모닥불 장면용(대화만, 탭 없음)으로 나온다
}
// 시간이 다 돼서 모닥불이 꺼지면 장면에 있던 사람을 광장으로 보낸다
function endCampToPlaza(min){
 closePanel();CAMP_ID=null;VIEW='village';
 Object.assign(sim,{x:PLAZA.cx,z:PLAZA.cz+2.3,y:0,mode:'idle',sit:0,mv:0,rot:Math.PI/4,after:null});
 document.getElementById('stageWrap').classList.remove('camp','min');backdrop.classList.remove('camp','min');document.body.appendChild(backdrop);panel.setAttribute('aria-modal','true');
 if(G3)G3.setView('village');buildSr();render();
 toast('모닥불이 꺼졌어요. 광장으로 돌아왔어요'+(min?' · '+min+'분을 읽은 시간에 더했어요':''));
}
function leaveCamp(){
 if(VIEW!=='shared')return;
 recordCampTime(S.news.find(x=>x.id===CAMP_ID),Date.now());
 const i=Math.max(0,vilOrder().findIndex(x=>x.id===CAMP_ID)),[x,z]=VSLOTS[Math.min(i,VSLOTS.length-1)];
 CAMP_ID=null;VIEW='village';Object.assign(sim,{x:x+.9,z:z+.9,y:0,mode:'idle',sit:0,mv:0,rot:Math.PI/4,after:null});
 document.getElementById('stageWrap').classList.remove('camp','min');backdrop.classList.remove('camp','min');document.body.appendChild(backdrop);panel.setAttribute('aria-modal','true');
 if(G3)G3.setView('village');buildSr();render();
}
// 모닥불 장면에서 ✕·← 마을로·Esc를 누르면 바로 나가지 않고 한 번 묻는다 (접어 둔 상태면 창을 다시 펼쳐서 묻는다)
function askExitCamp(){if(VIEW!=='shared')return closePanel();if(backdrop.classList.contains('min'))toggleCampChat();panelView.sheet=null;panelView.exitAsk=true;renderPanel()}
function toggleCampChat(){if(VIEW!=='shared')return;const min=backdrop.classList.toggle('min');document.getElementById('stageWrap').classList.toggle('min',min);if(!min)focusPanel()}

// 모닥불 장면의 참여자·방 정보 모달 (대화창과 따로). panelView.sheet가 'members' 또는 'info'일 때만 뜬다
function renderCampModal(){
 const m=document.getElementById('campModal'),p=document.getElementById('campModalPanel'),v=panelView.sheet,n=S.news.find(x=>x.id===CAMP_ID);
 const on=VIEW==='shared'&&!!n&&(v==='members'||v==='info');
 m.classList.toggle('open',on);
 document.querySelectorAll('#campSide [data-camp]').forEach(b=>b.classList.toggle('on',on&&v===b.dataset.camp));
 if(!on){p.innerHTML='';return}
 const old=p.querySelector('.cm-body'),top=old?old.scrollTop:0,[body,foot]=v==='members'?[rcMembersHtml(n),'']:rcInfoHtml(n,true);
 p.innerHTML=`<div class="panel-head"><h2>${v==='members'?'참여자':'방 정보'}</h2><button class="ghost" data-act="cmClose" aria-label="닫기">✕</button></div><div class="cm-body">${body}</div>${foot?`<div class="foot">${foot}</div>`:''}`;
 const nb=p.querySelector('.cm-body');if(nb)nb.scrollTop=top;   // 다시 그려도 스크롤 위치를 지킨다
}

// 공유방 카드: 마을 게시판, 모닥불 창이 함께 쓴다
function roomCard(n,noAct,hideTitle){
 const K={OPEN:['진행 중',''],SOON:['예정','gray'],CLOSED:['종료','warn']}[n.kind];let act='';
 if(n.kind==='OPEN')act=`<button class="primary" data-act="enterRoom" data-id="${n.id}">들어가기</button>`;
 if(n.kind==='SOON')act=`<button data-act="alarm" data-id="${n.id}">${n.alarm?'알림 받는 중 ✓':'알림 받기'}</button>`;
 if(n.kind==='CLOSED')act=n.done?`<span class="muted">내 서재로 가져옴 ✓</span>`:(rcEmpty(n))?`<span class="muted">가져올 대화가 없어요</span>`:`<button class="primary" data-act="import" data-id="${n.id}">내 서재로 가져오기</button>`;
 if(noAct)act='';
 const tag=n.rtype?`<span class="badge gray">${n.rtype==='OWN'?'각자 읽기':'같은 책'}</span>`:'';
 return `<div class="card"><div class="row"><span class="badge ${K[1]}">${K[0]}</span>${tag}${rcUnread(n)?'<span class="badge">새 글</span>':''}${hideTitle?'':`<b class="grow" style="font-weight:normal">${esc(n.title)}</b>`}</div><div class="muted" style="margin:6px 0 8px">${esc(roomSub(n))}${n.period?' · '+esc(n.period):''}</div>${act}</div>`;
}

// ===== 모닥불 피우기 (공유방 개설) =====
const RDEF=()=>({kind:'SAME',bookSel:S.reading?'sofa':'',bookTitle:'',name:'',start:'now',when:'',hours:3,vis:'invite',max:8});
const nfBook=nf=>{
 if(nf.bookSel==='sofa'&&S.reading){const r=S.reading;return {title:r.title,author:r.author,cover:r.cover||'',isbn:r.isbn||''}}
 if(nf.bookSel&&nf.bookSel.startsWith('shelf:')){const b=S.finished[+nf.bookSel.slice(6)];return b?{title:b.title,author:b.author,cover:b.cover||'',isbn:b.isbn||''}:null}
 if(nf.bookSel==='typed'&&nf.bookTitle.trim())return {title:nf.bookTitle.trim(),author:'',cover:'',isbn:''};
 return null};
const defaultRoomName=nf=>{const b=nfBook(nf);return nf.kind==='SAME'?(b?'『'+b.title+'』 같이 읽기':'같이 읽기'):S.user.nickname+'의 모닥불'};
const inviteLink=n=>location.href.split('#')[0]+'#join='+n.inviteCode;
const genCode=()=>{const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<8;i++)s+=c[Math.floor(Math.random()*c.length)];return s};
// 직접 그린 단순한 아이콘 (복사: 겹친 사각형, 확인: 체크, 공유: 점 셋을 이은 모양)
const ICON_COPY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="8.5" width="12" height="13" rx="2.6"/><path d="M8.5 4.4h9a2.6 2.6 0 0 1 2.6 2.6v9.2"/></svg>',
ICON_CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
ICON_SHARE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.3 10.9l7.4-3.8M8.3 13.1l7.4 3.8"/></svg>';
// 초대 링크: 링크 칸 옆에 복사(공유) 아이콘 버튼. 상자로 감싸지 않고 참여자 창처럼 글자 중심으로 보인다
function inviteBlock(n){return `<div class="rinv"><div class="rlbl">초대 링크</div><div class="rcopy"><input id="invLink" readonly value="${esc(inviteLink(n))}" aria-label="초대 링크"><button class="ibtn" data-act="copyLink" data-id="${n.id}" aria-label="링크 복사" title="링크 복사">${ICON_COPY}</button>${navigator.share?`<button class="ibtn" data-act="shareLink" data-id="${n.id}" aria-label="공유" title="공유">${ICON_SHARE}</button>`:''}</div><div class="muted" style="margin-top:6px">초대 코드 ${n.inviteCode}${n.vis==='public'?' · 마을 게시판에도 보여요':''}</div><div class="muted">체험판에서는 이 브라우저에서 만든 모닥불만 열려요.</div></div>`}
// ===== 공유방 대화 (결정 #38, 기능 정의서 RC-01~RC-17) =====
const MAXMSG=300;
const NAMEPOOL=['@나무','@달빛','@구름','@바다','@모래','@하늘','@바람','@여울','@노을','@이끼','@솔','@봄비','@담쟁이','@반딧불','@물결','@새벽','@고래','@해님','@도토리','@별빛','@안개','@돌담','@산들','@풀잎','@종이배','@낮달','@오솔길','@소나기','@온새미','@아침'];
const BOOKPOOL=['아몬드','어린 왕자','사피엔스','채식주의자','불편한 편의점','모순','데미안','82년생 김지영'];
const ROOM_SAY=['처음엔 느리게 읽히다가 중반부터 확 빨려 들어갔어요','이 장면에서 한참 멈춰 있었어요','문장이 너무 좋아서 밑줄 쳤어요','저는 이 인물이 이해되면서도 답답했어요','여기까지 읽은 분 계세요?','다음 장이 기대돼요','잠깐 덮어 두고 생각 좀 했어요','오늘은 여기까지 읽고 쉴게요','마음에 남는 문장이 있어요','예상 못 한 전개였어요','분위기가 확 달라지는 부분이었어요','같이 읽으니까 끝까지 읽게 돼요'];
const rcKey=s=>String(s||'').replace(/[『』\s]/g,'');
const roomBook=n=>n.book||shortTitle(n);
const rcMine=m=>m.who==='나'&&!m.left;
const tagBook=t=>{t=String(t||'').trim();return t.length>8?t.split(/\s+/)[0]:t};   // 제목이 8자를 넘으면 맨 앞 단어만
const rcBookTag=(n,name)=>n.rtype==='OWN'?' 『'+tagBook(name==='나'?n.book:BOOKPOOL[rcHash(name)%BOOKPOOL.length])+'』':'';   // 각자 읽기 방은 이름 옆에 그 사람이 읽는 책을 붙인다
const rcName=m=>m.left?'나간 참여자':m.who==='나'?S.user.nickname:m.who;
const rcHash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h};
const rcColor=s=>SPINE[rcHash(s)%SPINE.length];
const rcEmpty=n=>n.messages&&!n.messages.some(m=>!m.del);
// 내 읽기 위치: 다 읽었거나 포기한 책이면 전부 열림(all), 읽는 중이면 현재 쪽, 아니면 쪽수 없음
function myPos(n){const b=rcKey(roomBook(n));
 if([...S.finished,...S.dropped].some(x=>rcKey(x.title)===b))return {all:true};
 if(S.reading&&rcKey(S.reading.title)===b)return {page:S.reading.page>0?S.reading.page:null};
 return {page:null}}
// 스포 안내 (RC-06, #43): 대화는 전부 보인다. 같은 책 방인데 내가 완독·포기하지 않은 책이면 입장 전과 대화 위에서 스포를 알리고, 그 자리에서 "나중에 읽을 책"에 담을 수 있다
function rcSpoil(n){if(n.rtype==='OWN'||!n.book)return false;const k=rcKey(roomBook(n));return ![...S.finished,...(S.dropped||[])].some(b=>rcKey(b.title)===k)}
const rcLater=n=>S.later.some(b=>rcKey(b.title)===rcKey(roomBook(n)));
function rcUnread(n){return !!(n.agreed&&n.kind==='OPEN'&&n.messages.some(m=>!m.del&&!rcMine(m)&&m.ts>(n.lastRead||0)))}
const rcPage=n=>{if(panelView.pg!==undefined)return panelView.pg;const p=myPos(n);return p.all?null:p.page}
const rcMembersOf=(n,c)=>{const o=rcHash(n.id)%NAMEPOOL.length;return Array.from({length:Math.max(0,Math.min(c,NAMEPOOL.length))},(_,i)=>NAMEPOOL[(o+i)%NAMEPOOL.length])};
// 옛 형식 방을 대화용 필드로 보정하고, 열린 남의 방에는 시연용 글을 몇 개 깔아 둔다
function rcNorm(n){
 if(!n.rtype)n.rtype='SAME';
 if(!n.book)n.book=shortTitle(n);
 if(!n.max||n.max>RMAX)n.max=RMAX;   // 방 최대 인원은 10명까지 (예전에 더 크게 만든 방도 맞춘다)
 if(!n.people){const m=/(\d+)명/.exec(n.sub||'');n.people=m?+m[1]:n.mine?1:n.kind==='CLOSED'?3:12}
 if(!n.inviteCode)n.inviteCode=genCode();
 if(!n.members)n.members=n.mine?[]:rcMembersOf(n,n.people-1);
 if(n.owner===undefined)n.owner=n.mine?'나':(n.members[0]||'');
 if(!n.messages)n.messages=[];
 n.messages.forEach((m,i)=>{if(!m.id)m.id='m'+n.id+'_'+i;if(!m.ts)m.ts=Date.now()-(n.messages.length-i)*5*3600e3});
 if(n.agreed===undefined)n.agreed=n.kind==='CLOSED'&&n.messages.length>0;
 if(n.lastRead===undefined)n.lastRead=0;
 if(n.kind==='OPEN'&&!n.mine&&!n.seeded&&!n.messages.length&&n.members.length){n.seeded=true;
  [12,34,52,88,121,160,205,260].forEach((pg,i)=>n.messages.push({id:'m'+n.id+'s'+i,who:n.members[i%n.members.length],text:ROOM_SAY[i%ROOM_SAY.length],page:n.rtype==='OWN'?null:pg,ts:Date.now()-(8-i)*4*3600e3}))}
}
// 모닥불 장면에 있을 때 글을 보내거나 받으면 그 사람 머리 위에 말풍선을 띄운다.
function campBubble(n,m){
 if(VIEW!=='shared'||CAMP_ID!==n.id||!G3||m.del)return;
 const i=rcMine(m)?-1:n.members.indexOf(m.who);if(i>8||(i<0&&!rcMine(m)))return;   // 화면에는 나를 뺀 최대 9명만 있다
 const t=m.text.length>40?m.text.slice(0,40)+'…':m.text;
 G3.say(i,t)}
function rcFakeMsg(n){
 if(!n.members.length)return;const who=n.members[Math.floor(Math.random()*n.members.length)],p=myPos(n).page;let page=null;
 if(n.rtype!=='OWN')page=p?Math.max(1,Math.round(p+Math.random()*100-25)):Math.round(10+Math.random()*300);
 const fm={id:'m'+Date.now()+Math.floor(Math.random()*99),who,text:ROOM_SAY[Math.floor(Math.random()*ROOM_SAY.length)],page,ts:Date.now()};n.messages.push(fm);campBubble(n,fm);
 if(n.messages.length>300)n.messages.splice(0,n.messages.length-300);
 const viewing=panelOpen==='room:'+n.id&&(panelView.tab||'chat')==='chat';if(viewing)n.lastRead=Date.now();
 save();render();if(viewing)rcRefresh(n)}
// 체험판: 참여 중인 열린 방에 가짜 참여자가 가끔 글을 보낸다
// 가져오기 스냅샷: 삭제된 글만 뺀다
function rcSnapshot(n){const names={};let k=0;return n.messages.filter(m=>!m.del).map(m=>{
 if(rcMine(m))return {who:'나',text:m.text,page:m.page};
 const key=m.left?'나간':m.who;if(!names[key])names[key]='참여자 '+String.fromCharCode(65+(k++%26));return {who:names[key],text:m.text,page:m.page}})}
function rcLogHtml(n){
 const live=n.messages.filter(m=>!m.del);let out='',day='',div=false;
 const newN=panelView.readAt?live.filter(m=>!rcMine(m)&&m.ts>panelView.readAt).length:0;
 if(!live.length&&!n.messages.length)return n.kind==='CLOSED'?'<p class="muted">대화가 없는 방이에요.</p>':'<p class="muted">아직 아무 글이 없어요. 첫 마디를 남겨 보세요.</p>';
 n.messages.forEach(m=>{
  const d=mmdd(m.ts);if(d!==day){out+=`<div class="rd">${d}</div>`;day=d}
  if(!div&&newN&&!m.del&&!rcMine(m)&&m.ts>panelView.readAt){out+=`<div class="rnew" id="rcNew">새 글 ${newN}개</div>`;div=true}
  if(m.del){out+=`<div class="rm del">삭제된 글</div>`;return}
  const mine=rcMine(m);
  out+=`<div class="rm${mine?' me':''}"><div class="rm-h"><i style="background:${rcColor(m.left?'나간':m.who)}"></i><b>${esc(rcName(m))}</b>${m.who===n.owner&&!m.left?CROWN:''}${m.page!=null?`<span class="pg">${m.page}쪽</span>`:''}<time>${hhmm(m.ts)}</time></div>`
   +`<div class="rm-t">${esc(m.text)}</div>`
   +`</div>`});
 return out}
function rcRefresh(n,force){const lg=document.getElementById('rcLog');if(!lg)return;
 const atBottom=lg.scrollHeight-lg.scrollTop-lg.clientHeight<40;lg.innerHTML=rcLogHtml(n);
 const dn=document.getElementById('rcDown');if(force||atBottom){lg.scrollTop=lg.scrollHeight;if(dn)dn.style.display='none'}else if(dn)dn.style.display='inline-block'}
function rcAfter(id){
 const n=S.news.find(x=>x.id===id);if(!n||!n.agreed||(panelView.tab||'chat')!=='chat')return;
 const lg=document.getElementById('rcLog');if(lg){const nw=document.getElementById('rcNew');lg.scrollTop=nw?Math.max(0,nw.offsetTop-8):lg.scrollHeight}
 if(rcUnread(n)){n.lastRead=Date.now();save();render()}}
function rcSpoilBar(n){if(!rcSpoil(n))return '';return `<div class="rspoil bar"><span class="grow">📖 안 읽은 책 · 스포 주의</span>${rcLater(n)?'<span>담았어요 ✓</span>':`<button data-act="rcLater" data-id="${n.id}">나중에 읽을 책에 담기</button>`}</div>`}
function rcBand(n){
 if(n.kind!=='CLOSED')return '';const left=roomLeft(n),k=Math.max(.3,Math.min(1,left/7));
 const act=n.done?'<span class="muted">내 서재로 가져옴 ✓</span>':rcEmpty(n)?'<span class="muted">가져올 대화가 없어요</span>':`<button class="primary" data-act="import" data-id="${n.id}">내 서재로 가져오기</button>`;
 return `<div class="rband${left<=1?' hot':''}"><span style="font-size:${Math.round(14+16*k)}px">🔥</span><div class="grow"><b>종료됐어요 · 가져오기 마감 D-${left}</b><div class="muted">${left<=1?'내일 사라져요':'불이 꺼지면 기록이 사라져요'}</div></div>${act}</div>`}
function rcFoot(n){
 if(n.kind!=='OPEN')return '';let chip='';
 if(n.rtype!=='OWN'&&!(rcSpoil(n)&&rcPage(n)==null)){const pg=rcPage(n);   // 안 읽은 책이라 내 쪽수가 없으면 쪽수 칸을 두지 않는다
  chip=panelView.chipEdit?`<div class="row" style="margin-bottom:6px"><input id="rcPg" type="number" min="1" max="9999" value="${pg??''}" placeholder="쪽수" style="width:90px"><button data-act="rcChipOk">적용</button><button data-act="rcChipNone">쪽수 빼기</button></div>`
   :`<div style="margin-bottom:6px"><button class="rchip" data-act="rcChip">📖 ${pg!=null?pg+'쪽':'쪽수 없음'}</button>${pg==null?' <span class="muted rhint">소파에서 쪽수를 적으면 글에 붙어요</span>':''}</div>`}
 return `<div class="foot">${chip}<div class="row"><textarea id="rc" rows="2" maxlength="${MAXMSG}" placeholder="이야기를 남겨요" style="flex:1;resize:none">${esc(panelView.draft||'')}</textarea><button class="primary" data-act="rcSend" style="white-space:nowrap">보내기</button></div><div class="muted" id="rcE" style="margin-top:4px"></div></div>`}
function rcSend(n){
 const ta=document.getElementById('rc'),e=document.getElementById('rcE'),t=ta.value.trim().slice(0,MAXMSG);if(!t)return;
 const gate=chatGate('room',t);if(gate){e.textContent=gate;return}
 const pg=n.rtype==='OWN'?null:rcPage(n);
 const mm={id:'m'+Date.now(),who:'나',text:t,page:pg??null,ts:Date.now()};n.messages.push(mm);campBubble(n,mm);if(n.messages.length>300)n.messages.splice(0,n.messages.length-300);
 chatMark('room',t);panelView.draft='';ta.value='';e.textContent='';n.lastRead=Date.now();save();render();rcRefresh(n,true);ta.focus()}
const CROWN='<svg class="crown" viewBox="0 0 24 24" width="15" height="15" role="img" aria-label="방장"><title>방장</title><path d="M3.2 17.6 2.6 8.4 8 12.4 12 5.6 16 12.4 21.4 8.4 20.8 17.6Z" fill="#f4bb42" stroke="#9c6320" stroke-width="1.4" stroke-linejoin="round"/><rect x="3.2" y="17.6" width="17.6" height="3.2" rx="1.3" fill="#e0952f" stroke="#9c6320" stroke-width="1.4"/><circle cx="2.6" cy="7.6" r="1.5" fill="#fff1c0" stroke="#9c6320" stroke-width="1.1"/><circle cx="12" cy="4.8" r="1.6" fill="#fff1c0" stroke="#9c6320" stroke-width="1.1"/><circle cx="21.4" cy="7.6" r="1.5" fill="#fff1c0" stroke="#9c6320" stroke-width="1.1"/></svg>';   // 방을 연 사람(방장) 표시. 직접 그린 왕관 (작게 써도 또렷하도록 굵은 윤곽선)
function rcMembersHtml(n){
 const rows=[{name:S.user.nickname+' (나)',owner:n.owner==='나'},...n.members.map(x=>({name:x,owner:x===n.owner,book:n.rtype==='OWN'?BOOKPOOL[rcHash(x)%BOOKPOOL.length]:''}))];
 return `<div class="muted" style="margin-bottom:6px">참여 ${n.people}/${n.max}명</div><div class="rgrid">`+rows.map(r=>`<div class="rmem"><div class="row"><i style="width:10px;height:10px;border-radius:50%;background:${rcColor(r.name.replace(' (나)',''))};display:inline-block;flex:none"></i><b style="font-weight:normal">${esc(r.name)}</b>${r.owner?CROWN:''}</div>${r.book?`<div class="muted rbk">『${esc(r.book)}』</div>`:''}</div>`).join('')+'</div>'
  +'<p class="muted">다른 사람의 진행 정도는 보이지 않아요. 글에 붙은 쪽수만 보여요.</p>'}
function rcInfoHtml(n,split){   // split이면 [본문, 아래 고정 버튼]을 돌려준다
 const state=n.kind==='OPEN'?(n.rtype==='OWN'?'각자 읽는 책 이야기를 나누는 모닥불이에요.':'모닥불이 활활 타고 있어요. 같은 책을 읽은 사람들이 모여 있어요.'):n.kind==='SOON'?'아직 불이 붙지 않았어요. 열리면 모닥불에 불이 붙어요.':'불이 작아지고 있어요. '+roomLeft(n)+'일 뒤에 꺼지고 기록이 사라져요. 그 전에 내 서재로 가져오세요.';
 const kv=[['종류',n.rtype==='OWN'?'각자 읽기':'같은 책 방'+(n.book?'':' · 책을 아직 안 정했어요')],...(n.rtype==='OWN'?[['내가 읽는 책',n.book?'『'+esc(n.book)+'』':'아직 안 정했어요']]:[]),...(n.period?[['기간',esc(n.period)]]:[]),['공개 범위',n.vis==='public'?'마을에 공개':'초대 링크로만']];
 let h=`<p class="muted">${state}</p><div class="rkv">${kv.map(([k,v])=>`<span>${k}</span><b>${v}</b>`).join('')}</div>`;
 if(n.kind!=='CLOSED')h+=inviteBlock(n);
 let a='',tl='';
 if(n.mine&&n.kind!=='CLOSED')a+=`<button style="width:100%;margin-top:6px;color:var(--danger)" data-act="closeRoom" data-id="${n.id}">${n.kind==='SOON'?'모닥불 취소':'일찍 끝내기'}</button>`;
 if(n.kind==='OPEN'&&(n.agreed||n.mine))tl=`<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">테스트 도구</summary><div class="row wrap" style="margin-top:8px">${n.agreed&&n.rtype!=='OWN'?`<button data-act="rcTest" data-id="${n.id}" data-v="sofa">이 책을 소파에 올리기</button><button data-act="rcTest" data-id="${n.id}" data-v="page">내 쪽 +30쪽</button>`:''}${n.agreed?`<button data-act="rcTest" data-id="${n.id}" data-v="msg">새 글 도착시키기</button>`:''}${n.mine?`<button data-act="friendIn" data-id="${n.id}">친구 1명 들어오기</button>`:''}</div><p class="muted">친구는 정원이 차면 더 들어올 수 없어요.</p></details>`;
 const tail='<p class="muted" style="margin-top:10px">공유방 기록은 종료 후 7일 동안만 보관돼요.</p>';
 return split?[h+tl+tail,a]:h+a+tl+tail}
function roomPanel(id){
 const n=S.news.find(x=>x.id===id);if(!n)return head('모닥불')+'<p class="muted">이 공유방은 사라졌어요.</p>';
 const t=shortTitle(n);
 if(panelView.readAt===undefined)panelView.readAt=n.lastRead||0;
 if(n.kind==='SOON')return head(t)+roomCard(n,false,true)+rcInfoHtml(n);                                   // RC-01 예정 방
 if(!n.agreed){
  if(n.kind==='CLOSED')return head(t)+roomCard(n,true,true)+'<p class="muted">참여하지 않은 방이라 기록을 볼 수 없어요.</p>';
  return head(t)+roomCard(n,true,true)+`<div class="card"><b>들어가기 전에</b><p style="margin:6px 0 0">이 방의 글은 종료 후 7일 뒤에 사라져요. 내 서재로 가져가면 다른 사람 이름은 '참여자 A'처럼 바뀌어요.</p>${rcSpoil(n)?'<p class="rspoil">📖 아직 읽지 않은 책이에요. 대화에 줄거리나 결말이 나올 수 있어요. 들어가서 내용을 보고 "나중에 읽을 책"에 담을 수도 있어요.</p>':''}</div><div class="foot"><div class="row"><button class="grow" data-act="rcNo">취소</button><button class="primary grow" data-act="rcAgree" data-id="${n.id}">동의하고 들어가기</button></div></div>`}   // RC-03
 if(panelView.exitAsk)return head(t,true)+`<div class="card"><b>모닥불에서 나갈까요?</b><p style="margin:6px 0 0">마을로 돌아가요. 방에서 나가는 건 아니고, 대화는 그대로 남아요.</p></div><div class="foot"><div class="row"><button class="grow" data-act="campStay">계속 있기</button><button class="primary grow" data-act="campLeave">마을로 나가기</button></div></div>`;
 const tab=VIEW==='shared'?'chat':(panelView.tab||'chat');   // 모닥불 장면의 대화창은 항상 대화만 (참여자·방 정보는 별도 모달)
 const state=n.kind==='CLOSED'?'종료 · D-'+roomLeft(n):(n.closesAt?clockEnd(n.closesAt)+' 종료':'진행 중');
 const tabs=`<div class="seg rtabs">${[['chat','대화'],['members','참여자'],['info','방 정보']].map(([v,l])=>`<button data-act="rctab" data-v="${v}" class="${tab===v?'on':''}">${l}</button>`).join('')}</div>`;
 let body='';
 if(tab==='chat')body=rcBand(n)+rcSpoilBar(n)+`<div class="rlog" id="rcLog">${rcLogHtml(n)}</div><div style="text-align:center"><button class="rchip" id="rcDown" data-act="rcDown" style="display:none">↓ 맨 아래로</button></div>`+rcFoot(n);
 if(tab==='members')body=rcMembersHtml(n);
 if(tab==='info')body=rcInfoHtml(n);
 const camp=VIEW==='shared';
 // 책 제목은 한 화면에 한 번만: 장면에서는 위 제목줄이, 모달에서는 창 제목이 맡는다
 const bk=n.rtype==='OWN'?'각자 읽기 · ':!camp||rcKey(n.title).includes(rcKey(roomBook(n)))?'':'『'+esc(roomBook(n))+'』 · ';
 return head(camp?'대화':t,true)+`<div class="rsub">${bk}참여 ${n.people}/${n.max}명 · ${state}</div>`+(camp?'':tabs)+body}
// 대화 화면의 버튼들. 처리했으면 true
function rcAct(act,b){
 const n=(b&&b.dataset.id&&S.news.find(x=>x.id===b.dataset.id))||S.news.find(x=>'room:'+x.id===panelOpen);   // data-id가 글 번호일 때는 지금 열린 방
 if(act==='campToggle'){toggleCampChat();return true}
 if(act==='rcLater'){if(!n||rcLater(n))return true;if(S.reading&&rcKey(S.reading.title)===rcKey(roomBook(n))){toast('이미 소파에서 읽고 있어요');return true}
  S.later.push({id:Date.now(),title:n.book,author:n.author||'',cover:n.cover||'',isbn:n.isbn||'',addedAt:ymd(),notes:[],rooms:[]});save();toast('『'+roomBook(n)+'』을 "나중에 읽을 책"에 담았어요');renderPanel();return true}
 if(act==='campStay'){panelView.exitAsk=false;renderPanel();return true}
 if(act==='campLeave'){closePanel();return true}
 if(act==='enterRoom'){if(!n)return true;if(VIEW!=='village'){closePanel();enterVillage();setTimeout(()=>openV('room:'+n.id),900)}else openV('room:'+n.id);return true}
 if(act==='rcNo'){closePanel();return true}
 if(act==='rcAgree'){if(!n)return true;if(n.left&&n.people>=n.max){toast('정원이 가득 찼어요 ('+n.people+'/'+n.max+'명)');return true}
  if(n.left){n.people++;n.left=false}n.agreed=true;n.agreedAt=Date.now();save();panelView.readAt=n.lastRead||0;renderPanel();enterCamp(n);render();return true}
 if(act==='rctab'){panelView.tab=b.dataset.v;panelView.leaveAsk=false;renderPanel();return true}
 if(act==='rcChip'){panelView.chipEdit=true;renderPanel();const i=document.getElementById('rcPg');if(i)i.focus();return true}
 if(act==='rcChipOk'){const v=Math.round(+document.getElementById('rcPg').value);panelView.pg=v>=1&&v<=9999?v:null;panelView.chipEdit=false;renderPanel();return true}
 if(act==='rcChipNone'){panelView.pg=null;panelView.chipEdit=false;renderPanel();return true}
 if(act==='rcSend'){if(n)rcSend(n);return true}
 if(act==='rcDown'){const lg=document.getElementById('rcLog');if(lg)lg.scrollTop=lg.scrollHeight;b.style.display='none';return true}
 if(act==='rcLeaveAsk'){panelView.leaveAsk=true;renderPanel();return true}
 if(act==='rcLeaveNo'){panelView.leaveAsk=false;renderPanel();return true}
 if(act==='rcLeave'){if(!n)return true;n.messages.forEach(m=>{if(m.who==='나')m.left=true});n.agreed=false;n.left=true;n.people=Math.max(1,n.people-1);save();render();closePanel();toast('방에서 나왔어요. 내 글은 "나간 참여자"로 남아요');return true}
 if(act==='rcTest'&&n){const v=b.dataset.v,k=rcKey(roomBook(n));
  if(v==='sofa'){if(S.reading&&rcKey(S.reading.title)!==k)toast('소파에 다른 책이 있어요. 먼저 정리해 주세요');else if(!S.reading){S.reading={id:Date.now(),title:roomBook(n),author:n.author||'',cover:'',isbn:'',totalPages:400,page:0,progress:0,notes:[],startedAt:today()};save();render();toast('소파에 『'+roomBook(n)+'』을 올렸어요 (0쪽)')}else toast('이미 소파에 있어요')}
  if(v==='page'){if(!S.reading||rcKey(S.reading.title)!==k)toast('먼저 소파에 이 책을 올려 주세요');else{S.reading.page=Math.min(S.reading.totalPages||9999,(S.reading.page||0)+30);updProgress(S.reading);save();render();toast(S.reading.page+'쪽까지 읽은 걸로 기록했어요')}}
  if(v==='msg')rcFakeMsg(n);
  return true}
 return false}
function createPanel(){
 if(panelView.created){const n=S.news.find(x=>x.id===panelView.created);if(n)return head('모닥불을 피웠어요')+`<div class="card"><b>${esc(n.title)}</b><div class="muted" style="margin-top:4px">${esc(roomSub(n))}</div></div>`+inviteBlock(n)+'<p class="muted">친구에게 링크를 보내 보세요. 링크를 받은 사람이 열면 이 모닥불로 들어와요.</p>'}
 const nf=panelView.nf||(panelView.nf=RDEF()),same=nf.kind==='SAME';
 const seg=(act,items,cur)=>`<div class="seg">${items.map(([v,l])=>`<button data-act="${act}" data-v="${v}" class="${String(cur)===String(v)?'on':''}">${l}</button>`).join('')}</div>`;
 const opts=[...(S.reading?[['sofa','지금 읽는 책 · 『'+S.reading.title+'』']]:[]),...S.finished.map((b,i)=>['shelf:'+i,'책장 · 『'+b.title+'』']),['typed','직접 입력']];
 return head('모닥불 피우기')+`
  <label>방 종류</label>${seg('rkind',[['SAME','같은 책'],['OWN','각자 읽기']],nf.kind)}
  <p class="muted" style="margin-top:6px">${same?'모두가 같은 책을 읽어요. 쪽수에 맞춰 이야기하고, 끝나면 내 책장의 그 책에 대화가 담겨요.':'각자 다른 책을 읽어도 돼요. 읽는 책 이야기를 같이 나누고, 끝나면 내가 고른 책에 대화가 담겨요.'}</p>
  <label for="rbook">${same?'함께 읽을 책':'내가 읽을 책'}</label>
  <select id="rbook"><option value="">${same?'책을 골라 주세요':'아직 안 정했어요'}</option>${opts.map(([v,l])=>`<option value="${esc(v)}" ${nf.bookSel===v?'selected':''}>${esc(l)}</option>`).join('')}</select>
  ${nf.bookSel==='typed'?`<input id="rbookt" placeholder="책 제목" value="${esc(nf.bookTitle)}" style="margin-top:6px">`:''}
  <label for="rname">방 이름 (비우면 자동)</label><input id="rname" placeholder="${nf.kind==='SAME'?'책 이름으로 정해져요':esc(defaultRoomName(nf))}" value="${esc(nf.name)}">
  <label>시작</label>${seg('rstart',[['now','지금 바로'],['later','예약']],nf.start)}
  ${nf.start==='later'?`<input id="rwhen" type="datetime-local" value="${esc(nf.when)}" style="margin-top:6px">`:''}
  <label>진행 시간</label>${seg('rhours',[1,2,3,4,5,6,7].map(h=>[h,h+'시간']),nf.hours)}<p class="muted" style="margin:6px 0 0">시간이 지나면 모닥불이 저절로 꺼지고 모두 광장으로 돌아가요. 방에서 이야기하며 읽는 시간은 오늘 읽은 시간에 더해져요.</p>
  ${PUBLIC_ROOMS?`<label>공개 범위</label>${seg('rvis',[['invite','초대 링크로만'],['public','마을에 공개']],nf.vis)}`:'<p class="muted" style="margin:10px 0 0">초대 링크로 부른 친구만 들어올 수 있어요.</p>'}
  <p class="muted" style="margin:10px 0 0">오늘 개설 ${roomsMadeToday()}/3 · 동시에 2개까지</p>
  <label for="rmax">최대 인원</label><input id="rmax" type="number" min="2" max="${RMAX}" value="${nf.max}" style="width:100px">
  
  <div class="err" id="rerr"></div>
  <div class="foot" style="margin-top:14px"><button class="primary" data-act="rcreate" style="width:100%">모닥불 피우기</button></div>`;
}
const kstDay=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
const roomsMadeToday=()=>S.roomLog.filter(t=>kstDay(t)===kstDay(Date.now())).length;   // 취소해도 세지 않고 쓴 횟수로 센다
function createRoom(){
 const nf=panelView.nf,err=m=>{document.getElementById('rerr').textContent=m};
 const b=nfBook(nf),max=Math.round(+nf.max);
 if(roomsMadeToday()>=3)return err('모닥불은 하루에 3번까지 피울 수 있어요. 내일 다시 피워 주세요');
 if(S.news.filter(n=>n.mine&&n.kind!=='CLOSED').length>=2)return err('동시에 열 수 있는 모닥불은 2개예요. 하나를 끝낸 뒤에 다시 피워 주세요');
 if(nf.kind==='SAME'&&!b)return err('함께 읽을 책을 골라 주세요');
 if(!(max>=2&&max<=RMAX))return err('최대 인원은 2~'+RMAX+'명이에요');
 const now=Date.now();let opens=now;
 if(nf.start==='later'){opens=new Date(nf.when).getTime();if(!(opens>now+60000))return err('시작 시각은 지금보다 뒤로 정해 주세요')}
 const name=(nf.name||'').trim()||defaultRoomName(nf),closes=opens+nf.hours*HOUR;
 const room={id:'r'+now,kind:opens<=now?'OPEN':'SOON',title:name,sub:'',book:b?b.title:'',author:b?b.author:'',cover:b?b.cover:'',isbn:b?b.isbn:'',rtype:nf.kind,mine:true,people:1,max,vis:nf.vis,inviteCode:genCode(),opensAt:opens,closesAt:closes,alarm:true,done:false,messages:[],period:timeRange(opens,closes)};
 rcNorm(room);S.news.push(room);S.roomLog.push(now);save();panelView.created=room.id;render();renderPanel();buildSr();toast('모닥불을 피웠어요');
}
async function copyLink(n){const link=inviteLink(n);try{await navigator.clipboard.writeText(link);toast('링크를 복사했어요')}catch(e){const i=document.getElementById('invLink');if(i){i.select();try{document.execCommand('copy');toast('링크를 복사했어요')}catch(_){toast('링크를 길게 눌러 복사해 주세요')}}}}
function findByCode(c){c=String(c||'').trim();const m=/join=([A-Za-z0-9]+)/i.exec(c);if(m)c=m[1];c=c.toUpperCase();return S.news.find(n=>n.inviteCode===c)}
function joinByCode(c){
 const n=findByCode(c);
 if(!n){toast('초대 코드를 찾을 수 없어요. 체험판에서는 같은 브라우저에서 만든 모닥불만 열려요');return false}
 if(VIEW!=='village'){enterVillage();setTimeout(()=>openV('room:'+n.id),900)}else openV('room:'+n.id);
 toast(n.mine?'내가 만든 모닥불이에요':'모닥불에 들어왔어요');return true;
}

// ===== 개설·초대·보관·알림 버튼 =====
function sharedRoomAction(act,b){
 if(act==='cmClose'){panelView.sheet=null;renderPanel();return true}
 if(act==='alarm'){const n=S.news.find(x=>x.id===b.dataset.id);n.alarm=!n.alarm;save();
  if(n.alarm&&notifyState()==='ask')askNotify();
  render();renderPanel();if(n.alarm)toast(notifyState()==='off'||notifyState()==='none'?'브라우저 알림이 꺼져 있어요. 열려 있을 때 화면으로만 알려드려요':'개방되면 알려드릴게요');return true}
 if(rcAct(act,b))return true;
 if(act==='newRoom'){openV('fire:new');return true}
 if(act==='joinLink'){joinByCode(document.getElementById('jl').value);return true}
 if(act==='rkind'){panelView.nf.kind=b.dataset.v;renderPanel();return true}
 if(act==='rstart'){panelView.nf.start=b.dataset.v;renderPanel();return true}
 if(act==='rhours'){panelView.nf.hours=+b.dataset.v;renderPanel();return true}
 if(act==='rvis'){panelView.nf.vis=b.dataset.v;renderPanel();return true}
 if(act==='rcreate'){createRoom();return true}
 if(act==='copyLink'){const n=S.news.find(x=>x.id===b.dataset.id);if(n){copyLink(n);b.classList.add('done');b.innerHTML=ICON_CHECK;setTimeout(()=>{b.classList.remove('done');b.innerHTML=ICON_COPY},1500)}return true}
 if(act==='shareLink'){const n=S.news.find(x=>x.id===b.dataset.id);if(n)navigator.share({title:'모닥불에 초대해요',text:n.title,url:inviteLink(n)}).catch(()=>{});return true}
 if(act==='friendIn'){const n=S.news.find(x=>x.id===b.dataset.id);if(!n)return true;if(n.people>=n.max){toast('정원이 가득 찼어요 ('+n.people+'/'+n.max+'명)');return true}n.people++;n.members.push(NAMEPOOL.find(x=>!n.members.includes(x))||'@친구');save();if(VIEW==='shared'&&G3)G3.setView('shared',n);render();renderPanel();toast('친구가 들어왔어요 ('+n.people+'/'+n.max+'명)');return true}
 if(act==='closeRoom'){const n=S.news.find(x=>x.id===b.dataset.id);if(!n)return true;
  if(n.kind==='SOON'){S.news=S.news.filter(x=>x!==n);toast('모닥불을 취소했어요')}else{n.kind='CLOSED';n.closesAt=Date.now();n.deleteAt=Date.now()+7*DAY;toast('모닥불을 일찍 껐어요. 마을 게시판에 7일 동안 남아요');if(VIEW==='shared'&&CAMP_ID===n.id){const m=recordCampTime(n,Date.now());endCampToPlaza(m)}}
  save();render();buildSr();closePanel();return true}
 if(act==='openNow'){const n=S.news.find(x=>x.id===b.dataset.id);n.opensAt=Date.now();fireDue();return true}
 if(act==='import'){const n=S.news.find(x=>x.id===b.dataset.id);if(rcEmpty(n)){toast('가져올 대화가 없어요');return true}if(!n.book){toast('이 방에는 내 책이 정해지지 않아서 가져올 곳이 없어요');return true}const rec={title:n.title,period:n.period,rtype:n.rtype,messages:rcSnapshot(n)};   // 다른 참여자는 익명, 삭제된 글은 뺀다
  // 내가 읽은 책(다 읽은 책·포기한 책·읽는 중)에 있으면 거기에 붙이고, 없으면 "나중에 읽을 책"에 담는다 (다 읽은 책으로 세지 않는다)
  let bk=S.finished.find(x=>x.title===n.book)||S.dropped.find(x=>x.title===n.book),msg='『'+n.book+'』에 공유방 탭이 생겼어요';
  if(!bk&&S.reading&&S.reading.title===n.book){bk=S.reading;if(!bk.rooms)bk.rooms=[];msg='『'+n.book+'』을 읽는 중이라, 다 읽으면 책장에 공유방 탭이 생겨요'}
  if(!bk){bk=S.later.find(x=>x.title===n.book);if(!bk){bk={id:Date.now(),title:n.book,author:n.author||'',cover:n.cover||'',isbn:n.isbn||'',addedAt:ymd(),notes:[],rooms:[]};S.later.push(bk);msg='『'+n.book+'』을 "나중에 읽을 책"에 담고 공유방 기록을 같이 넣었어요'}}
  if(!bk.rooms)bk.rooms=[];bk.rooms.push(rec);n.done=true;save();render();renderPanel();toast(msg);return true}
 return false;
}

function fireSharedRoomsDue(){
 // 종료 후 7일이 지난 공유방은 사라진다 (가져온 기록은 내 서재에 남는다)
 // 내가 만든 모닥불은 기간이 끝나면 종료되고, 그때부터 7일 보관된다
 S.news.forEach(n=>{if(n.kind==='OPEN'&&n.closesAt&&Date.now()>=n.closesAt){n.kind='CLOSED';n.deleteAt=Date.now()+7*DAY;
  if(VIEW==='shared'&&CAMP_ID===n.id){const m=recordCampTime(n,n.closesAt);campSince=0;endCampToPlaza(m)}
  save();buildSr();render();if(panelOpen&&panelOpen!=='plaza')renderPanel()}});
 const nb=S.news.length;S.news=S.news.filter(n=>!(n.kind==='CLOSED'&&n.deleteAt&&Date.now()>=n.deleteAt));
 if(S.news.length!==nb){save();render();buildSr();if(panelOpen&&panelOpen!=='plaza')renderPanel()}
 S.news.forEach(n=>{if(n.kind==='SOON'&&n.opensAt&&Date.now()>=n.opensAt){
  n.kind='OPEN';n.sub='지금 열렸어요';
  if(n.alarm&&!n.notified){n.notified=true;notify('이야기방이 열렸어요',n.title,'room-'+n.id,()=>openF('window'))}
  save();render();if(panelOpen==='window')renderPanel()}});
}

function bindSharedRoomEvents(){
setInterval(()=>{const l=S.news.filter(n=>n.kind==='OPEN'&&n.agreed&&n.members.length);if(l.length&&Math.random()<.6)rcFakeMsg(l[Math.floor(Math.random()*l.length)])},12000);

S.news.forEach(rcNorm);save();

document.getElementById('campExit').addEventListener('click',askExitCamp);

document.getElementById('campChatToggle').addEventListener('click',toggleCampChat);

// 배경의 ☁ 참여자 · 🌙 방 정보 버튼: 대화창은 그대로 두고 별도 모달로 연다 (모달의 ✕는 그 창만 닫는다). 같은 버튼을 다시 누르면 닫힌다
document.getElementById('campSide').addEventListener('click',e=>{const b=e.target.closest('[data-camp]');if(!b||VIEW!=='shared')return;
 panelView.sheet=panelView.sheet===b.dataset.camp?null:b.dataset.camp;panelView.leaveAsk=false;panelView.exitAsk=false;renderPanel()});
document.getElementById('campModal').addEventListener('click',e=>{if(e.target.id==='campModal'){panelView.sheet=null;renderPanel()}});

panel.addEventListener('change',e=>{
 if(e.target.id==='rbook'){panelView.nf.bookSel=e.target.value;renderPanel()}

});
panel.addEventListener('input',e=>{
 if(e.target.id==='rc')panelView.draft=e.target.value;
 if(e.target.id==='rname')panelView.nf.name=e.target.value;
 if(e.target.id==='rmax')panelView.nf.max=e.target.value;
 if(e.target.id==='rbookt')panelView.nf.bookTitle=e.target.value;
 if(e.target.id==='rwhen')panelView.nf.when=e.target.value;

});
panel.addEventListener('keydown',e=>{
 if(e.key==='Enter'&&!e.shiftKey&&canHover&&e.target.id==='rc'&&!e.isComposing)   // 마우스 기기만 Enter로 보낸다. 폰(터치)은 Enter가 줄바꿈이고 [보내기]로 보낸다
  {e.preventDefault();const n=S.news.find(x=>'room:'+x.id===panelOpen);if(n)rcSend(n)}});


document.getElementById('campModalPanel').addEventListener('click',onPanelClick);


// 초대 링크(#join=코드)로 열면 그 모닥불로 들어간다
(function(){const m=/#join=([A-Za-z0-9]+)/.exec(location.hash);if(m){history.replaceState(null,'',location.href.split('#')[0]);setTimeout(()=>joinByCode(m[1]),700)}})();
}
