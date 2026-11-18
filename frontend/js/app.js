// 공용 상태·저장·모달·장면 전환과 시작 순서. 기능은 room.js·village.js·shared-room.js, 3D는 scene.js.
let TW=32,TZ=32;const TH=16;
const P=(x,y,z)=>[(x-y)*TW,(x+y)*TH-z*TZ];
const pts=a=>a.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;r=Math.min(255,Math.round(r*f));g=Math.min(255,Math.round(g*f));b=Math.min(255,Math.round(b*f));return'#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
function box(x,y,z,w,d,h,c,cls){
 const t=[P(x,y,z+h),P(x+w,y,z+h),P(x+w,y+d,z+h),P(x,y+d,z+h)];
 const r=[P(x+w,y,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x+w,y,z+h)];
 const l=[P(x,y+d,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x,y+d,z+h)];
 const k=cls?` class="${cls}"`:'';
 return `<g${k}><polygon points="${pts(l)}" fill="${shade(c,.9)}"/><polygon points="${pts(r)}" fill="${shade(c,.78)}"/><polygon points="${pts(t)}" fill="${c}"/></g>`;
}
function hull(x,y,z,w,d,h){return `<polygon class="hull" points="${pts([P(x,y,z+h),P(x+w,y,z+h),P(x+w,y,z),P(x+w,y+d,z),P(x,y+d,z),P(x,y+d,z+h)])}"/>`}
function floorPoly(x1,y1,x2,y2,fill,extra=''){return `<polygon points="${pts([P(x1,y1,0.01),P(x2,y1,0.01),P(x2,y2,0.01),P(x1,y2,0.01)])}" fill="${fill}" ${extra}/>`}
function wallRect(x1,x2,z1,z2,fill,y=0.02){return `<polygon points="${pts([P(x1,y,z1),P(x2,y,z1),P(x2,y,z2),P(x1,y,z2)])}" fill="${fill}"/>`}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>ymd();   // 메모·인용구 날짜와 읽기 시작일도 연도를 포함한 한국 시간 날짜로 저장한다 (결정 #41, 열린 결정 Q ①)
// 화면에는 올해는 '11.05', 다른 해는 '2025.11.05'로 보여준다
const shortDate=s=>{const m=/^(\d{4})\.(\d+)\.(\d+)$/.exec(String(s||''));if(!m)return s||'';const y=+new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}).slice(0,4);return (+m[1]===y?'':m[1]+'.')+(+m[2])+'.'+m[3]};
const ymd=()=>{const [y,m,d]=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}).split('-');return y+'.'+(+m)+'.'+d}; // 완독일 '2026.11.17' (한국 시간, 연도 포함)

const COLORS=[['하양','#f6f3ff'],['크림','#fff1d6'],['분홍','#ffd6e4'],['민트','#cdf0e0'],['하늘','#cfe4fb'],['라일락','#e0d4fa'],['버터','#fff0a8'],['회색','#d9dce6']];
const EXPR=[['normal','기본'],['happy','웃음'],['surprised','놀람'],['sleepy','졸림'],['wink','윙크']];
const FACE=[['none','없음'],['glasses','동그란 안경'],['sunglasses','선글라스'],['bandaid','반창고']];
const HEAD=[['none','없음'],['beanie','비니'],['bow','리본'],['crown','왕관'],['sprout','새싹']];
const PROP=[['none','없음'],['book','책'],['mug','찻잔'],['lantern','랜턴'],['balloon','풍선']];
const defAvatar=()=>({color:'#f6f3ff',expr:'normal',face:'none',head:'none',prop:'book'});
const SPINE=['#6d8f6b','#b9654a','#d7b45a','#5f7aa0','#8c5a7a','#a8875a','#4f6d6a','#c98a6a'];

function defaultState(){return{
 user:{nickname:'조약돌',handle:'pebble'},streak:7,
 reading:null,
 finished:[
  {id:1,title:'아몬드',author:'손원평',rating:4,review:'감정을 배워가는 이야기라 오래 남았다',finishedAt:'10.12',notes:[{type:'QUOTE',content:'누구도 무엇도 탓하지 않았다.',page:88,at:'10.08'},{type:'MEMO',content:'윤재가 곤이를 이해하는 장면에서 멈춰서 생각함',page:150,at:'10.10'}],rooms:[{title:'『아몬드』 같이 읽기',period:'10.13 ~ 10.20',messages:[{who:'나',text:'결말에서 엄마 장면이 제일 기억에 남았어요'},{who:'참여자 A',text:'저는 곤이 시점으로 다시 읽어보고 싶어졌어요'},{who:'참여자 B',text:'감정을 모른다는 설정이 오히려 감정을 더 크게 느끼게 했던 것 같아요'}]}]},
  {id:2,title:'불편한 편의점',author:'김호연',rating:3,review:'',finishedAt:'10.25',notes:[],rooms:[]},
  {id:3,title:'어린 왕자',author:'생텍쥐페리',rating:5,review:'볼 때마다 다른 문장이 보인다',finishedAt:'11.01',notes:[{type:'QUOTE',content:'가장 중요한 것은 눈에 보이지 않아.',page:92,at:'11.01'}],rooms:[]},
  {id:4,title:'사피엔스',author:'유발 하라리',rating:4,review:'',finishedAt:'11.06',notes:[],rooms:[]},
  {id:5,title:'채식주의자',author:'한강',rating:4,review:'',finishedAt:'11.11',notes:[],rooms:[]}
 ],
 dropped:[],
 avatar:defAvatar(),
 unlocked:{glasses:true},newItem:true,session:null,sessions:[],
 recommendations:{},
 onboard:0,seen:{},newsSeen:{},goals:{},plaza:[],later:[], // later: 나중에 읽을 책 (공유방에서 가져왔는데 내 책장에 없는 책)
 news:[
  {id:'n1',kind:'OPEN',title:'『작별하지 않는다』 같이 읽기',sub:'오늘 22:00 종료 · 12명 참여 중'},
  {id:'n2',kind:'SOON',title:'『소년이 온다』 이야기방',sub:'11.20 개방',alarm:false,opensAt:Date.UTC(2026,10,19,15,0,0)},
  {id:'n3',kind:'CLOSED',title:'『불편한 편의점』 이야기방',sub:'가져오기 마감 D-2',deleteAt:Date.now()+2*864e5,book:'불편한 편의점',author:'김호연',done:false,period:'11.03 ~ 11.10',messages:[{who:'나',text:'독고 씨가 변해가는 과정이 좋았어요'},{who:'참여자 A',text:'편의점이라는 공간이 하나의 동네처럼 느껴졌어요'}]},
  {id:'n4',kind:'CLOSED',title:'『모순』 이야기방',sub:'가져오기 마감 D-5',deleteAt:Date.now()+5*864e5,book:'모순',author:'양귀자',done:false,period:'11.06 ~ 11.13',messages:[{who:'나',text:'안진진의 선택이 이해되면서도 아팠어요'},{who:'참여자 A',text:'제목이 끝까지 읽어야 이해되는 책이었어요'}]}
 ]
}}
let S;
try{S=JSON.parse(localStorage.getItem('myroom-proto-v1'))}catch(e){}
if(!S)S=defaultState();
if(!S.recommendations)S.recommendations={}; // 이웃집별 미확인 추천 한 권. me는 내 집에 도착한 책
if(!S.roomLog)S.roomLog=[];if(!S.sessions)S.sessions=[];if(S.session===undefined)S.session=null;if(S.reading&&!S.reading.id)S.reading.id=Date.now();
if(!S.avatar||!S.avatar.expr)S.avatar=defAvatar();
if(!S.newsSeen)S.newsSeen={};
// 월 목표 이력 (결정 #39): 예전의 한 값(S.goal)은 이번 달부터만 기록하고, 그 이전 달은 "목표 기록 없음"으로 둔다
if(!S.goals){S.goals={};if(S.goal>=1)S.goals[new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}).slice(0,7)]={goal:Math.min(99,Math.round(S.goal)),changes:[]}}
delete S.goal;
if(!S.later)S.later=[];if(!S.plaza)S.plaza=[];S.plaza=S.plaza.filter(m=>Date.now()-m.ts<864e5); // 광장 대화는 하루 뒤 사라진다
S.news.forEach(n=>{if(n.kind==='SOON'&&!n.opensAt)n.opensAt=Date.UTC(2026,10,19,15,0,0);if(n.kind==='CLOSED'&&!n.deleteAt){const m=/D-(\d+)/.exec(n.sub||'');n.deleteAt=Date.now()+(m?+m[1]:3)*864e5}});
// 완독일에 연도를 붙인다. 예전 저장값은 '월.일'뿐이라, 오늘(한국 시간) 이전에서 가장 가까운 그 날짜로 정한다
(()=>{const [ty,tm,td]=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}).split('-').map(Number);
 [...S.finished,...(S.dropped||[])].forEach(b=>{const m=/^(\d+)\.(\d+)$/.exec(b.finishedAt||'');if(m){const mo=+m[1],d=+m[2];b.finishedAt=((mo>tm||(mo===tm&&d>td))?ty-1:ty)+'.'+mo+'.'+String(d).padStart(2,'0')}})
 // 메모·인용구 날짜, 읽기 시작일, 나중에 읽을 책 담은 날도 같은 방식으로 연도를 붙인다 (열린 결정 Q ①)
 const addY=s=>{const m=/^(\d+)\.(\d+)$/.exec(s||'');return m?(((+m[1]>tm||(+m[1]===tm&&+m[2]>td))?ty-1:ty)+'.'+(+m[1])+'.'+String(+m[2]).padStart(2,'0')):s};
 [S.reading,...S.finished,...(S.dropped||[]),...S.later].filter(Boolean).forEach(b=>{if(b.startedAt)b.startedAt=addY(b.startedAt);if(b.addedAt)b.addedAt=addY(b.addedAt);(b.notes||[]).forEach(n=>{if(n.at)n.at=addY(n.at)})})})();
S.onboard=0; // 첫 방문 안내는 평소에 뜨지 않고, 데모 초기화를 눌렀을 때만 뜬다
let saveBad=0; // 저장이 막혀도 화면은 계속 쓰되, 한 번은 알린다 (setTimeout: 바로 뒤에 오는 성공 토스트가 덮어쓰지 못하게)
const save=()=>{try{localStorage.setItem('myroom-proto-v1',JSON.stringify(S));saveBad=0}catch(e){if(!saveBad){saveBad=1;setTimeout(()=>toast('저장 공간이 부족하거나 막혀 있어요. 이 기록이 기기에 남지 않을 수 있어요'),0)}}};

let tempAvatar=null;
let panelOpen=null, panelView={};
const avatarNow=()=>tempAvatar||S.avatar;
const canvas=document.getElementById('stage');
const flat=fn=>fn();
const angDiff=(a,b)=>((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;

// 레이아웃: wide=데스크톱 10×8 방, tall=모바일 7×6.5 방. 가구는 d만큼 평행이동. 방 크기는 사용 중에 바뀌지 않는다.
const BASE_T={sofa:[6.4,4.7],lamp:[5.3,6.9],mirror:[6.5,1.25],window:[3.6,1.5],door:[9,1.1]};
const LAY={
 wide:{X:10,Y:8,d:{win:[0,0],mir:[0,0],door:[0,0],sofa:[0,0]},shelfEnd:3.7,K:7,shelf:[1.7,2.2],cal:{y:4.4,t:5.3},start:[7.6,6.2]},
 tall:{X:7,Y:6.5,d:{win:[-1.2,0],mir:[-2.05,0],door:[-2.8,0],sofa:[-0.9,-1.2]},shelfEnd:3.3,K:6,shelf:[1.7,1.9],cal:{y:3.7,t:4.6},start:[5.6,5.2]}
};
let L,TARGET,SIT,STAND;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
let VIEW='room',ROOM_L=null,CAMP_ID=null;
const sim={x:0,y:0,z:0,rot:Math.PI/4,mode:'idle',tx:0,tz:0,after:null,t:0,mv:0,sit:0,k:0,fx:0,fz:0};
function setLayout(n){L=LAY[n];const d=L.d;
 TARGET={sofa:add(BASE_T.sofa,d.sofa),lamp:add(BASE_T.lamp,d.sofa),shelf:L.shelf,calendar:[1.7,L.cal.t],mirror:add(BASE_T.mirror,d.mir),window:add(BASE_T.window,d.win),door:add(BASE_T.door,d.door)};
 STAND=TARGET.sofa;SIT=add([5.0,4.7],d.sofa);
 Object.assign(sim,{x:L.start[0],z:L.start[1],y:0,mode:'idle',after:null,mv:0,sit:0,k:0,rot:Math.PI/4})}
const isSit=()=>sim.mode==='sit'||sim.mode==='sitting';
const MQ=matchMedia('(max-width:760px)');
setLayout(MQ.matches?'tall':'wide');
function walkTo(tx,tz,done){
 if(G3)G3.follow();   // 걸어가라고 하면 지도 끌기를 풀고 다시 캐릭터를 따라간다
 if(isSit()){sim.x=STAND[0];sim.z=STAND[1];sim.y=0;sim.mode='idle';sim.sit=0;render()}
 sim.tx=tx;sim.tz=tz;sim.after=done||null;sim.mode='walk'}
function sitDown(){sim.mode='sitting';sim.k=0;sim.fx=sim.x;sim.fz=sim.z;render()}
function stepSim(dt){
 sim.t+=dt;let moving=0;
 if(sim.mode==='walk'){const dx=sim.tx-sim.x,dz=sim.tz-sim.z,dd=Math.hypot(dx,dz);
  if(dd<.06){sim.mode='idle';const f=sim.after;sim.after=null;if(f)f()}
  else{const v=Math.min(dd,(VIEW==='village'?4.6:3.4)*dt);sim.x+=dx/dd*v;sim.z+=dz/dd*v;sim.rot+=angDiff(sim.rot,Math.atan2(dx,dz))*Math.min(1,dt*12);moving=1}}
 if(sim.mode==='sitting'){sim.k=Math.min(1,sim.k+dt/.45);const k=sim.k;
  sim.x=sim.fx+(SIT[0]-sim.fx)*k;sim.z=sim.fz+(SIT[1]-sim.fz)*k;sim.y=.18*k+Math.sin(Math.PI*k)*.25;
  sim.rot+=angDiff(sim.rot,Math.PI/2)*Math.min(1,dt*12);if(k>=1)sim.mode='sit'}
 sim.mv+=(moving-sim.mv)*Math.min(1,dt*12);
 sim.sit+=((isSit()?1:0)-sim.sit)*Math.min(1,dt*9);
}

const G3=createScene();
document.getElementById('fail').style.display=G3?'none':'flex';
MQ.addEventListener('change',()=>{closePanel();if(VIEW!=='room'){VIEW='room';L=ROOM_L||L;if(G3)G3.setView('room')}setLayout(MQ.matches?'tall':'wide');if(G3)G3.relayout();buildSr();render()});

function bookColor(t){let h=0;for(const c of t)h=(h*31+c.charCodeAt(0))>>>0;return SPINE[h%SPINE.length]}

// 공통 날짜·시간 표시
const hhmm=ts=>new Date(ts).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
const DAY=864e5;
const mmdd=ts=>{const [,m,d]=new Date(ts).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}).split('-');return +m+'.'+d};
function hdrText(extra){const c=calData();return '@'+S.user.handle+' · 읽은 책 '+S.finished.length+'권'+(c.streak?' · '+c.streak+'일 연속 기록':'')+' · 오늘 '+todayMin()+'분'+(extra||'')}
function render(){
 const a=avatarNow();
 const cal=calData();
 const reading=!!S.reading;
 const ses=S.session,lampOn=!!ses&&ses.status==='RUNNING',lampWarn=!!ses&&ses.status==='NEEDS_CONFIRM';
 const sitting=isSit();
 const onboardDim=f=>S.onboard===1?(f!=='sofa'):S.onboard===2?(f!=='lamp'):false;
 const winNew=S.news.some(n=>n.kind==='CLOSED'&&!n.done&&!(rcEmpty(n))&&!S.newsSeen[n.id])||S.news.some(rcUnread); // 가구는 움직이지 않고, 신규 알림은 노란 별로만 알린다. 참여 중인 방의 안 읽은 글도 별 (RC-16)
 const openRooms=S.news.filter(n=>n.kind==='OPEN').length;
 const visiting=VIEW==='neighbor',gift=currentGift();
 if(G3)G3.sync({a,reading:visiting?false:reading,title:reading?S.reading.title:'',sitting,lampOn:!visiting&&lampOn,lampWarn:!visiting&&lampWarn,dim:visiting?()=>false:onboardDim,openRooms,newItem:S.newItem,winNew,gift,books:visiting?['모모','데미안','어린 왕자']:S.finished.slice(-((L.K||7)*4)).map(b=>b.title),cal:visiting?{...cal,marks:[],done:0,goal:1}:cal,win:windowScene(),vil:vilList()});
 document.getElementById('stageWrap').classList.toggle('neighbor',visiting);
 document.getElementById('giftMark').style.display=VIEW==='room'&&gift?'block':'none';
 // 화면 위 표시
 const nt=document.getElementById('nameTag');{const r=VIEW==='shared'?S.news.find(n=>n.id===CAMP_ID):null;nt.textContent=S.user.nickname+(r&&r.book?rcBookTag(r,'나'):'')}
 const ll=document.getElementById('lampLabel');ll.style.display=VIEW==='room'&&(lampOn||lampWarn)?'block':'none';ll.className='ov'+(lampWarn?' warn spark':'');ll.innerHTML=`<span id="lampTime">${lampWarn?'확인 필요':fmtHMS(elapsed())}</span>`;
 document.getElementById('newMark').style.display=VIEW==='room'&&S.newItem?'block':'none';
 document.getElementById('newMarkWin').style.display=VIEW==='room'&&winNew?'block':'none';
 document.getElementById('newMarkSofa').style.display=VIEW==='room'&&!reading?'block':'none';
 // header
 document.getElementById('hdrName').textContent=visiting?neighborNow().name+'의 집':VIEW==='village'?S.user.nickname+' · 마을':VIEW==='shared'?'모닥불 · '+(S.news.find(n=>n.id===CAMP_ID)?.title||'공유방'):S.user.nickname+'의 방';
 document.getElementById('stage').setAttribute('aria-label',visiting?'이웃집 책장':VIEW==='shared'?'공유방 모닥불':VIEW==='village'?'마을':'내 방');
 document.getElementById('online').textContent='접속 ('+String(NPCS.length+1).padStart(2,'0')+'/'+VMAX+')';  // 마을 접속 인원/정원. 체험판은 보이는 이웃 수 + 나
 document.getElementById('hdrStats').textContent=hdrText(lampOn?' · ⏱ '+fmtHMS(elapsed()):'');
 renderNotice();
 document.getElementById('hdrAvatar').innerHTML=G3?`<img src="${G3.snap(a,'head')}" alt="" width="40" height="40">`:'';
 const hint=document.getElementById('hint');
 if(sitting){hint.style.display='block';hint.textContent=reading?'소파에 앉아 『'+S.reading.title+'』 읽는 중':'소파에 앉았어요 · 읽을 책을 올려보세요'}
 else{hint.textContent='가구를 눌러 사용 · 바닥을 눌러 이동';hint.style.display='none'}
 if(S.onboard)hint.style.display='none';
 if(VIEW!=='room')hint.style.display='none';   // 마을과 모닥불은 설명문 없이
 renderCoach();
}

const LABEL={sofa:'소파',lamp:'스탠드',shelf:'책장',calendar:'달력',mirror:'전신거울',window:'창문',door:'문'};
function stateLabel(f){
 if(VIEW==='neighbor')return f==='shelf'?'이웃집 책장 · 추천 책 꽂기':'마을로 돌아가기';
 if(f&&f.startsWith('neighbor:'))return (NEIGHBORS.find(n=>n.id===f.slice(9))?.name||'이웃')+'의 집 방문';
 if(f==='sofa')return S.reading?'소파 · 『'+S.reading.title+'』 읽는 중':'소파 · 읽을 책 올리기';
 if(f==='lamp')return S.session?(S.session.status==='RUNNING'?'스탠드 · 켜짐 '+fmtHMS(elapsed()):'스탠드 · 확인 필요'):'스탠드 · 꺼짐';
 if(f==='shelf')return '책장 · '+S.finished.length+'권';
 if(f==='calendar'){const c=calData();return '달력 · 이번 달 완독 '+c.done+'/'+c.goal+'권'}
 if(f==='mirror')return S.newItem?'전신거울 · 새 아이템':'전신거울 · 꾸미기';
 if(f==='window')return '창문';
 if(f==='door')return '문 · 마을로 나가기';
 if(f==='board')return '마을 게시판 · 열린 방 '+S.news.filter(n=>n.kind==='OPEN').length+'개';
 if(f==='home')return '내 방으로 들어가기';
 if(f==='plaza')return '마을 광장 · 이웃과 이야기하기';
 if(f==='fire:new')return '빈 모닥불 자리 · 모닥불 피우기';
 if(f&&f.startsWith('room:')){const n=S.news.find(x=>x.id===f.slice(5));return n?shortTitle(n)+' · '+({OPEN:'열려 있어요',SOON:'곧 열려요',CLOSED:'종료 · '+roomSub(n)})[n.kind]:''}
}
// sr buttons in tab order
const ORDER=['sofa','lamp','shelf','calendar','mirror','window','door'];
const srWrap=document.getElementById('srBtns');
const curOrder=()=>VIEW==='neighbor'?['shelf','door']:VIEW==='shared'?[]:VIEW==='village'?['board','plaza',...NEIGHBORS.map(n=>'neighbor:'+n.id),...vilOrder().slice(0,VSLOTS.length).map(n=>'room:'+n.id),...(vilOrder().length<VSLOTS.length?['fire:new']:[]),'home']:ORDER;
const labelOf=f=>f==='board'?'마을 게시판':f==='plaza'?'광장 이야기':f==='home'?'내 방으로':f==='fire:new'?'모닥불 피우기':f.startsWith('room:')?shortTitle(S.news.find(n=>n.id===f.slice(5))||{})+' 모닥불':LABEL[f];
function buildSr(){srWrap.innerHTML='';curOrder().forEach(f=>{const b=document.createElement('button');b.dataset.f=f;b.textContent=labelOf(f);
 b.addEventListener('focus',()=>{b.setAttribute('aria-label',stateLabel(f));hl(f,true)});b.addEventListener('blur',()=>hl(f,false));
 if(f.startsWith('neighbor:'))b.textContent=stateLabel(f);
 b.addEventListener('click',()=>VIEW==='neighbor'?openNeighbor(f):VIEW==='village'?openV(f):openF(f));srWrap.appendChild(b)})}
buildSr();
function hl(f,on){if(G3)G3.setHover(on?f:null)}

// coach
function renderCoach(){
 const c=document.getElementById('coach');
 if(S.onboard===1){c.style.display='flex';c.innerHTML='<span>소파를 눌러 지금 읽는 책을 올려보세요</span><button id="skipOb">건너뛰기</button>'}
 else if(S.onboard===2){c.style.display='flex';c.innerHTML='<span>책을 올렸어요. 스탠드를 켜면 읽는 시간이 기록돼요</span><button id="okOb">확인</button>'}
 else c.style.display='none';
 const sk=document.getElementById('skipOb');if(sk)sk.onclick=e=>{e.stopPropagation();S.onboard=0;save();render()};
 const ok=document.getElementById('okOb');if(ok)ok.onclick=e=>{e.stopPropagation();S.onboard=0;save();render()};
}

// tooltip + click
const tip=document.getElementById('tip');
const canHover=window.matchMedia('(hover: hover)').matches;
canvas.addEventListener('pointermove',e=>{if(!G3||drag.on)return;const p=G3.pick(e);const f=p&&p.f||null;
 if(canHover)G3.setHover(f);canvas.style.cursor=(p&&(p.f||p.floor))?'pointer':'default';
 if(!canHover||!f){tip.style.display='none';return}
 tip.textContent=stateLabel(f);tip.style.display='block';tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px'});
canvas.addEventListener('pointerleave',()=>{tip.style.display='none';if(G3)G3.setHover(null)});
// 지도 끌기(마을): 누르고 끌면 지도(카메라)가 움직인다. 캐릭터는 그대로이고, 걸어가라고 하면 다시 캐릭터를 따라간다. 6px 넘게 움직였을 때만 끌기로 보고, 짧은 클릭은 기존대로
const drag={id:null,x:0,y:0,on:false};let suppressClick=false;
canvas.addEventListener('pointerdown',e=>{if(!G3||VIEW!=='village'||e.button>0)return;if(!G3.panStart(e))return;drag.id=e.pointerId;drag.x=e.clientX;drag.y=e.clientY;drag.on=false});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==drag.id)return;if(!drag.on){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;drag.on=true;try{canvas.setPointerCapture(e.pointerId)}catch(_){}tip.style.display='none';canvas.style.cursor='grabbing'}G3.panMove(e)});
const dragEnd=e=>{if(e.pointerId!==drag.id)return;drag.id=null;G3.panEnd();if(drag.on){drag.on=false;canvas.style.cursor='default';suppressClick=true;setTimeout(()=>{suppressClick=false},80)}};   // 끌었으면 뒤따르는 클릭은 무시한다
canvas.addEventListener('pointerup',dragEnd);canvas.addEventListener('pointercancel',dragEnd);
canvas.addEventListener('contextmenu',e=>{if(drag.on||drag.id!==null)e.preventDefault()});
canvas.addEventListener('click',e=>{
 if(suppressClick){suppressClick=false;return}
 if(!G3)return;const p=G3.pick(e);
 if(VIEW==='shared')return;
 if(p&&p.f){VIEW==='neighbor'?openNeighbor(p.f):VIEW==='village'?openV(p.f):openF(p.f);return}
 if(p&&p.floor){walkTo(Math.max(L.minX||1.1,Math.min(L.X-0.4,p.x)),Math.max(L.minZ||0.8,Math.min(L.Y-0.4,p.z)));return}
 if(panelOpen&&panelOpen!=='mirror')closePanel();
});

// toast
let tt;function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2200)}

// panel
const panel=document.getElementById('panel'),backdrop=document.getElementById('backdrop');
backdrop.addEventListener('click',e=>{if(e.target===backdrop)closePanel()});
const FIRST={plaza:'광장에서는 방에 들어가지 않아도 이웃과 짧게 이야기해요. 한 줄로 말하면 머리 위에 말풍선이 떠요. 글은 하루 뒤에 사라져요.',mirror:'거울에서 캐릭터를 꾸밀 수 있어요. 꾸민 모습은 마을과 공유방에서도 보여요.',window:'열린 공유방과 가져오기 마감일이 여기 떠요.',board:'공유방 일정과 지난 방을 한눈에 봐요. 종료된 방은 7일 안에 내 서재로 가져오세요.','fire:new':'친구와 함께할 모닥불을 직접 피워요. 만들면 초대 링크가 생겨요.',lamp:'스탠드는 책을 읽는 동안 켜져 있어요.',calendar:'독서한 날이 표시되고, 이번 달 완독 목표를 정할 수 있어요.',shelf:'다 읽은 책이 꽂혀요. 책을 누르면 기록과 공유방 대화를 다시 볼 수 있어요.'};
// 키보드로 창을 열면 포커스를 창 제목으로 옮기고, 닫으면 열었던 버튼으로 돌려놓는다
let focusBack=null;
function focusPanel(){const a=document.activeElement;if(!focusBack&&a&&a!==document.body)focusBack=a;const h=panel.querySelector('.panel-head h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}}
function closePanel(){if(panelOpen==='mirror')cancelMirror();panelOpen=null;backdrop.classList.remove('open');panelView={};panel.innerHTML='';renderCampModal();if(VIEW==='shared')leaveCamp();if(focusBack&&document.contains(focusBack))focusBack.focus({preventScroll:true});focusBack=null}
function zoom(){}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panelOpen){if(VIEW==='shared'&&panelView.sheet){panelView.sheet=null;renderPanel();return}VIEW==='shared'?askExitCamp():closePanel()}});

function head(title,camp=false){
 const ft=(FIRST[panelOpen]&&!S.seen[panelOpen])?`<div class="firsttip">${FIRST[panelOpen]}</div>`:'';
 if(FIRST[panelOpen]&&!S.seen[panelOpen]){S.seen[panelOpen]=true;save()}
 return `<button class="handle" aria-label="패널 크기 바꾸기" data-act="handle"></button><div class="panel-head"><h2>${title}</h2>${camp?'<button class="camp-collapse" data-act="campToggle" aria-label="대화창 접기">접기 ▾</button>':''}<button class="ghost" data-act="close" aria-label="닫기">✕</button></div>${ft}`;
}
function renderPanel(){
 const f=panelOpen;let h='';
 panel.classList.toggle('wide',f==='mirror');
 if(!f){panel.innerHTML='';return}
 if(f==='sofa')h=sofaPanel();
 if(f==='lamp')h=lampPanel();
 if(f==='shelf')h=shelfPanel();
 if(f==='calendar')h=calendarPanel();
 if(f==='board')h=boardPanel();
 if(f==='fire:new')h=createPanel();
 if(f&&f.startsWith('room:'))h=roomPanel(f.slice(5));
 if(f==='mirror')h=mirrorPanel();
 if(f==='window')h=windowPanel();
 if(f==='neighborShelf')h=neighborShelfPanel();
 panel.classList.toggle('rcchat',h.includes('id="rcLog"'));
 panel.innerHTML=h;
 if(f.startsWith('room:'))rcAfter(f.slice(5));
 renderCampModal();
}
const onPanelClick=e=>{
 const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act;
 if(act==='close')return VIEW==='shared'?askExitCamp():closePanel();
 if(act==='home'){openF(b.dataset.f);return}
 if(act==='handle')return panel.classList.toggle('full');
 if(act==='askNotify'){askNotify();return}
 if(neighborAction(act,b)||roomAction(act,b)||villageAction(act,b)||sharedRoomAction(act,b))return;

};
panel.addEventListener('click',onPanelClick);
// 데모 초기화는 기록을 모두 지우므로 4초 안에 한 번 더 눌러야 실행된다
let resetArm=0,resetT;const resetBtn=document.getElementById('resetBtn');
resetBtn.onclick=()=>{
 if(!resetArm){resetArm=1;resetBtn.textContent='한 번 더 누르면 모두 지워요';resetBtn.classList.add('armed');clearTimeout(resetT);resetT=setTimeout(()=>{resetArm=0;resetBtn.textContent='데모 초기화';resetBtn.classList.remove('armed')},4000);return}
 resetArm=0;clearTimeout(resetT);resetBtn.textContent='데모 초기화';resetBtn.classList.remove('armed');
 try{localStorage.removeItem('myroom-proto-v1')}catch(e){}S=defaultState();S.onboard=1;Object.assign(sim,{x:L.start[0],z:L.start[1],y:0,mode:'idle',after:null,mv:0,sit:0,k:0,rot:Math.PI/4});tempAvatar=null;closePanel();render();toast('처음 상태로 되돌렸어요');entryFlash()};

function entryFlash(){
 if(!window.matchMedia('(hover: none)').matches)return;
 ORDER.forEach((f,i)=>setTimeout(()=>{hl(f,true);setTimeout(()=>hl(f,false),350)},300+i*180));
}
// 브라우저 알림: 이 페이지를 열어 둔 동안 온다. 창을 닫은 뒤에도 받으려면 서버 푸시가 필요하다 (DATA_API.md).
function notifyState(){if(!('Notification' in window))return 'none';return Notification.permission==='granted'?'on':Notification.permission==='denied'?'off':'ask'}
function askNotify(){if(!('Notification' in window))return Promise.resolve();return Promise.resolve(Notification.requestPermission()).then(()=>{if(panelOpen)renderPanel()})}
function notify(title,body,tag,onclick){
 if(notifyState()==='on'){try{const n=new Notification(title,{body,tag,icon:G3?G3.snap(S.avatar,'head'):undefined});n.onclick=()=>{window.focus();n.close();if(onclick)onclick()};return}catch(e){}}
 toast(title+' · '+body); // 알림을 못 보낼 때는 화면 안내로 대신한다
}
function fireDue(){
 const ses=S.session;
 if(ses){
  if(ses.status==='NEEDS_CONFIRM'&&!ses.notifiedConfirm){ses.notifiedConfirm=true;save();notify('확인이 필요해요',fmtClock(ses.startedAt)+'에 켠 스탠드가 아직 켜져 있어요. 언제까지 읽었는지 알려 주세요.','confirm',()=>openF('lamp'))}
  else if(ses.status==='RUNNING'&&Date.now()-ses.lastCheckAt>=CHECK&&ses.notifiedAt!==ses.lastCheckAt){ses.notifiedAt=ses.lastCheckAt;save();notify('아직 읽고 있어요?',(S.reading?'『'+S.reading.title+'』을 ':'')+'읽은 지 60분이 지났어요. 계속 읽고 있나요?','check')}
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
const CHAT_WINDOW=3000,CHAT_MAX=3,CHAT_DUP=30000,chatLog={plaza:[],room:[]};
function chatGate(kind,text,now=Date.now()){
 const log=chatLog[kind];while(log.length&&now-log[0].t>=CHAT_DUP)log.shift();
 if(log.filter(x=>now-x.t<CHAT_WINDOW).length>=CHAT_MAX)return '조금 뒤에 보내 주세요';
 const last=log[log.length-1];if(last&&last.text===text.trim())return '같은 말을 연달아 보낼 수 없어요';
 return ''}
function chatMark(kind,text,now=Date.now()){chatLog[kind].push({t:now,text:text.trim()})}
setInterval(fireDue,5000);
render();renderPanel();entryFlash();checkSession(true);
