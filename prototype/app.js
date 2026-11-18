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
if(!S.sessions)S.sessions=[];if(S.session===undefined)S.session=null;if(S.reading&&!S.reading.id)S.reading.id=Date.now();
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
// 마을: 문으로 나가면 들어가는 장면. 방과 같이 크기가 고정이다.
// 마을은 두 구역으로 나뉜다: 가운데 돌바닥 "광장"(누구와도 짧게 대화)과 동쪽 흙바닥 "모닥불 구역"(공유방, 대화는 방 안에서만)
const VSLOTS=[[26.0,6.2],[32.0,8.7],[26.0,11.2],[32.0,13.7],[26.0,16.2],[32.0,18.7],[26.0,21.2],[32.0,23.7]]; // 공유방 모닥불 자리 (빈 자리 하나는 "모닥불 피우기")
const PLAZA={x0:1.6,z0:10.0,x1:14.6,z1:20.0,cx:8.1,cz:15.0}; // 대화 가능 구역 (13×10칸). 이 안에 있을 때만 말풍선으로 말할 수 있다
const VMAX=100; // 마을 동시 접속 정원 (결정 #41, 조정 가능)
const RMAX=20;  // 공유방 최대 인원 (결정 #41)
const PUBLIC_ROOMS=false; // 베타는 초대만 (결정 #41, 열린 결정 M ②). 켜면 개설 창에 "마을에 공개" 선택지가 다시 나온다
const ZONE={x0:23.0,z0:4.0,x1:35.4,z1:25.6,g0:4.5,g1:6.7}; // 모닥불 구역 (12×21.6칸). g0~g1은 울타리 입구 (위쪽 길이 닿는 북서쪽)
const inPlaza=(x,z)=>x>PLAZA.x0&&x<PLAZA.x1&&z>PLAZA.z0&&z<PLAZA.z1;
// 체험판용 가짜 이웃. 서버가 생기면 그날 광장에 온 실제 사람으로 바뀐다
const NPCS=[{name:'나무',x:4.6,z:12.6,av:{color:'#e6f4e0',expr:'happy',face:'none',head:'sprout',prop:'mug'}},{name:'달빛',x:12.0,z:12.8,av:{color:'#e8e4ff',expr:'sleepy',face:'glasses',head:'none',prop:'book'}},{name:'구름',x:5.6,z:17.8,av:{color:'#ffe6ec',expr:'wink',face:'none',head:'bow',prop:'balloon'}},{name:'바다',x:11.6,z:17.6,av:{color:'#e0f0fb',expr:'normal',face:'sunglasses',head:'none',prop:'lantern'}},{name:'모래',x:8.4,z:11.6,av:{color:'#fbeed6',expr:'surprised',face:'none',head:'beanie',prop:'none'}}];
const NPC_SAY=['오늘 몇 쪽 읽었어요?','방금 한 권 완독했어요!','비 오는 날엔 스탠드 켜고 읽는 게 최고예요','『아몬드』 읽어 본 분 계세요?','저는 지금 150쪽쯤이에요','모닥불에서 같이 읽을 분~','30분만 읽어도 오늘은 성공이죠','다음엔 어떤 책 읽을지 고민 중이에요'];
const NPC_REPLY=['저도요!','오, 좋은데요','어떤 책이에요?','화이팅이에요','같이 읽어요'];
const VIL={X:36,Y:27,minX:1.2,minZ:3.4,start:[4.0,4.0],home:[4.0,3.8]}; // 걸어 다니는 큰 마을. 카메라가 유령을 따라간다
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

/* ===== 3D: 원목 방 + 유령 (three.js) ===== */
const G3=(function(){
 if(typeof THREE==='undefined')return null;
 const cv=document.getElementById('stage'),wrap=document.getElementById('stageWrap');
 let R;try{R=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true})}catch(e){return null}
 R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
 // 툰 셰이딩(결정 #36): 빛을 3단으로 끊어 칠하고 갈색 외곽선을 두른다. 주소 끝에 ?toon=0을 붙이면 예전 소프트 3D로 보인다
 const TOON=!/[?&]toon=0/.test(location.search);
 const RAMP=new THREE.DataTexture(new Uint8Array([150,150,150,255,205,205,205,255,255,255,255,255]),3,1,THREE.RGBAFormat);RAMP.minFilter=RAMP.magFilter=THREE.NearestFilter;RAMP.needsUpdate=true;
 const mat=(c,r=.5,o={})=>{if(!TOON)return new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0,...o});const {roughness,metalness,...q}=o;return new THREE.MeshToonMaterial({color:c,gradientMap:RAMP,...q})};
 const OLM=new THREE.MeshBasicMaterial({color:'#5a4332',side:THREE.BackSide});   // 외곽선: 뒤집은 껍데기를 법선 방향으로 살짝 부풀림
 OLM.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','vec3 transformed=position+normalize(normal)*0.022;')};
 let OL=TOON;   // 멀리 있는 숲처럼 개수가 많은 것은 잠시 꺼서 그리는 양을 줄인다
 const mesh=(g,m,p=[0,0,0],s=[1,1,1],r=[0,0,0])=>{const x=new THREE.Mesh(g,m);x.position.set(...p);x.scale.set(...s);x.rotation.set(...r);x.castShadow=true;x.receiveShadow=true;
  if(OL){if(!g.boundingSphere)g.computeBoundingSphere();if(g.boundingSphere.radius>.2){const o=new THREE.Mesh(g,OLM);o.userData.nodim=true;o.castShadow=o.receiveShadow=false;x.add(o)}}   // 눈·볼 같은 작은 조각은 외곽선 없음
  return x};
 const sph=r=>new THREE.SphereGeometry(r,40,24),cap=(r,l)=>new THREE.CapsuleGeometry(r,l,10,20);
 function dispose(g){g.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material&&n.material.dispose)n.material.dispose()})}
 function woodTex({base='#d8a868',planks=8,vertical=false,seed=3,tone=.07}){
  const W=512,c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d');
  let s=seed;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const n=parseInt(base.slice(1),16),Rr=n>>16,Gg=n>>8&255,Bb=n&255,pw=W/planks;
  const tint=f=>`rgb(${Math.min(255,Rr*f|0)},${Math.min(255,Gg*f|0)},${Math.min(255,Bb*f|0)})`;
  for(let i=0;i<planks;i++){
   const f=1+(rnd()-.5)*tone*2;g.fillStyle=tint(f);
   g.save();if(vertical){g.translate(i*pw,0);g.fillRect(0,0,pw,W)}else{g.translate(0,i*pw);g.fillRect(0,0,W,pw)}
   for(let k=0;k<14;k++){const o=rnd()*pw,amp=1+rnd()*2.5,ph=rnd()*6,fr=.01+rnd()*.02;
    g.strokeStyle=`rgba(${Rr*.62|0},${Gg*.55|0},${Bb*.45|0},${.12+rnd()*.14})`;g.lineWidth=.6+rnd()*1.2;g.beginPath();
    for(let t=0;t<=W;t+=8){const y=o+Math.sin(t*fr+ph)*amp;if(vertical){t?g.lineTo(y,t):g.moveTo(y,t)}else{t?g.lineTo(t,y):g.moveTo(t,y)}}g.stroke()}
   if(rnd()<.4){const kx=rnd()*W,ky=pw*(.3+rnd()*.4);g.fillStyle=`rgba(${Rr*.55|0},${Gg*.45|0},${Bb*.35|0},.35)`;g.beginPath();if(vertical)g.ellipse(ky,kx,3,7,0,0,7);else g.ellipse(kx,ky,7,3,0,0,7);g.fill()}
   g.fillStyle='rgba(60,35,15,.38)';if(vertical)g.fillRect(0,0,1.6,W);else g.fillRect(0,0,W,1.6);
   g.restore();
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
 }
 const wm=opt=>mat('#ffffff',.78,{map:woodTex(opt)});

 /* 유령 */
 const HR=.55,KK=1.1;
 const surf=(x,y)=>KK*HR*Math.sqrt(Math.max(1-(x/HR)**2-(y/HR)**2,.02));
 function build(o){
  const root=new THREE.Group(),P={steam:[]};
  const sheetM=mat(o.color,.42,{side:THREE.DoubleSide}),ink=mat('#2a2438',.1),white=mat('#ffffff',.3),pink=mat('#f08aa2',.4);
  const handM=mat(new THREE.Color(o.color).lerp(new THREE.Color('#2c3050'),.1),.45);
  const oval=new THREE.Group();oval.position.set(-.27,1.25,.5);oval.rotation.set(0,-.48,.35);
  oval.add(mesh(sph(.12),handM,[0,0,0],[.9,1.15,.8]));root.add(oval);
  const tear=new THREE.Group();tear.position.set(.27,1.25,.5);tear.rotation.set(0,.48,-.35);   // 양손 모두 동그란 주먹 (결정 #42): 오른손은 왼손과 좌우 대칭
  tear.add(mesh(sph(.12),handM,[0,0,0],[.9,1.15,.8]));
  P.tailM=new THREE.Mesh();   // 예전의 뾰족한 손끝 자리. 지금은 쓰지 않지만 포즈 계산이 참조하므로 빈 객체로 둔다
  root.add(tear);
  P.hL=tear;P.hR=oval;
  const prof=[[.84,.3],[.8,.42],[.72,.7],[.64,.98],[.58,1.22],[.56,1.46],[.58,1.7],[.54,1.92],[.42,2.1],[.24,2.22],[0,2.25]].map(([r,y])=>new THREE.Vector2(r,y));
  const g=new THREE.LatheGeometry(prof,72),pa=g.attributes.position;
  for(let i=0;i<pa.count;i++){const y=pa.getY(i),t=Math.max(0,Math.min(1,(.8-y)/.5));pa.setY(i,y+t*.09*Math.sin(5*Math.atan2(pa.getZ(i),pa.getX(i))))}
  g.computeVertexNormals();root.add(mesh(g,sheetM));
  const H=new THREE.Group();H.position.set(0,1.7,0);root.add(H);P.head=H;
  const onH=(x,y,d=0)=>[x,y,surf(x,y)-d];
  const dot=(s,sc=1)=>{const e=new THREE.Group();e.position.set(...onH(s*.2,.02,.03));e.add(mesh(sph(.07*sc),ink,[0,0,0],[.9,1.3,.6]));e.add(mesh(sph(.022*sc),white,[-.02*sc,.035*sc,.04*sc]));H.add(e)};
  const arc=(x,y,up,r=.065)=>H.add(mesh(new THREE.TorusGeometry(r,.016,8,20,Math.PI),ink,[x,y,surf(x,y)-.005],[1,1,1],[0,0,up?0:Math.PI]));
  const mouth=(sx,sy,y=-.14)=>H.add(mesh(sph(.04),ink,[0,y,surf(0,y)-.005],[sx,sy,.5]));
  const smile=(r,y)=>H.add(mesh(new THREE.TorusGeometry(r,.014,8,20,Math.PI),ink,[0,y,surf(0,y)-.004],[1,1,1],[0,0,Math.PI]));
  const ex=o.expr;
  if(ex==='normal'||!ex){dot(1);dot(-1);mouth(.9,1.25)}
  if(ex==='happy'){arc(.2,.03,true);arc(-.2,.03,true);smile(.075,-.1)}
  if(ex==='surprised'){dot(1,1.35);dot(-1,1.35);mouth(1.3,1.9,-.16)}
  if(ex==='sleepy'){arc(.2,.02,false,.06);arc(-.2,.02,false,.06);mouth(.7,.7,-.13)}
  if(ex==='wink'){dot(1);arc(-.2,.03,true);smile(.07,-.1)}
  const cheek=mat('#ff8fa3',.6,{transparent:true,opacity:.6});
  [1,-1].forEach(s=>H.add(mesh(sph(.11),cheek,onH(s*.32,-.1,.03),[1,.7,.35])));
  if(o.face==='glasses'){const z=surf(.2,.02)+.012;[1,-1].forEach(s=>H.add(mesh(new THREE.TorusGeometry(.15,.017,10,32),ink,[s*.2,.02,z])));H.add(mesh(new THREE.CylinderGeometry(.011,.011,.1,6),ink,[0,.02,z],[1,1,1],[0,0,Math.PI/2]))}
  if(o.face==='sunglasses'){const z=surf(.2,.02)+.03,lens=mat('#1d1a2b',.08);[1,-1].forEach(s=>H.add(mesh(sph(.155),lens,[s*.2,.02,z],[1,.78,.3])));H.add(mesh(new THREE.CylinderGeometry(.012,.012,.12,6),ink,[0,.04,z+.01],[1,1,1],[0,0,Math.PI/2]))}
  if(o.face==='bandaid'){const b=new THREE.Group();b.position.set(...onH(-.3,-.16,-.02));b.rotation.z=.55;b.rotation.y=-.3;b.add(mesh(new THREE.BoxGeometry(.2,.07,.02),mat('#f0c9a0',.6)));b.add(mesh(new THREE.BoxGeometry(.07,.07,.025),mat('#e6b184',.6)));H.add(b)}
  if(o.head==='beanie'){
   const hat=new THREE.Group();hat.position.set(0,.1,0);hat.rotation.x=-.18;const hm=mat('#d4574d',.8);
   hat.add(mesh(new THREE.SphereGeometry(.66,40,20,0,Math.PI*2,0,Math.PI/2),hm));
   hat.add(mesh(new THREE.TorusGeometry(.64,.08,12,48),mat('#a83f38',.8),[0,.02,0],[1,1,1],[Math.PI/2,0,0]));
   hat.add(mesh(sph(.13),mat('#f6efe0',.9),[0,.68,0]));H.add(hat);
  }
  if(o.head==='bow'){
   const b=new THREE.Group();b.position.set(.34,.5,.22);b.rotation.z=-.5;const bm=mat('#f06a8a',.4);
   b.add(mesh(sph(.12),bm,[.12,0,0],[1.2,.85,.5],[0,0,.25]));b.add(mesh(sph(.12),bm,[-.12,0,0],[1.2,.85,.5],[0,0,-.25]));b.add(mesh(sph(.06),mat('#d9486a',.4),[0,0,.02]));H.add(b);
  }
  if(o.head==='crown'){
   const c=new THREE.Group();c.position.set(0,.5,0);c.rotation.x=-.1;const gm=mat('#f2c94c',.3,{emissive:'#6b4a00',emissiveIntensity:.18,side:THREE.DoubleSide});
   c.add(mesh(new THREE.CylinderGeometry(.3,.27,.13,28,1,true),gm,[0,.065,0]));
   for(let i=0;i<5;i++){const a=i/5*Math.PI*2,x=Math.sin(a)*.29,z=Math.cos(a)*.29;c.add(mesh(new THREE.ConeGeometry(.07,.18,12),gm,[x,.21,z]));c.add(mesh(sph(.03),mat('#e0525f',.3),[x,.31,z]))}
   H.add(c);
  }
  if(o.head==='sprout'){
   const s=new THREE.Group();s.position.set(0,.55,0);const gm=mat('#6fb36a',.5);
   s.add(mesh(new THREE.CylinderGeometry(.012,.014,.22,8),gm,[0,.11,0]));
   s.add(mesh(sph(.1),gm,[.08,.24,0],[1,.35,.6],[0,0,-.5]));s.add(mesh(sph(.1),gm,[-.08,.22,0],[1,.35,.6],[0,0,.5]));H.add(s);P.sprout=s;
  }
  const hand=new THREE.Group();hand.position.set(0,0,.02);P.hR.add(hand);P.hold=o.prop!=='none';
  if(o.prop==='book'){
   const b=new THREE.Group();b.position.set(0,.04,.12);b.rotation.x=.3;b.add(mesh(new THREE.BoxGeometry(.3,.23,.05),mat('#5f7aa0',.6)));b.add(mesh(new THREE.BoxGeometry(.25,.19,.054),mat('#fbf4e2',.7),[.015,0,0]));hand.add(b);P.handBook=b;
   P.book=new THREE.Group();P.book.position.set(0,1.0,.8);P.book.rotation.x=.3;
   P.book.add(mesh(new THREE.BoxGeometry(.48,.38,.07),mat('#5f7aa0',.6)));P.book.add(mesh(new THREE.BoxGeometry(.4,.3,.075),mat('#fbf4e2',.7),[.02,0,0]));
   P.book.visible=false;root.add(P.book);
  }
  if(o.prop==='mug'){
   const m=new THREE.Group();m.position.set(0,.1,.13);const cm=mat('#e0805a',.4);
   m.add(mesh(new THREE.CylinderGeometry(.075,.065,.13,24),cm));m.add(mesh(new THREE.CylinderGeometry(.062,.062,.01,24),mat('#5a3a22',.3),[0,.062,0]));
   m.add(mesh(new THREE.TorusGeometry(.04,.011,8,16,Math.PI),cm,[.08,0,0],[1,1,1],[0,0,-Math.PI/2]));
   for(let i=0;i<3;i++){const sm=mat('#ffffff',.9,{transparent:true,opacity:.5});const sp=mesh(sph(.028),sm,[0,.1,0]);sp.castShadow=false;m.add(sp);P.steam.push(sp)}
   hand.add(m);
  }
  if(o.prop==='lantern'){
   const l=new THREE.Group();l.position.set(0,-.12,.1);const dm=mat('#3a2c20',.5);
   l.add(mesh(new THREE.CylinderGeometry(.075,.075,.15,16),mat('#ffd98a',.3,{emissive:'#ffb84a',emissiveIntensity:.9}),[0,-.1,0]));
   l.add(mesh(new THREE.CylinderGeometry(.09,.09,.025,16),dm,[0,-.02,0]));l.add(mesh(new THREE.CylinderGeometry(.09,.09,.025,16),dm,[0,-.18,0]));
   l.add(mesh(new THREE.TorusGeometry(.05,.008,8,16,Math.PI),dm,[0,.0,0]));hand.add(l);
  }
  if(o.prop==='balloon'){
   const b=new THREE.Group();b.add(mesh(new THREE.CylinderGeometry(.004,.004,.95,6),ink,[0,.48,0]));
   b.add(mesh(sph(.24),mat('#e8584f',.2),[0,1.12,0],[1,1.18,1]));b.add(mesh(new THREE.ConeGeometry(.03,.05,10),mat('#c9443c',.3),[0,.88,0],[1,1,1],[Math.PI,0,0]));
   hand.add(b);P.balloon=b;
  }
  root.traverse(n=>{if(n.isMesh)n.castShadow=false});   // 캐릭터(유령)는 바닥에 그림자를 드리우지 않는다
  return {root,P};
 }
 function applyPose(M,s){
  const {root,P}=M,sw=Math.sin(s.t*10)*s.mv,k=s.sit;
  root.position.set(s.x,s.y+Math.abs(Math.sin(s.t*10))*.05*s.mv+.1+Math.sin(s.t*2.2)*.04,s.z);
  root.rotation.set(.1*s.mv,s.rot,Math.sin(s.t*10)*.07*s.mv,'YXZ');
  const hold=P.hold?1:0,lp=(a,b)=>a+(b-a)*k;
  P.hL.position.set(lp(.27,.29),lp(1.25-sw*.05,1.0),lp(.5,.82));
  const ts=1-.98*k;P.tailM.scale.set(ts,ts,.6*ts);
  P.hL.rotation.z=Math.sin(s.t*3)*.12*(1-s.mv)*(1-k)+sw*.1;
  const o0=hold?[-.34,1.14,.64]:[-.27,1.25+sw*.05,.5];
  P.hR.position.set(lp(o0[0],-.29),lp(o0[1],1.0),lp(o0[2],.82));
  P.head.rotation.z=Math.sin(s.t*5)*.05*s.mv;P.head.rotation.y=Math.sin(s.t*1.2)*.08*(1-s.mv)*(1-k);
  if(P.sprout)P.sprout.rotation.z=Math.sin(s.t*2.4)*.15+Math.sin(s.t*10)*.12*s.mv;
  if(P.balloon)P.balloon.rotation.z=Math.sin(s.t*1.6)*.1+Math.sin(s.t*10)*.06*s.mv;
  P.steam.forEach((m,i)=>{const p=(s.t*.55+i/3)%1;m.position.y=.1+p*.3;m.position.x=Math.sin(p*6+i)*.02;m.material.opacity=(1-p)*.55;m.scale.setScalar(.6+p*.9)});
  if(P.book){const rd=M.reading!==false;P.book.visible=rd&&k>.6;P.handBook.visible=rd&&k<=.6}
 }

 /* 방 */
 const scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xffffff,0xb9a98c,TOON?.5:.66));   // 툰은 3단 음영이 밝게 칠해져서 조명을 조금 낮춘다
 const sun=new THREE.DirectionalLight(0xfff2dc,TOON?.42:.5);sun.position.set(9,14,6);sun.castShadow=true;
 Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:1,far:40});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0005;sun.shadow.normalBias=.03;scene.add(sun);scene.add(sun.target);
 const cam=new THREE.OrthographicCamera(-8,8,8,-8,.1,100),T=new THREE.Vector3(5,1.1,4),dirV=new THREE.Vector3(1,.82,1).normalize();
 const FUR=['sofa','lamp','shelf','calendar','mirror','window','door'];
 let roomG=null,FG={},matsOf={},pickables=[],floorMesh=null,bulb=null,lampGlow=null,lampLight=null,sofaExtra=null,shelfBooks=null,doorGlow=null,mirrorCv=null,mirrorTex=null,calCv=null,calTex=null,winCv=null,winTex=null;
 let view='room',villageG=null,vilPick=[],vilMats={},vilFlames=[],vilWins=[],vilLabels=[],vilKey='',vilFiresG=null,vilLamp=false,vilBub=[],vilNpcs=[],vilHouses=[],campG=null,campFire=null,campGuests=[];
 let M=null,ghostKey='',dimKey='',extraKey='',shelfKey='',mirrorKey='',calKey='',winKey='',pulseF=null,hoverF=null,matsDirty=true,ov={},flashUntil={};
 const clear=g=>{while(g.children.length){const c=g.children.pop();dispose(c)}};
 function buildRoom(){
  if(roomG){scene.remove(roomG);dispose(roomG)}
  roomG=new THREE.Group();scene.add(roomG);FG={};matsOf={};pickables=[];
  const {X,Y,d}=L,E=L.shelfEnd;
  const B=(x,y,z,w,dp,h,c,g=roomG,m=null)=>{const k=mesh(new THREE.BoxGeometry(w,h,dp),m||mat(c,.85),[x+w/2,z+h/2,y+dp/2]);g.add(k);return k};
  const fg=(n,off)=>{const g=new THREE.Group();g.position.set(off[0],0,off[1]);roomG.add(g);FG[n]=g;return g};
  const hullBox=(g,x,y,z,w,dp,h,f)=>{const k=new THREE.Mesh(new THREE.BoxGeometry(w,h,dp),new THREE.MeshBasicMaterial({visible:false}));k.position.set(x+w/2,z+h/2,y+dp/2);k.userData={f,hull:true};g.add(k);pickables.push(k)};
  B(0,0,-.45,X,Y,.45,0,roomG,wm({base:'#a8743f',planks:6,seed:11}));
  floorMesh=B(0,0,0,X,Y,.02,0,roomG,wm({base:'#e0b074',planks:16,seed:5,tone:.06}));floorMesh.userData.floor=true;pickables.push(floorMesh);
  B(3.2+d.sofa[0],3.2+d.sofa[1],.02,4.2,3.8,.02,'#cdbf94');
  B(0,-.3,0,X,.3,4.8,0,roomG,wm({base:'#ecd3a4',planks:20,vertical:true,seed:7,tone:.04}));
  B(-.3,-.3,0,.3,Y+.3,4.8,0,roomG,wm({base:'#ecd3a4',planks:20,vertical:true,seed:9,tone:.04}));
  B(0,-.02,0,X,.08,.35,0,roomG,wm({base:'#8a5f3a',planks:2,vertical:true,seed:2}));
  let g=fg('window',d.win);
  B(2.55,0,1.75,2.1,.06,2.2,0,g,wm({base:'#8a5f3a',planks:3,seed:4}));B(2.7,0,1.9,1.8,.08,1.9,'#cfe6ee',g);B(3.56,0,1.9,.08,.1,1.9,'#8a5f3a',g);B(2.7,0,2.81,1.8,.1,.08,'#8a5f3a',g);
  winCv=document.createElement('canvas');winCv.width=180;winCv.height=190;winTex=new THREE.CanvasTexture(winCv);
  g.add(mesh(new THREE.PlaneGeometry(1.8,1.9),new THREE.MeshBasicMaterial({map:winTex}),[3.6,2.85,.09]));
  hullBox(g,2.4,0,1.6,2.4,.4,2.6,'window');
  g=fg('door',d.door);
  B(8.4,0,0,1.2,.08,3.3,0,g,wm({base:'#9c6b3f',planks:4,vertical:true,seed:6}));B(8.55,.08,1.9,.9,.03,1.1,'#a8774a',g);B(8.55,.08,.3,.9,.03,1.3,'#a8774a',g);
  g.add(mesh(sph(.045),mat('#e6c25a',.3),[9.3,1.65,.14]));
  hullBox(g,8.3,0,0,1.4,.4,3.5,'door');
  g=fg('mirror',d.mir);
  B(5.9,.15,0,1.2,.22,3.7,0,g,wm({base:'#8a6440',planks:2,vertical:true,seed:3}));
  mirrorCv=document.createElement('canvas');mirrorCv.width=128;mirrorCv.height=300;mirrorTex=new THREE.CanvasTexture(mirrorCv);
  g.add(mesh(new THREE.PlaneGeometry(.9,3.3),new THREE.MeshBasicMaterial({map:mirrorTex}),[6.5,1.85,.385]));
  hullBox(g,5.85,0,0,1.3,.5,3.8,'mirror');
  g=fg('shelf',[0,0]);
  B(0,.5,0,.12,E-.4,4.45,0,g,wm({base:'#7d5330',planks:3,seed:13}));B(0,.5,0,.88,.1,4.45,0,g,wm({base:'#7d5330',planks:3,seed:14}));B(0,E,0,.88,.1,4.45,0,g,wm({base:'#7d5330',planks:3,seed:15}));
  [0,1.1,2.2,3.3,4.4].forEach((z,i)=>B(0,.6,z,.88,E-.6,.12,0,g,wm({base:'#8a5f3a',planks:3,seed:20+i})));
  shelfBooks=new THREE.Group();g.add(shelfBooks);
  hullBox(g,0,.5,0,.95,E-.35,4.6,'shelf');
  g=fg('calendar',[0,0]);
  const cy=L.cal.y;
  B(0,cy,1.15,.1,1.9,2.5,0,g,wm({base:'#8a5f3a',planks:2,seed:30}));
  calCv=document.createElement('canvas');calCv.width=240;calCv.height=316;calTex=new THREE.CanvasTexture(calCv);
  const cf=new THREE.Mesh(new THREE.PlaneGeometry(1.7,2.3),new THREE.MeshBasicMaterial({map:calTex}));cf.rotation.y=Math.PI/2;cf.position.set(.105,2.4,cy+.95);g.add(cf);
  hullBox(g,0,cy-.1,1.05,.3,2.1,2.7,'calendar');
  g=fg('sofa',d.sofa);
  B(4,3.8,0,1.8,1.8,.55,'#c9784c',g);B(4,3.8,.55,.45,1.8,.95,'#c9784c',g);B(4.45,3.8,.55,1.35,.35,.42,'#d48555',g);B(4.45,5.25,.55,1.35,.35,.42,'#d48555',g);B(4.45,4.15,.55,1.3,1.1,.18,'#e39a68',g);
  sofaExtra=new THREE.Group();g.add(sofaExtra);
  hullBox(g,4,3.8,0,1.85,1.85,1.55,'sofa');
  g=fg('lamp',d.sofa);
  B(4.25,6.05,0,.36,.36,.08,'#6b4a2c',g);B(4.4,6.2,.08,.06,.06,2.6,'#8a5f3a',g);
  bulb=B(4.15,5.95,2.6,.56,.56,.55,'#e9dcc0',g);bulb.material.userData.keepEmis=true;
  lampGlow=new THREE.Mesh(new THREE.CircleGeometry(1.9,40),new THREE.MeshBasicMaterial({color:'#ffd46b',transparent:true,opacity:.33,depthWrite:false}));lampGlow.rotation.x=-Math.PI/2;lampGlow.position.set(4.9,.05,5.4);lampGlow.userData.nodim=true;g.add(lampGlow);
  lampLight=new THREE.PointLight(0xffcf7a,0,6);lampLight.position.set(4.45,2.9,6.2);g.add(lampLight);
  hullBox(g,4.1,5.9,0,.66,.66,3.2,'lamp');
  matsDirty=true;dimKey=extraKey=shelfKey=mirrorKey=calKey=winKey='';
 }
 function collect(){FUR.forEach(f=>{const set=new Set();FG[f].traverse(n=>{if(n.isMesh&&!n.userData.hull&&!n.userData.nodim&&n.material)set.add(n.material)});matsOf[f]=[...set]})}
 function emis(f,on){const ms=f&&(matsOf[f]||vilMats[f]);if(!ms)return;
  ms.forEach(m=>{if(m.emissive&&!m.userData.keepEmis)m.emissive.setHex(on?0x3a3015:0)})}
 function setHover(f){if(hoverF===f)return;emis(hoverF,false);hoverF=f;emis(f,true)}
 function flash(f){flashUntil[f]=performance.now()+1000}

 function drawMirror(a){
  const g=mirrorCv.getContext('2d'),w=128,h=300;
  const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#dcebee');gr.addColorStop(1,'#c3dade');g.fillStyle=gr;g.fillRect(0,0,w,h);
  g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.moveTo(18,0);g.lineTo(44,0);g.lineTo(20,h);g.lineTo(6,h);g.fill();
  mirrorTex.needsUpdate=true;return; // 비치는 모습은 그리지 않는다 (맑은 유리만)
  const cx=64,top=96,bot=232;
  g.fillStyle=a.color;g.strokeStyle='rgba(44,48,80,.18)';g.lineWidth=2;g.beginPath();g.moveTo(cx-34,bot);g.bezierCurveTo(cx-40,top+40,cx-30,top,cx,top);g.bezierCurveTo(cx+30,top,cx+40,top+40,cx+34,bot);
  for(let i=0;i<4;i++){const x1=cx+34-i*17,x2=x1-17;g.quadraticCurveTo((x1+x2)/2,bot+(i%2?12:6),x2,bot)}g.closePath();g.fill();g.stroke();
  const ey=top+42;g.fillStyle='#2a2438';
  if(a.expr==='happy'||a.expr==='sleepy'||a.expr==='wink'){g.strokeStyle='#2a2438';g.lineWidth=2.4;[-13,13].forEach((dx,i)=>{if(a.expr==='wink'&&i===1){g.beginPath();g.arc(cx+dx,ey,4.5,Math.PI,0);g.stroke()}else{g.beginPath();g.arc(cx+dx,ey,4.5,a.expr==='sleepy'?0:Math.PI,a.expr==='sleepy'?Math.PI:0);g.stroke()}})}
  else{[-13,13].forEach(dx=>{g.beginPath();g.ellipse(cx+dx,ey,3.6,5,0,0,7);g.fill()})}
  g.fillStyle='rgba(255,143,163,.6)';[-24,24].forEach(dx=>{g.beginPath();g.ellipse(cx+dx,ey+11,7,4.5,0,0,7);g.fill()});
  g.fillStyle='#2a2438';g.beginPath();g.ellipse(cx,ey+13,2.6,3.4,0,0,7);g.fill();
  if(a.face==='glasses'||a.face==='sunglasses'){g.strokeStyle='#2a2438';g.lineWidth=2.4;g.fillStyle=a.face==='sunglasses'?'#1d1a2b':'rgba(255,255,255,.2)';[-13,13].forEach(dx=>{g.beginPath();g.arc(cx+dx,ey,10,0,7);g.fill();g.stroke()})}
  if(a.head==='beanie'){g.fillStyle='#d4574d';g.beginPath();g.moveTo(cx-38,top+26);g.bezierCurveTo(cx-38,top-22,cx+38,top-22,cx+38,top+26);g.fill();g.fillStyle='#a83f38';g.fillRect(cx-40,top+18,80,12);g.fillStyle='#f6efe0';g.beginPath();g.arc(cx,top-12,7,0,7);g.fill()}
  if(a.head==='bow'){g.fillStyle='#f06a8a';g.beginPath();g.ellipse(cx+24,top+8,11,7,-.5,0,7);g.ellipse(cx+40,top+2,11,7,.3,0,7);g.fill()}
  if(a.head==='crown'){g.fillStyle='#f2c94c';g.beginPath();g.moveTo(cx-22,top+4);g.lineTo(cx-22,top-14);g.lineTo(cx-11,top-4);g.lineTo(cx,top-18);g.lineTo(cx+11,top-4);g.lineTo(cx+22,top-14);g.lineTo(cx+22,top+4);g.fill()}
  if(a.head==='sprout'){g.strokeStyle='#5aa356';g.lineWidth=3;g.beginPath();g.moveTo(cx,top+2);g.lineTo(cx,top-14);g.stroke();g.fillStyle='#6fb36a';g.beginPath();g.ellipse(cx+8,top-16,8,4,-.5,0,7);g.ellipse(cx-8,top-14,8,4,.5,0,7);g.fill()}
  mirrorTex.needsUpdate=true;
 }
 /* 창밖 풍경: 계절(월)과 날씨(날짜마다 바뀜)로 그린다. 시간대는 고정 (#8) */
 function drawWindow(w){
  const g=winCv.getContext('2d'),W=180,H=190;let sd=(w.seed%2147483646)+1;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const SKY={맑음:['#6fbdf0','#d8f0ff'],구름:['#7dbff0','#dcefff'],흐림:['#a3b0bb','#d9dfe4'],비:['#76899b','#b2bfcb'],눈:['#b0c0d1','#eef3f8'],안개:['#d4dadd','#eef1f2']}[w.weather];
  const gr=g.createLinearGradient(0,0,0,H*.7);gr.addColorStop(0,SKY[0]);gr.addColorStop(1,SKY[1]);g.fillStyle=gr;g.fillRect(0,0,W,H);
  if(w.weather==='맑음'||w.weather==='구름'){const sx=40+rnd()*100;g.fillStyle='rgba(255,236,140,.35)';g.beginPath();g.arc(sx,38,26,0,7);g.fill();g.fillStyle='#ffe27a';g.beginPath();g.arc(sx,38,15,0,7);g.fill()}
  const cloud=(x,y,s,c)=>{g.fillStyle=c;[[0,0,16],[14,-5,13],[-14,-3,12],[26,2,10],[-26,3,9]].forEach(([dx,dy,r])=>{g.beginPath();g.arc(x+dx*s,y+dy*s,r*s,0,7);g.fill()})};
  const nc={맑음:1,구름:3,흐림:6,비:6,눈:5,안개:2}[w.weather],cc={맑음:'#fff',구름:'#fff',흐림:'#c9d0d6',비:'#8e9eae',눈:'#e3eaf1',안개:'#f3f5f6'}[w.weather];
  for(let i=0;i<nc;i++)cloud(rnd()*W,20+rnd()*60,.7+rnd()*.6,cc);
  const S3={봄:['#a9d98a','#8cc46e','#f4b6c8'],여름:['#6fbb62','#4f9a4a','#3f8a3a'],가을:['#d9a74a','#c98a35',['#e0892f','#c9452f','#e8b73a']],겨울:['#eef3f7','#dce6ee','#c7d3de']}[w.season];
  g.fillStyle=S3[0];g.beginPath();g.moveTo(0,125);g.bezierCurveTo(50,95,110,140,W,110);g.lineTo(W,H);g.lineTo(0,H);g.fill();
  g.fillStyle=S3[1];g.beginPath();g.moveTo(0,150);g.bezierCurveTo(60,128,120,165,W,140);g.lineTo(W,H);g.lineTo(0,H);g.fill();
  for(let i=0;i<4;i++){const x=20+i*45+rnd()*14,y=140+rnd()*14;
   g.fillStyle='#7a5536';g.fillRect(x-2.5,y-26,5,28);
   if(w.season==='겨울'){g.strokeStyle='#7a5536';g.lineWidth=2;[[-14,-48],[0,-56],[14,-46]].forEach(([dx,dy])=>{g.beginPath();g.moveTo(x,y-26);g.lineTo(x+dx,y+dy+8);g.stroke()});g.fillStyle='#fff';g.beginPath();g.arc(x,y-30,5,0,7);g.fill()}
   else{const cols=w.season==='가을'?S3[2]:[S3[2]];cols.forEach((c,k)=>{g.fillStyle=c;g.beginPath();g.arc(x+(k-1)*7,y-38+k*3,15,0,7);g.fill()});
    if(w.season==='봄'){g.fillStyle='#fff';for(let k=0;k<5;k++){g.beginPath();g.arc(x-10+rnd()*20,y-48+rnd()*18,1.6,0,7);g.fill()}}}}
  if(w.weather==='비'){g.strokeStyle='rgba(235,244,252,.75)';g.lineWidth=1.2;for(let i=0;i<46;i++){const x=rnd()*W,y=rnd()*H;g.beginPath();g.moveTo(x,y);g.lineTo(x-4,y+11);g.stroke()}}
  if(w.weather==='눈'){g.fillStyle='rgba(255,255,255,.92)';for(let i=0;i<46;i++){g.beginPath();g.arc(rnd()*W,rnd()*H,1.3+rnd()*1.6,0,7);g.fill()}}
  if(w.weather==='안개'){const fg=g.createLinearGradient(0,0,0,H);fg.addColorStop(0,'rgba(255,255,255,.35)');fg.addColorStop(1,'rgba(255,255,255,.6)');g.fillStyle=fg;g.fillRect(0,0,W,H)}
  winTex.needsUpdate=true;
 }
 function drawCal(c){
  const g=calCv.getContext('2d'),W=240,H=316,cw=34.3,ch=30;
  g.fillStyle='#fbf3e2';g.fillRect(0,0,W,H);
  g.fillStyle='#b5453a';g.fillRect(0,0,W,48);
  g.fillStyle='#ffffff';g.font='bold 24px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(c.m+'월',W/2,25);
  g.fillStyle='#8a7d6a';g.font='12px sans-serif';['일','월','화','수','목','금','토'].forEach((n,i)=>g.fillText(n,17+i*cw,66));
  for(let d=1;d<=c.dim;d++){const idx=c.first+d-1,x=17+(idx%7)*cw,y=92+Math.floor(idx/7)*ch,on=c.marks.includes(d);
   if(on){g.fillStyle='#cfe3c8';g.beginPath();g.arc(x,y,13,0,7);g.fill()}
   if(d===c.today){g.strokeStyle='#3b3226';g.lineWidth=2;g.beginPath();g.arc(x,y,13,0,7);g.stroke()}
   g.fillStyle='#3b3226';g.font='13px sans-serif';g.fillText(String(d),x,y-1);
   if(on){g.fillStyle='#4f7a5a';g.beginPath();g.arc(x,y+9,2,0,7);g.fill()}}
  g.fillStyle='#3b3226';g.font='bold 14px sans-serif';g.fillText('완독 '+c.done+'/'+c.goal+'권',W/2,H-18);
  calTex.needsUpdate=true;
 }
 function rebuildBooks(titles){
  clear(shelfBooks);let i=0;
  [3.3,2.2,1.1,0].forEach(z=>{for(let k=0;k<L.K;k++){const t=titles[i];if(t){const y=.75+k*.42,h=.66+((t.length*7)%5)*.06;shelfBooks.add(mesh(new THREE.BoxGeometry(.6,h,.32),mat(bookColor(t),.85),[.48,z+.12+h/2,y+.16]))}i++}});
 }
 function sync(c){
  const key=JSON.stringify(c.a);
  if(key!==ghostKey){ghostKey=key;if(M){scene.remove(M.root);dispose(M.root)}M=build(c.a);scene.add(M.root)}
  M.reading=c.reading;const bk=c.books.join('|');if(bk!==shelfKey){shelfKey=bk;rebuildBooks(c.books);matsDirty=true}
  const ek=(c.reading?'r':'e')+(c.sitting?1:0)+(c.reading?c.title:'');
  if(ek!==extraKey){extraKey=ek;clear(sofaExtra);
   const B=(x,y,z,w,dp,h,col)=>sofaExtra.add(mesh(new THREE.BoxGeometry(w,h,dp),mat(col,.85),[x+w/2,z+h/2,y+dp/2]));
   if(c.reading&&!c.sitting){B(4.95,4.45,.73,.55,.42,.06,bookColor(c.title));B(4.98,4.48,.79,.24,.36,.03,'#fbf6e8');B(5.24,4.48,.79,.24,.36,.03,'#fbf6e8')}
   else if(!c.reading&&!c.sitting)B(4.5,4.35,.73,.28,.65,.38,'#7f9a6d');
   matsDirty=true}
  if(matsDirty){collect();matsDirty=false;dimKey=''}
  const dk=FUR.map(f=>c.dim(f)?1:0).join('');
  if(dk!==dimKey){dimKey=dk;FUR.forEach(f=>{const on=c.dim(f);matsOf[f].forEach(m=>{m.transparent=on;m.opacity=on?.35:1;m.needsUpdate=true})})}
  pulseF=c.pulse;
  const bc=c.lampOn?'#ffd46b':c.lampWarn?'#f0b860':'#e9dcc0';
  bulb.material.color.set(bc);bulb.material.emissive.set(c.lampOn?'#ffcf5a':c.lampWarn?'#f0a030':'#000000');bulb.material.emissiveIntensity=c.lampOn?.9:.5;
  lampGlow.visible=c.lampOn;lampLight.intensity=c.lampOn?.8:0;
  if(key!==mirrorKey){mirrorKey=key;drawMirror(c.a)}
  const ck=JSON.stringify(c.cal);if(ck!==calKey){calKey=ck;drawCal(c.cal)}
  const wk=JSON.stringify(c.win);if(wk!==winKey){winKey=wk;drawWindow(c.win)}
  ov={lamp:c.lampOn||c.lampWarn,newMark:c.newItem,winMark:c.winNew,sofaMark:!c.reading};
  vilLamp=c.lampOn;if(view==='village')syncVillage(c.vil);
 }
 /* 마을: 문으로 나가면 보이는 장면. 내 집, 마을 게시판, 공유방마다 모닥불, 이웃집(창문에 불이 켜짐) */
 const SKYC={맑음:['#9fd8ff','#eaf6ff'],구름:['#a8d6fb','#eef7ff'],흐림:['#b4bec7','#e3e8ec'],비:['#8d9cab','#c3ccd5'],눈:['#c3cfdb','#f1f5f9'],안개:['#dde2e5','#f3f5f6']};
 const clearLabels=()=>{vilLabels.forEach(l=>l.el.remove());vilLabels=[];vilBub.forEach(b=>b.el.remove());vilBub=[];vilNpcs=[]};
 // 말풍선: i=-1이면 내 유령, 아니면 가짜 이웃 번호. 몇 초 뒤 저절로 사라진다
 function say(i,text,ms=5200){vilBub=vilBub.filter(b=>{if(b.i===i){b.el.remove();return false}return true});
  if(view!=='village'&&view!=='shared')return;const e=document.createElement('div');e.className='ov vbub'+(i<0?' me':'');e.textContent=text;wrap.appendChild(e);vilBub.push({el:e,i,until:performance.now()+ms})}
 const addLabel=(html,x,y,z,fire)=>{const e=document.createElement('div');e.className='ov vlab';e.innerHTML=html;wrap.appendChild(e);vilLabels.push({el:e,x,y,z,fire:!!fire})};
 function vcollect(f,g){const set=new Set();g.traverse(n=>{if(n.isMesh&&!n.userData.hull&&!n.userData.nodim&&n.material&&(n.material.isMeshStandardMaterial||n.material.isMeshToonMaterial))set.add(n.material)});vilMats[f]=[...set]}
 function buildVillage(){
  villageG=new THREE.Group();scene.add(villageG);vilPick=[];vilMats={};vilWins=[];vilFlames=[];vilFiresG=null;vilKey='';vilHouses=[];
  const sn=windowScene().season;
  const grass={봄:'#9ccf7a',여름:'#6fbb62',가을:'#c9a24e',겨울:'#eef3f7'}[sn];
  const BB=(x,y,z,w,dp,h,c,g=villageG,m=null)=>{const k=mesh(new THREE.BoxGeometry(w,h,dp),m||mat(c,.9),[x+w/2,z+h/2,y+dp/2]);g.add(k);return k};
  const vhull=(g,x,y,z,w,dp,h,f)=>{const k=new THREE.Mesh(new THREE.BoxGeometry(w,h,dp),new THREE.MeshBasicMaterial({visible:false}));k.position.set(x+w/2,z+h/2,y+dp/2);k.userData={f,hull:true};g.add(k);vilPick.push(k)};
  BB(-70,-70,-.4,166,160,.4,'#8a6a45');   // 땅을 걷는 범위(26×20)보다 훨씬 크게 깔아 지도 끝이 화면에 보이지 않게 한다
  const ground=BB(-70,-70,0,166,160,.02,grass);ground.userData.floor=true;vilPick.push(ground);
  const road='#cdb890',stone='#d9cfb8';
  BB(PLAZA.x0,PLAZA.z0,.02,PLAZA.x1-PLAZA.x0,PLAZA.z1-PLAZA.z0,.02,stone);   // 대화 광장 (돌바닥)
  const curb='#b3a78c';[[PLAZA.x0,PLAZA.z0,PLAZA.x1-PLAZA.x0,.16],[PLAZA.x0,PLAZA.z1-.16,PLAZA.x1-PLAZA.x0,.16],[PLAZA.x0,PLAZA.z0,.16,PLAZA.z1-PLAZA.z0],[PLAZA.x1-.16,PLAZA.z0,.16,PLAZA.z1-PLAZA.z0]].forEach(([x,y,w,d])=>BB(x,y,.02,w,d,.1,curb));
  BB(3.6,3.0,.02,1.0,7.0,.02,road);   // 내 집 앞길: 남쪽(화면 왼쪽 아래)으로 내려가 광장에 닿는다
  BB(PLAZA.x1,11.0,.02,22.7-PLAZA.x1,2.2,.02,road);   // 광장 → 세로 길(x≈22) → 모닥불 구역 입구
  // 갈림길: 집 앞길(z≈5)에서 갈라진다. 계속 남쪽(화면 왼쪽)으로 가면 광장, 동쪽(화면 오른쪽)으로 꺾으면 광장을 거치지 않고 모닥불 구역(공유방) 입구로 간다
  BB(4.6,4.6,.02,18.1,1.0,.02,road);BB(22.0,4.6,.02,.7,8.6,.02,road);
  {const sg=new THREE.Group();sg.position.set(5.8,0,6.8);villageG.add(sg);   // 갈림길 푯말: 돌색 판은 광장(왼쪽), 주황 판은 공유방 모닥불(오른쪽)
   sg.add(mesh(new THREE.BoxGeometry(.14,1.7,.14),mat('#7d5330',.9),[0,.85,0]));
   sg.add(mesh(new THREE.BoxGeometry(1.0,.26,.07),mat('#d9cfb8',.9),[.05,1.35,.5],[1,1,1],[0,-1.45,0]));
   sg.add(mesh(new THREE.BoxGeometry(1.0,.26,.07),mat('#e8764a',.9),[.5,1.0,-.05],[1,1,1],[0,.12,0]));
   addLabel('<b>광장</b>',5.9,1.9,8.2);addLabel('<b>공유방 모닥불</b>',7.4,1.5,6.5)}
  BB(ZONE.x0,ZONE.z0,.03,ZONE.x1-ZONE.x0,ZONE.z1-ZONE.z0,.02,'#a88f68'); // 모닥불 구역 (흙바닥)
  {const fp='#6a4527',fx=ZONE.x0-.2;for(let z=ZONE.z0;z<ZONE.z1;z+=1.1){if(z>ZONE.g0-.3&&z<ZONE.g1+.1)continue;BB(fx,z,0,.12,.12,.7,fp)}
   BB(fx+.04,ZONE.z0,.42,.05,ZONE.g0-ZONE.z0,.07,fp);BB(fx+.04,ZONE.g1,.42,.05,ZONE.z1-ZONE.g1,.07,fp);   // 울타리. g0~g1이 입구
   BB(fx-.04,ZONE.g0-.2,0,.16,.16,1.5,'#7d5330');BB(fx-.04,ZONE.g1,0,.16,.16,1.5,'#7d5330');BB(fx-.08,ZONE.g0-.2,1.5,.24,ZONE.g1-ZONE.g0+.36,.12,'#7d5330')}
  {const st=new THREE.Group();st.position.set(PLAZA.cx,0,PLAZA.cz);villageG.add(st);   // 광장 분수대: 누르면 대화
   st.scale.setScalar(1.15);const stn='#b9b2a2',stl='#d3ccbc',wtr=new THREE.MeshBasicMaterial({color:'#8fd0f0'}),wtl=new THREE.MeshBasicMaterial({color:'#e3f6ff'});
   st.add(mesh(new THREE.CylinderGeometry(1.45,1.5,.32,28),mat(stn,.9),[0,.16,0]));   // 수조 몸통
   st.add(mesh(new THREE.TorusGeometry(1.32,.14,8,32),mat(stl,.9),[0,.36,0],[1,1,1],[Math.PI/2,0,0]));   // 둥근 연석
   {const w=new THREE.Mesh(new THREE.CylinderGeometry(1.22,1.22,.03,28),wtr);w.position.y=.34;w.userData.nodim=true;st.add(w)}   // 물
   st.add(mesh(new THREE.CylinderGeometry(.2,.28,.62,12),mat(stn,.9),[0,.64,0]));   // 가운데 기둥
   st.add(mesh(new THREE.CylinderGeometry(.78,.42,.2,22),mat(stl,.9),[0,.98,0]));   // 아래 물받이
   {const w=new THREE.Mesh(new THREE.CylinderGeometry(.66,.66,.03,22),wtr);w.position.y=1.09;w.userData.nodim=true;st.add(w)}
   st.add(mesh(new THREE.CylinderGeometry(.1,.14,.42,10),mat(stn,.9),[0,1.28,0]));   // 윗기둥
   st.add(mesh(new THREE.CylinderGeometry(.42,.22,.15,18),mat(stl,.9),[0,1.5,0]));   // 위 물받이
   {const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.03,18),wtr);w.position.y=1.59;w.userData.nodim=true;st.add(w)}
   {const jet=new THREE.Group();jet.position.y=1.6;st.add(jet);   // 솟는 물줄기 (일렁이게 한다)
    const c=new THREE.Mesh(new THREE.ConeGeometry(.07,.8,8),wtl);c.position.y=.4;c.userData.nodim=true;jet.add(c);const t=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),wtl);t.position.y=.82;t.userData.nodim=true;jet.add(t);
    vilFlames.push({g:jet,base:1,ph:1.3})}
   vhull(st,-1.6,-1.6,0,3.2,3.2,1.9,'plaza');vcollect('plaza',st)}
  NPCS.forEach((p,i)=>{const gm=build(p.av);gm.root.userData.nodim=true;villageG.add(gm.root);vilNpcs.push({M:gm,x:p.x,z:p.z,rot:Math.atan2(PLAZA.cx-p.x,PLAZA.cz-p.z),ph:i*2.3});addLabel('@'+p.name,p.x,2.65,p.z)});
  BB(16.4,19.6,.03,5.2,4.2,.02,'#7fb6d8');                              // 연못
  const house=(f,x,y,w,d,h,wall,roof,nWin,seed,mine)=>{
   const g=new THREE.Group();villageG.add(g);vilHouses.push([x,y,w,d,!!mine]);
   BB(x,y,0,w,d,h,0,g,wm({base:wall,planks:8,vertical:true,seed}));
   const rf=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.78,h*.7,4),mat(roof,.8));rf.rotation.y=Math.PI/4;rf.position.set(x+w/2,h+h*.35,y+d/2);rf.castShadow=true;g.add(rf);
   for(let i=0;i<nWin;i++){const wx=x+w/(nWin+1)*(i+1)-.17,wmat=mat('#ffd66b',.4,{emissive:'#ffcf5a',emissiveIntensity:1});BB(wx,y+d,h*.45,.34,.05,.4,0,g,wmat);vilWins.push({m:wmat,mine:!!mine,i:seed+i})}
   if(mine)BB(x+w/2-.3,y+d,0,.6,.06,1.2,'#7d5330',g);
   if(f){vhull(g,x-.1,y-.1,0,w+.2,d+.5,h+.8,f);vcollect(f,g)}
  };
  house('home',3.0,1.0,2.0,2.0,1.7,'#c9a06a','#b5653a',2,41,true);
  [[7.2,.6,1.8,1.6,1.4,'#d8b27a','#7d9a6a',2,43],[11.0,.5,1.5,1.3,1.3,'#caa070','#a8663d',1,47],[14.6,.6,1.9,1.7,1.5,'#d3ad78','#6f8fa8',2,53],[18.4,.5,1.6,1.4,1.3,'#c99e68','#a85d4a',1,59],[22.0,.6,1.8,1.6,1.4,'#d8b27a','#8a7aa8',2,61],[25.8,.6,1.7,1.5,1.4,'#d3ad78','#7a9a6a',2,67],[29.6,.5,1.5,1.4,1.3,'#c99e68','#a8663d',1,71],[33.2,.6,1.7,1.5,1.4,'#d8b27a','#6f8fa8',2,73]]
   .forEach(([x,y,w,d,h,wall,roof,n,sd])=>house(null,x,y,w,d,h,wall,roof,n,sd,false));
  const bg=new THREE.Group();villageG.add(bg);const bx=PLAZA.x0+6.5,bz=PLAZA.z0-.7;
  BB(bx,bz,0,.15,.15,1.7,'#7d5330',bg);BB(bx+1.4,bz,0,.15,.15,1.7,'#7d5330',bg);
  BB(bx-.1,bz+.05,.8,1.8,.1,.9,0,bg,wm({base:'#a8743f',planks:4,seed:51}));
  BB(bx-.2,bz-.05,1.7,2.0,.35,.1,'#6a4527',bg);
  [[.3,1.05,'#fbf4e2'],[.8,1.2,'#fff0a8'],[1.2,1.0,'#cdf0e0'],[.55,1.45,'#ffd6e4']].forEach(([dx,nz,c])=>BB(bx+dx,bz+.15,nz,.32,.02,.36,c,bg));
  vhull(bg,bx-.2,bz-.1,0,2.0,.8,2.0,'board');vcollect('board',bg);
  [[PLAZA.x0-.4,PLAZA.z0-.4],[PLAZA.x1+.2,PLAZA.z0-.4],[PLAZA.x0-.4,PLAZA.z1+.2],[PLAZA.x1+.2,PLAZA.z1+.2]].forEach(([x,z])=>{const g=new THREE.Group();g.position.set(x,0,z);villageG.add(g);
   g.add(mesh(new THREE.CylinderGeometry(.05,.06,1.7,8),mat('#5a4332',.8),[0,.85,0]));g.add(mesh(sph(.16),mat('#ffd66b',.4,{emissive:'#ffcf5a',emissiveIntensity:.9}),[0,1.8,0]))});
  let sd=7;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const rects=[[2.4,.2,VIL.X,4.4],[PLAZA.x0-.6,PLAZA.z0-.4,PLAZA.x1+.6,PLAZA.z1+.6],[3.2,2.8,5.0,10.4],[ZONE.x0-.6,3.4,VIL.X,VIL.Y],[16.2,19.4,21.8,24.0],[4.4,4.4,22.9,5.8],[21.8,4.4,22.9,13.4],[14.4,10.8,23.0,13.4],[4.8,5.8,7.0,8.2],[7.6,8.6,10.6,10.4]];
  const near=(x,z)=>VSLOTS.some(([a,b])=>Math.hypot(a-x,b-z)<2.2)||Math.hypot(x-VIL.start[0],z-VIL.start[1])<2.2;
  const tree=(x,z,s)=>{const olw=OL;OL=false;treeInner(x,z,s);OL=olw},treeInner=(x,z,s)=>{const g=new THREE.Group();g.position.set(x,0,z);villageG.add(g);
   g.add(mesh(new THREE.CylinderGeometry(.07*s,.1*s,.7*s,8),mat('#7a5536',.9),[0,.35*s,0]));
   if(sn==='겨울')g.add(mesh(sph(.34*s),mat('#ffffff',.9),[0,.95*s,0],[1,.6,1]));
   else{const cols=sn==='가을'?['#e0892f','#c9452f','#e8b73a']:sn==='봄'?['#f4b6c8','#f8c9d6']:['#4f9a4a','#5faa5a'];g.add(mesh(sph(.5*s),mat(cols[((Math.floor(x*7+z*3)%cols.length)+cols.length)%cols.length],.85),[0,.95*s,0]))}};
  for(let gx=.6;gx<VIL.X-.5;gx+=2.2)for(let gz=.6;gz<VIL.Y-.2;gz+=2.2){const x=gx+rnd()*1.2,z=gz+rnd()*1.2;
   if(rects.some(([a,b,c,d])=>x>a&&x<c&&z>b&&z<d)||near(x,z)||rnd()<.35)continue;tree(x,z,.8+rnd()*.5)}
  const olWas=OL;OL=false;   // 지도 바깥 숲은 외곽선 없이 (그리는 양 절약)
  for(let gx=-24;gx<VIL.X+24;gx+=3)for(let gz=-24;gz<VIL.Y+24;gz+=3){const x=gx+rnd()*1.8,z=gz+rnd()*1.8; // 지도 바깥 숲: 끝없이 이어지는 느낌
   if(x>-.5&&x<VIL.X+.5&&z>-.5&&z<VIL.Y+.5||rnd()<.3)continue;tree(x,z,.8+rnd()*.6)}
  OL=olWas;
  addLabel('<b>내 방</b>',4.0,2.5,2.0);addLabel('<b>마을 게시판</b>',bx+.8,2.5,bz+.1);
  addLabel('<b>광장 · 이야기</b>',PLAZA.cx,1.5,PLAZA.cz-.9);addLabel('<b>모닥불 구역</b>',ZONE.x0-.2,2.8,(ZONE.g0+ZONE.g1)/2);
 } function syncVillage(list){
  const key=JSON.stringify(list);if(key===vilKey||!villageG)return;vilKey=key;
  if(vilFiresG){villageG.remove(vilFiresG);dispose(vilFiresG)}
  vilFiresG=new THREE.Group();villageG.add(vilFiresG);vilFlames=[];
  vilLabels.filter(l=>l.fire).forEach(l=>l.el.remove());vilLabels=vilLabels.filter(l=>!l.fire);
  const stone0=mat('#9a958a',.95),logM0=mat('#4a3322',.9);
  list.slice(0,VSLOTS.length).forEach((n,i)=>{const [x,z]=VSLOTS[i];
   const g=new THREE.Group(),stone=stone0.clone(),logM=logM0.clone();g.position.set(x,0,z);vilFiresG.add(g); /* 모닥불마다 재질을 따로 둬야 호버 발광이 그 불에만 켜진다 */
   for(let k=0;k<9;k++){const a=k/9*Math.PI*2;g.add(mesh(new THREE.BoxGeometry(.22,.16,.2),stone,[Math.cos(a)*.46,.08,Math.sin(a)*.46],[1,1,1],[0,-a,0]))}
   g.add(mesh(new THREE.BoxGeometry(.7,.1,.14),logM,[0,.14,0],[1,1,1],[0,.5,0]));g.add(mesh(new THREE.BoxGeometry(.7,.1,.14),logM,[0,.14,0],[1,1,1],[0,-.5,0]));
   const burn=n.kind==='OPEN'||(n.kind==='CLOSED'&&n.left>0);
   if(burn){
    const sc=n.kind==='OPEN'?1:.28+.72*Math.min(1,n.left/7),fl=new THREE.Group();fl.position.y=.15;
    const c1=new THREE.Mesh(new THREE.ConeGeometry(.3,.9,12),new THREE.MeshBasicMaterial({color:n.done?'#7fb4ff':'#ff8a3d'}));c1.position.y=.45;
    const c2=new THREE.Mesh(new THREE.ConeGeometry(.18,.6,12),new THREE.MeshBasicMaterial({color:n.done?'#cfe6ff':'#ffd45a'}));c2.position.y=.3;
    fl.add(c1);fl.add(c2);fl.scale.setScalar(sc);g.add(fl);vilFlames.push({g:fl,base:sc,ph:i*1.7});
    if(n.kind==='OPEN'){const gl=new THREE.Mesh(new THREE.CircleGeometry(1.5,32),new THREE.MeshBasicMaterial({color:'#ffb347',transparent:true,opacity:.28,depthWrite:false}));gl.rotation.x=-Math.PI/2;gl.position.y=.04;gl.userData.nodim=true;g.add(gl)}
   }else if(n.kind==='CLOSED')g.add(mesh(new THREE.CylinderGeometry(.3,.34,.06,16),mat('#6d665e',.95),[0,.1,0]));
   vhull(g,-.8,-.8,0,1.6,1.6,1.3,'room:'+n.id);vcollect('room:'+n.id,g);
   const st=n.kind==='OPEN'?'':n.kind==='SOON'?' · '+(n.opens||'곧')+(n.alarm?' 🔔':''):' · '+(n.done?'✓ ':'')+'D-'+n.left;
   addLabel(`<i class="dot ${n.kind.toLowerCase()}"></i>${esc(n.short)}${st}${n.unread?' <span class="vstar">✦</span>':''}`,x,1.75,z,true);
  });
  if(list.length<VSLOTS.length){ // 빈 모닥불 자리: 누르면 새 모닥불을 피운다
   const [x,z]=VSLOTS[list.length],g=new THREE.Group(),stone=stone0.clone(),logM=logM0.clone();g.position.set(x,0,z);vilFiresG.add(g);
   for(let k=0;k<9;k++){const a=k/9*Math.PI*2;g.add(mesh(new THREE.BoxGeometry(.22,.16,.2),stone,[Math.cos(a)*.46,.08,Math.sin(a)*.46],[1,1,1],[0,-a,0]))}
   g.add(mesh(new THREE.BoxGeometry(.7,.1,.14),logM,[0,.14,0],[1,1,1],[0,.5,0]));g.add(mesh(new THREE.BoxGeometry(.7,.1,.14),logM,[0,.14,0],[1,1,1],[0,-.5,0]));
   vhull(g,-.8,-.8,0,1.6,1.6,1.3,'fire:new');vcollect('fire:new',g);
   addLabel('<b>+ 모닥불 피우기</b>',x,1.2,z,true);
  }
  function vhull(g,x,y,z,w,dp,h,f){const k=new THREE.Mesh(new THREE.BoxGeometry(w,h,dp),new THREE.MeshBasicMaterial({visible:false}));k.position.set(x+w/2,z+h/2,y+dp/2);k.userData={f,hull:true};g.add(k);vilPick.push(k)}
 }
 function buildCamp(n){
  campG=new THREE.Group();scene.add(campG);campGuests=[];
  const ground=mesh(new THREE.CylinderGeometry(7.8,7.8,.12,48),mat('#334c42',.95),[0,-.12,0]);campG.add(ground);
  campG.add(mesh(new THREE.CylinderGeometry(3.45,3.55,.035,48),mat('#766449',.95),[0,-.035,0]));
  const stone=mat('#a7a096',.95),wood=mat('#67452d',.9);
  for(let i=0;i<13;i++){const a=i/13*Math.PI*2;campG.add(mesh(new THREE.DodecahedronGeometry(.27,0),stone,[Math.cos(a)*.75,.12,Math.sin(a)*.75],[1,.65,1]))}
  for(let i=0;i<3;i++){const a=i*Math.PI/3;campG.add(mesh(new THREE.CylinderGeometry(.12,.13,1.1,8),wood,[0,.17,0],[1,1,1],[Math.PI/2,a,0]))}
  campFire=new THREE.Group();campFire.position.y=.2;campG.add(campFire);
  campFire.add(mesh(new THREE.ConeGeometry(.48,1.25,12),new THREE.MeshBasicMaterial({color:'#f07136'}),[0,.65,0]));
  campFire.add(mesh(new THREE.ConeGeometry(.27,.87,12),new THREE.MeshBasicMaterial({color:'#ffd675'}),[0,.47,0]));
  const glow=new THREE.PointLight(0xffa94c,2.4,8);glow.position.set(0,1.25,0);campG.add(glow);
  const spots=Array.from({length:6},(_,i)=>{const a=(i/6+.08)*Math.PI*2;return [Math.cos(a)*2.55,Math.sin(a)*2.55]});
  spots.forEach(([x,z],i)=>{
   const seat=mesh(new THREE.CylinderGeometry(.62,.68,.38,12),mat(i%2?'#8c6547':'#9a734f',.9),[x,.14,z]);campG.add(seat);
   if(i===3)return;
   const j=i>3?i-1:i,name=n.members[j]||NPCS[j%NPCS.length].name;
   const av=NPCS[j%NPCS.length].av,g=build(av);g.root.scale.setScalar(.8);campG.add(g.root);
   campGuests.push({M:g,x,z,rot:Math.atan2(-x,-z),ph:i*.7});addLabel(esc(name.startsWith('@')?name:'@'+name),x,2.45,z);
  });
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2,rad=5.3+(i%3)*.6,x=Math.cos(a)*rad,z=Math.sin(a)*rad;
   if(x+z>1)continue;
   const trunk=mesh(new THREE.CylinderGeometry(.13,.18,1.3,8),mat('#443e34',.9),[x,.62,z]);campG.add(trunk);
   campG.add(mesh(new THREE.ConeGeometry(.9,2.3,8),mat(i%2?'#315344':'#42644d',.9),[x,2,z]));
  }
 }
 function setView(v,n){
  view=v;camFree=false;panP=null;if(roomG)roomG.visible=v==='room';
  clearLabels();if(villageG){scene.remove(villageG);dispose(villageG);villageG=null;vilFiresG=null;vilPick=[]}
  if(campG){scene.remove(campG);dispose(campG);campG=null;campFire=null;campGuests=[]}
  if(v==='village'){buildVillage();const k=SKYC[windowScene().weather];wrap.classList.add('vil');wrap.style.background='linear-gradient(180deg,'+k[0]+' 0%,'+k[1]+' 100%)'}
  else{wrap.classList.remove('vil');wrap.style.background=v==='shared'?'linear-gradient(180deg,#243d4d 0%,#51705a 100%)':'';if(v==='shared')buildCamp(n)}
  fit();
 }
 function fit(){
  const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
  R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(w,h,false);
  const a=w/h;let vh;
  if(view==='village'){vh=Math.max(10,14/a);if(!camFree)T.set(sim.x,1.0,sim.z)}   // 마을: 화면에 가로 약 14칸이 보이고, 카메라는 유령을 따라간다
  else if(view==='shared'){vh=Math.max(8.8,12/a);T.set(1.7,2.0,0)}   // 뒤쪽 캐릭터 머리 위로 말풍선이 들어갈 여백
  else{const {X,Y}=L,Wn=(X+Y)*.7071+1.0,Hn=(X+Y)*.354+6.2;vh=Math.max(Hn,Wn/a);T.set(X/2,1.1,Y/2)}
  cam.left=-vh*a/2;cam.right=vh*a/2;cam.top=vh/2;cam.bottom=-vh/2;cam.updateProjectionMatrix();
  cam.position.copy(T).addScaledVector(dirV,40);cam.lookAt(T);
  sun.position.set(T.x+9,14,T.z+6);sun.target.position.set(T.x,0,T.z);
 }
 function relayout(){buildRoom();fit()}
 const rc=new THREE.Raycaster(),nd=new THREE.Vector2();
 function pick(ev){
  const r=cv.getBoundingClientRect();nd.set((ev.clientX-r.left)/r.width*2-1,-((ev.clientY-r.top)/r.height*2-1));rc.setFromCamera(nd,cam);
  const h=rc.intersectObjects(view==='room'?pickables:view==='village'?vilPick:[],false);if(!h.length)return null;
  const o=h[0].object;if(o.userData.f)return {f:o.userData.f};
  return {floor:true,x:h[0].point.x,z:h[0].point.z};
 }

 /* 미리보기 이미지: 같은 유령을 작은 화면에 한 번 그려서 PNG로 돌려줌 */
 let SR=null,SS=null;const snapCache={};
 function snap(av,kind){
  const key=kind+JSON.stringify(av);if(snapCache[key])return snapCache[key];
  if(!SR){try{SR=new THREE.WebGLRenderer({alpha:true,antialias:true})}catch(e){return ''}
   SS=new THREE.Scene();SS.add(new THREE.HemisphereLight(0xffffff,0xd9c9a8,1.0));const dl=new THREE.DirectionalLight(0xfff2dc,.7);dl.position.set(3,6,5);SS.add(dl)}
  const pip=kind==='pip',sz=kind==='head'?[112,112]:pip?[240,240]:[300,340];
  SR.setPixelRatio(1);SR.setSize(sz[0],sz[1]);
  const gm=build(av);applyPose(gm,{x:0,y:pip?.18:0,z:0,rot:pip?Math.PI/2:.45,t:0,mv:0,sit:pip?1:0});SS.add(gm.root);
  let c;
  if(pip){c=new THREE.OrthographicCamera(-1.45,1.45,1.45,-1.45,.1,50);const t=new THREE.Vector3(0,1.15,0);c.position.copy(t).addScaledVector(dirV,20);c.lookAt(t)}
  else if(kind==='head'){c=new THREE.PerspectiveCamera(22,1,.1,50);c.position.set(.5,1.95,4.0);c.lookAt(0,1.68,0)}
  else{c=new THREE.PerspectiveCamera(26,sz[0]/sz[1],.1,50);c.position.set(0,1.9,7.8);c.lookAt(0,1.15,0)}
  SR.render(SS,c);const url=SR.domElement.toDataURL('image/png');SS.remove(gm.root);dispose(gm.root);
  if(Object.keys(snapCache).length>60)for(const k in snapCache)delete snapCache[k];
  return snapCache[key]=url;
 }

 /* 화면 위 글자·배지: 3D 좌표를 화면 좌표로 옮겨서 위치만 맞춤 */
 const V=new THREE.Vector3(),el=id=>document.getElementById(id);
 // 지도 끌기(마을): 누른 땅 위의 점이 커서 아래에 계속 있도록 카메라를 옮긴다. 캐릭터는 그대로. 걸어가라고 하면(follow) 다시 캐릭터를 따라간다
 let camFree=false,panP=null;const PL=new THREE.Plane(new THREE.Vector3(0,1,0),0),RV=new THREE.Vector3();
 function groundAt(ev){const r=cv.getBoundingClientRect();nd.set((ev.clientX-r.left)/r.width*2-1,-((ev.clientY-r.top)/r.height*2-1));rc.setFromCamera(nd,cam);return rc.ray.intersectPlane(PL,RV)?RV.clone():null}
 function panStart(ev){panP=view==='village'?groundAt(ev):null;return !!panP}
 function panMove(ev){if(!panP||view!=='village')return;const q=groundAt(ev);if(!q)return;camFree=true;
  T.x=Math.max(0,Math.min(VIL.X,T.x+panP.x-q.x));T.z=Math.max(0,Math.min(VIL.Y,T.z+panP.z-q.z));
  cam.position.copy(T).addScaledVector(dirV,40);cam.lookAt(T);cam.updateMatrixWorld();sun.position.set(T.x+9,14,T.z+6);sun.target.position.set(T.x,0,T.z);panP=groundAt(ev)||panP}
 const panEnd=()=>{panP=null},follow=()=>{camFree=false};
 function place(e,x,y,z,dy=0){V.set(x,y,z).project(cam);e.style.left=((V.x*.5+.5)*cv.clientWidth)+'px';e.style.top=((-V.y*.5+.5)*cv.clientHeight+dy)+'px'}   // dy: 화면 픽셀 보정(음수면 위로)
 let last=performance.now();
 function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  stepSim(dt);
  if(!M||!roomG)return;
  M.root.scale.setScalar(view==='shared'?.8:1);
  applyPose(M,sim);
  if(view==='village'){ // 따라가는 카메라: 유령 위치로 부드럽게 이동
   if(!camFree){const k=Math.min(1,dt*5);T.x+=(M.root.position.x-T.x)*k;T.z+=(M.root.position.z-T.z)*k}
   cam.position.copy(T).addScaledVector(dirV,40);cam.lookAt(T);sun.position.set(T.x+9,14,T.z+6);sun.target.position.set(T.x,0,T.z);
  }
  for(const f in flashUntil){const left=flashUntil[f]-now;if(left>0){const k=.28*Math.abs(Math.sin(left/90));matsOf[f].forEach(m=>{if(m.emissive&&!m.userData.keepEmis)m.emissive.setRGB(k,k*.9,k*.5)})}else{delete flashUntil[f];emis(f,f===hoverF)}}
  place(el('nameTag'),M.root.position.x,M.root.position.y+2.5,M.root.position.z);
  if(view==='room'){
   const d=L.d;
   if(ov.lamp)place(el('lampLabel'),4.43+d.sofa[0],3.95,6.23+d.sofa[1]);
   if(ov.newMark)place(el('newMark'),6.95+d.mir[0],3.7,.4+d.mir[1]);
   if(ov.winMark)place(el('newMarkWin'),4.6+d.win[0],4.1,.1+d.win[1]);
   if(ov.sofaMark)place(el('newMarkSofa'),4.2+d.sofa[0],1.85,3.85+d.sofa[1]);
  }else if(view==='village'){
   const t=now/1000,mn=Math.floor(Date.now()/60000);
   vilFlames.forEach(f=>f.g.scale.set(f.base*(1+.06*Math.sin(t*7+f.ph)),f.base*(1+.1*Math.sin(t*9+f.ph)+.05*Math.sin(t*17+f.ph)),f.base*(1+.06*Math.cos(t*8+f.ph))));
   vilWins.forEach(w=>{const on=w.mine?vilLamp:((w.i*7+mn)%3!==0);w.m.emissiveIntensity=on?1:0;w.m.color.set(on?'#ffd66b':'#6b5a48')});
   vilLabels.forEach(l=>place(l.el,l.x,l.y,l.z));
   vilNpcs.forEach(n=>applyPose(n.M,{x:n.x,y:0,z:n.z,rot:n.rot,t:t+n.ph,mv:0,sit:0}));
   vilBub=vilBub.filter(b=>{const p=b.i<0?M.root.position:vilNpcs[b.i]&&vilNpcs[b.i].M.root.position;if(!p||now>b.until){b.el.remove();return false}place(b.el,p.x,p.y+3.3,p.z);return true});
  }else if(view==='shared'){
   const t=now/1000;if(campFire)campFire.scale.set(1+.05*Math.sin(t*8),1+.1*Math.sin(t*9),1+.05*Math.cos(t*7));
   campGuests.forEach(g=>applyPose(g.M,{x:g.x,y:.18,z:g.z,rot:g.rot,t:t+g.ph,mv:0,sit:1}));
   vilLabels.forEach(l=>place(l.el,l.x,l.y,l.z));
   vilBub=vilBub.filter(b=>{const p=b.i<0?M.root.position:campGuests[b.i]&&campGuests[b.i].M.root.position;if(!p||now>b.until){b.el.remove();return false}place(b.el,p.x,p.y+2.27,p.z,-26);return true});   // 모닥불 장면의 말풍선: 이름표 바로 위 26px. 월드 높이로 띄우면 큰 화면(PC)에서 캐릭터와 멀어진다 (i=-1 나, 0~ 앉은 참여자)
  }
  R.render(scene,cam);
 }
 buildRoom();
 new ResizeObserver(fit).observe(wrap);fit();
 requestAnimationFrame(frame);
 return {sync,pick,setHover,flash,relayout,snap,fit,setView,say,panStart,panMove,panEnd,follow,houses:()=>vilHouses,npcs:()=>vilNpcs.map(n=>[n.x,n.z]),winImg:()=>winCv.toDataURL()};
})();
document.getElementById('fail').style.display=G3?'none':'flex';
MQ.addEventListener('change',()=>{closePanel();if(VIEW!=='room'){VIEW='room';L=ROOM_L||L;if(G3)G3.setView('room')}setLayout(MQ.matches?'tall':'wide');if(G3)G3.relayout();buildSr();render()});

function bookColor(t){let h=0;for(const c of t)h=(h*31+c.charCodeAt(0))>>>0;return SPINE[h%SPINE.length]}

// 월 목표 (결정 #39): 달마다 따로 보관한다. 정해 둔 값이 없으면 직전에 정한 값을 이어받고, 첫 기록 이전 달은 null(목표 기록 없음).
// 지난 달 목표는 바뀌지 않는다(이어받기는 앞으로만 간다). 이번 달에만 고칠 수 있고, 고치면 "목표를 바꿨어요" 기록(changes)이 남는다.
const curYM=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}).slice(0,7);
function goalFor(ym){const e=S.goals[ym];if(e)return {goal:e.goal,changes:e.changes||[],set:true};
 const ks=Object.keys(S.goals).filter(k=>k<ym).sort();return {goal:ks.length?S.goals[ks[ks.length-1]].goal:null,changes:[],set:false}}
function setGoal(v){
 const ym=curYM(),prev=goalFor(ym);v=Math.min(99,Math.max(1,Math.round(+v)||1));
 const e=S.goals[ym]||(S.goals[ym]={goal:prev.goal==null?v:prev.goal,changes:[]});if(e.goal===v)return;
 const day=ts=>new Date(ts).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),last=e.changes[e.changes.length-1];
 if(last&&day(last.at)===day(Date.now())){last.to=v;last.at=Date.now();if(last.from===v)e.changes.pop()}   // 같은 날 여러 번 눌러도 한 번의 변경으로 본다
 else e.changes.push({at:Date.now(),from:e.goal,to:v});
 e.goal=v;save()}
// 달력: 한국 시간 기준. 독서등을 끄며 저장한 날과 완독한 날을 독서한 날로 센다. off는 이번 달 기준으로 몇 달 전인지(0=이번 달, -1=지난 달).
function calData(off=0){
 const kst=ts=>new Date(ts).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
 const todayS=kst(Date.now()),[ty,tm,td]=todayS.split('-').map(Number),pad=n=>String(n).padStart(2,'0');
 const tg=new Date(Date.UTC(ty,tm-1+off,1)),Y=tg.getUTCFullYear(),Mo=tg.getUTCMonth()+1,ym=Y+'-'+pad(Mo);
 const days=new Set(),RE=/^(?:(\d{4})\.)?(\d+)\.(\d+)$/,finY=m=>m[1]?+m[1]:((+m[2]>tm||(+m[2]===tm&&+m[3]>td))?ty-1:ty);   // 연도 없는 예전 값은 오늘 기준으로 연도를 짐작
 S.sessions.forEach(x=>days.add(kst(x.endedAt||x.startedAt)));
 S.finished.forEach(b=>{const m=RE.exec(b.finishedAt||'');if(!m)return;days.add(finY(m)+'-'+pad(+m[2])+'-'+pad(+m[3]))});
 let streak=0;if(off===0){const dt=new Date(Date.UTC(ty,tm-1,td));
  if(!days.has(todayS))dt.setUTCDate(dt.getUTCDate()-1);
  while(days.has(dt.toISOString().slice(0,10))){streak++;dt.setUTCDate(dt.getUTCDate()-1)}}
 const dim=new Date(Date.UTC(Y,Mo,0)).getUTCDate(),first=new Date(Date.UTC(Y,Mo-1,1)).getUTCDay();
 const marks=[];for(let d=1;d<=dim;d++)if(days.has(ym+'-'+pad(d)))marks.push(d);
 const done=S.finished.filter(b=>{const m=RE.exec(b.finishedAt||'');return m&&finY(m)===Y&&+m[2]===Mo}).length;
 if(off===0&&!S.goals[ym]&&goalFor(ym).goal==null){S.goals[ym]={goal:1,changes:[]};save()}   // 처음 쓰는 사람은 기본 1권
 const g=goalFor(ym),earliest=[...Object.keys(S.goals),...[...days].map(d=>d.slice(0,7))].sort()[0]||ym;
 return {y:Y,m:Mo,ym,off,today:off===0?td:0,dim,first,marks,streak,done,goal:g.goal,goalSet:g.set,changes:g.changes,canPrev:earliest<ym,canNext:off<0};
}
// 창밖 풍경: 계절은 월로, 날씨는 날짜마다 바뀐다 (오프라인에서도 동작). 인터넷이 있으면 실제 날씨로 바꿀 수도 있다.
function windowScene(){
 const ds=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),[y,m,d]=ds.split('-').map(Number),shift=S.sceneShift||0;
 const season=m>=3&&m<=5?'봄':m>=6&&m<=8?'여름':m>=9&&m<=11?'가을':'겨울';
 let h=((y*10000+m*100+d)*2654435761)>>>0;const rnd=()=>{h=(h*1664525+1013904223)>>>0;return h/4294967296};
 const pool=season==='겨울'?['맑음','맑음','구름','흐림','눈','눈','안개']:season==='여름'?['맑음','맑음','구름','흐림','비','비','안개']:['맑음','맑음','구름','흐림','비','안개'];
 const weather=pool[(Math.floor(rnd()*pool.length)+shift)%pool.length];
 return {season,weather,seed:Math.floor(rnd()*1e9)+shift*7919};
}
// 공유방 표시 보조
const DAY=864e5;
const mmdd=ts=>{const [,m,d]=new Date(ts).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}).split('-');return +m+'.'+d};
const shortTitle=n=>String(n.book||n.title||'').replace(/[『』]/g,'').replace(/\s*(같이 읽기|이야기방)\s*$/,'').trim();
const roomLeft=n=>n.deleteAt?Math.max(0,Math.ceil((n.deleteAt-Date.now())/DAY)):0;
const roomSub=n=>{
 if(n.kind==='CLOSED'&&n.deleteAt)return (n.done?'가져옴 · ':'')+'가져오기 마감 D-'+roomLeft(n);
 if(n.mine&&n.kind==='SOON')return mmdd(n.opensAt)+' 개방 · '+n.people+'/'+n.max+'명';
 if(n.mine&&n.kind==='OPEN')return mmdd(n.closesAt)+' 종료 · '+n.people+'/'+n.max+'명 참여 중';
 return n.sub};
// 모닥불 자리는 8개뿐이라 열린 방 → 곧 열릴 방 → 종료된 방 순으로 자리를 준다 (종료된 방은 게시판에는 계속 보인다)
const vilOrder=()=>{const r={OPEN:0,SOON:1,CLOSED:2};return [...S.news].sort((a,b)=>r[a.kind]-r[b.kind])};
const vilList=()=>vilOrder().map(n=>({unread:rcUnread(n),id:n.id,kind:n.kind,short:shortTitle(n),done:!!n.done,alarm:!!n.alarm,left:roomLeft(n),opens:n.opensAt?mmdd(n.opensAt):''}));
function enterVillage(){
 if(VIEW==='village')return;closePanel();
 const w=document.getElementById('stageWrap');w.classList.add('fading');
 setTimeout(()=>{ROOM_L=L;VIEW='village';L=VIL;Object.assign(sim,{x:VIL.start[0],z:VIL.start[1],y:0,mode:'idle',after:null,mv:0,sit:0,k:0,rot:Math.PI/4});
  if(G3)G3.setView('village');buildSr();render();w.classList.remove('fading')},260);
}
function leaveVillage(){
 if(VIEW!=='village')return;closePanel();
 const w=document.getElementById('stageWrap');w.classList.add('fading');
 setTimeout(()=>{VIEW='room';L=ROOM_L;Object.assign(sim,{x:TARGET.door[0],z:TARGET.door[1]+.3,y:0,mode:'idle',after:null,mv:0,sit:0,k:0,rot:Math.PI/4});
  if(G3)G3.setView('room');buildSr();render();w.classList.remove('fading')},260);
}
function enterCamp(n){
 if(!n||n.kind!=='OPEN'||!n.agreed||VIEW!=='village')return;
 CAMP_ID=n.id;VIEW='shared';const i=Math.max(0,vilOrder().findIndex(x=>x.id===n.id)),[x,z]=VSLOTS[Math.min(i,VSLOTS.length-1)];
 Object.assign(sim,{x:-2.24,z:-1.28,y:.18,rot:Math.atan2(2.24,1.28),mode:'sit',sit:1,mv:0,after:null});
 const w=document.getElementById('stageWrap');w.classList.add('camp');w.appendChild(backdrop);backdrop.classList.add('camp');panel.setAttribute('aria-modal','false');
 document.getElementById('campChatToggle').textContent='💬 대화 열기';
 if(G3)G3.setView('shared',n);buildSr();render();
 if(panelOpen)renderPanel();   // 장면이 바뀐 뒤 다시 그려야 대화창이 모닥불 장면용(대화만, 탭 없음)으로 나온다
}
function leaveCamp(){
 if(VIEW!=='shared')return;
 const i=Math.max(0,vilOrder().findIndex(x=>x.id===CAMP_ID)),[x,z]=VSLOTS[Math.min(i,VSLOTS.length-1)];
 CAMP_ID=null;VIEW='village';Object.assign(sim,{x:x+.9,z:z+.9,y:0,mode:'idle',sit:0,mv:0,rot:Math.PI/4,after:null});
 document.getElementById('stageWrap').classList.remove('camp','min');backdrop.classList.remove('camp','min');document.body.appendChild(backdrop);panel.setAttribute('aria-modal','true');
 if(G3)G3.setView('village');buildSr();render();
}
// 모닥불 장면에서 ✕·← 마을로·Esc를 누르면 바로 나가지 않고 한 번 묻는다 (접어 둔 상태면 창을 다시 펼쳐서 묻는다)
function askExitCamp(){if(VIEW!=='shared')return closePanel();if(backdrop.classList.contains('min'))toggleCampChat();panelView.sheet=null;panelView.exitAsk=true;renderPanel()}
document.getElementById('campExit').addEventListener('click',askExitCamp);
function toggleCampChat(){if(VIEW!=='shared')return;const min=backdrop.classList.toggle('min');document.getElementById('stageWrap').classList.toggle('min',min);if(!min)focusPanel()}
document.getElementById('campChatToggle').addEventListener('click',toggleCampChat);
// 배경의 ☁ 참여자 · 🌙 방 정보 버튼: 대화창은 그대로 두고 별도 모달로 연다 (모달의 ✕는 그 창만 닫는다). 같은 버튼을 다시 누르면 닫힌다
document.getElementById('campSide').addEventListener('click',e=>{const b=e.target.closest('[data-camp]');if(!b||VIEW!=='shared')return;
 panelView.sheet=panelView.sheet===b.dataset.camp?null:b.dataset.camp;panelView.leaveAsk=false;panelView.delAsk=null;panelView.exitAsk=false;renderPanel()});
document.getElementById('campModal').addEventListener('click',e=>{if(e.target.id==='campModal'){panelView.sheet=null;renderPanel()}});
// 마을 미니맵: 정사각형 상자에 마을 전체를 위에서 내려다본 모양으로 보여준다 (x는 오른쪽, z는 아래). 위아래 남는 자리는 바깥 숲 색. 노란 점이 나
const mini=document.getElementById('minimap'),mctx=mini.getContext('2d');
function drawMini(){
 if(VIEW!=='village'||!G3)return;
 const W=mini.width,H=mini.height,pad=8,k=(W-2*pad)/VIL.X,ox=pad,oy=(H-VIL.Y*k)/2;
 const P=(x,z)=>[ox+x*k,oy+z*k];
 const quad=(x0,z0,x1,z1,c)=>{const [a,b]=P(x0,z0),[e,f]=P(x1,z1);mctx.fillStyle=c;mctx.fillRect(a,b,e-a,f-b)};
 const dot=(x,z,c,r,ring)=>{const [a,b]=P(x,z);mctx.beginPath();mctx.arc(a,b,r,0,7);if(ring){mctx.strokeStyle=c;mctx.lineWidth=2;mctx.stroke()}else{mctx.fillStyle=c;mctx.fill()}};
 const txt=(s,x,z)=>{const [a,b]=P(x,z);mctx.fillText(s,a,b)};
 mctx.fillStyle='#8fbf78';mctx.fillRect(0,0,W,H);
 quad(0,0,VIL.X,VIL.Y,'#a9d48c');quad(16.4,19.6,21.6,23.8,'#7fb6d8');
 [[3.6,3.0,4.6,10.0],[PLAZA.x1,11.0,22.7,13.2],[4.6,4.6,22.7,5.6],[22.0,4.6,22.7,13.2]].forEach(r=>quad(...r,'#cdb890'));   // 길 (갈림길 포함)
 quad(PLAZA.x0,PLAZA.z0,PLAZA.x1,PLAZA.z1,'#e6dcc4');quad(ZONE.x0,ZONE.z0,ZONE.x1,ZONE.z1,'#a88f68');
 G3.houses().forEach(([x,y,w,d,m])=>quad(x,y,x+w,y+d,m?'#c0542f':'#8a6a45'));
 mctx.font='bold 20px sans-serif';mctx.textAlign='center';mctx.textBaseline='middle';mctx.fillStyle='#6b5f4c';
 txt('광장',PLAZA.cx,PLAZA.z1-1.6);
 vilOrder().slice(0,VSLOTS.length).forEach((n,i)=>dot(VSLOTS[i][0],VSLOTS[i][1],n.kind==='OPEN'?'#e8764a':n.kind==='SOON'?'#f3f0e8':(n.done?'#7aa7e0':'#6d665e'),5));
 if(S.news.length<VSLOTS.length){const s=VSLOTS[S.news.length];dot(s[0],s[1],'#f3f0e8',4.5,true)}
 G3.npcs().forEach(([x,z])=>dot(x,z,'#5f9a5a',3));
 dot(sim.x,sim.z,'#3b3226',7);dot(sim.x,sim.z,'#ffd23f',4.6);
}
setInterval(()=>{drawMini();syncPlazaChat()},120);
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
 if(G3)G3.sync({a,reading,title:reading?S.reading.title:'',sitting,lampOn,lampWarn,dim:onboardDim,openRooms,newItem:S.newItem,winNew,books:S.finished.slice(-((L.K||7)*4)).map(b=>b.title),cal,win:windowScene(),vil:vilList()});
 // 화면 위 표시
 const nt=document.getElementById('nameTag');nt.textContent=S.user.nickname;
 const ll=document.getElementById('lampLabel');ll.style.display=VIEW==='room'&&(lampOn||lampWarn)?'block':'none';ll.className='ov'+(lampWarn?' warn spark':'');ll.innerHTML=`<span id="lampTime">${lampWarn?'확인 필요':fmtHMS(elapsed())}</span>`;
 document.getElementById('newMark').style.display=VIEW==='room'&&S.newItem?'block':'none';
 document.getElementById('newMarkWin').style.display=VIEW==='room'&&winNew?'block':'none';
 document.getElementById('newMarkSofa').style.display=VIEW==='room'&&!reading?'block':'none';
 // header
 document.getElementById('hdrName').textContent=VIEW==='village'?S.user.nickname+' · 마을':VIEW==='shared'?'모닥불 · '+(S.news.find(n=>n.id===CAMP_ID)?.title||'공유방'):S.user.nickname+'의 방';
 document.getElementById('stage').setAttribute('aria-label',VIEW==='shared'?'공유방 모닥불':VIEW==='village'?'마을':'내 방');
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
const curOrder=()=>VIEW==='shared'?[]:VIEW==='village'?['board','plaza',...vilOrder().slice(0,VSLOTS.length).map(n=>'room:'+n.id),...(S.news.length<VSLOTS.length?['fire:new']:[]),'home']:ORDER;
const labelOf=f=>f==='board'?'마을 게시판':f==='plaza'?'광장 이야기':f==='home'?'내 방으로':f==='fire:new'?'모닥불 피우기':f.startsWith('room:')?shortTitle(S.news.find(n=>n.id===f.slice(5))||{})+' 모닥불':LABEL[f];
function buildSr(){srWrap.innerHTML='';curOrder().forEach(f=>{const b=document.createElement('button');b.dataset.f=f;b.textContent=labelOf(f);
 b.addEventListener('focus',()=>{b.setAttribute('aria-label',stateLabel(f));hl(f,true)});b.addEventListener('blur',()=>hl(f,false));
 b.addEventListener('click',()=>VIEW==='village'?openV(f):openF(f));srWrap.appendChild(b)})}
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
 if(p&&p.f){VIEW==='village'?openV(p.f):openF(p.f);return}
 if(p&&p.floor){walkTo(Math.max(L.minX||1.1,Math.min(L.X-0.4,p.x)),Math.max(L.minZ||0.8,Math.min(L.Y-0.4,p.z)));return}
 if(panelOpen&&panelOpen!=='mirror')closePanel();
});

// toast
let tt;function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2200)}

// panel
const panel=document.getElementById('panel'),backdrop=document.getElementById('backdrop');
backdrop.addEventListener('click',e=>{if(e.target===backdrop)closePanel()});
const FIRST={plaza:'광장에서는 방에 들어가지 않아도 이웃과 짧게 이야기해요. 한 줄로 말하면 머리 위에 말풍선이 떠요. 글은 하루 뒤에 사라져요.',mirror:'거울에서 캐릭터를 꾸밀 수 있어요. 꾸민 모습은 마을과 공유방에서도 보여요.',window:'열린 공유방과 가져오기 마감일이 여기 떠요.',board:'공유방 일정과 지난 방을 한눈에 봐요. 종료된 방은 7일 안에 내 서재로 가져오세요.','fire:new':'친구와 함께할 모닥불을 직접 피워요. 만들면 초대 링크가 생겨요.',lamp:'스탠드는 책을 읽는 동안 켜져 있어요.',calendar:'독서한 날이 표시되고, 이번 달 완독 목표를 정할 수 있어요.',shelf:'다 읽은 책이 꽂혀요. 책을 누르면 기록과 공유방 대화를 다시 볼 수 있어요.'};
function openF(f){
 if(S.onboard===1&&f!=='sofa'){toast('먼저 소파에 읽을 책을 올려보세요');return}
 if(S.onboard===2&&f!=='lamp'){S.onboard=0;save()}
 if(f==='door'){walkTo(...TARGET.door,()=>enterVillage());closePanel();return}
 if(panelOpen==='mirror'&&f!=='mirror')cancelMirror();
 panelOpen=f;panelView={};
 if(f==='mirror'){tempAvatar={...S.avatar};if(S.newItem){S.newItem=false;save()}}
 if(f==='lamp'&&S.onboard===2){S.onboard=0;save()}
 if(f==='window'){S.news.forEach(n=>S.newsSeen[n.id]=1);save();render()}
 renderPanel();backdrop.classList.add('open');panel.scrollTop=0;tip.style.display='none';focusPanel();
 if(f==='sofa'&&isSit()){render()}
 else if(f==='lamp'&&isSit()){render()}
 else walkTo(...TARGET[f],()=>{if(f==='sofa')sitDown()});
 if(f!=='mirror')zoom(false);
}
// 마을의 게시판·모닥불·내 방
function vTarget(f){if(f==='board')return [PLAZA.x0+7.3,PLAZA.z0+.7];if(f==='plaza')return [PLAZA.cx,PLAZA.cz+2.3];const i=f==='fire:new'?S.news.length:Math.max(0,vilOrder().findIndex(n=>'room:'+n.id===f)),s=VSLOTS[Math.min(i,VSLOTS.length-1)];return [Math.min(VIL.X-.8,s[0]+.9),Math.min(VIL.Y-.8,s[1]+.9)]}
function openV(f){
 if(f==='home'){closePanel();walkTo(VIL.home[0],VIL.home[1],()=>leaveVillage());return}
 if(f==='plaza'){closePanel();walkTo(...vTarget(f),()=>{if(canHover){const i=document.getElementById('pz');if(i&&pzShown)i.focus()}});return}   // 광장 단상을 누르면 걸어가고, 도착하면 대화창이 저절로 뜬다 (창을 따로 열지 않는다)
 panelOpen=f;panelView={};renderPanel();backdrop.classList.add('open');panel.scrollTop=0;tip.style.display='none';focusPanel();
 if(f.startsWith('room:')){const n=S.news.find(x=>x.id===f.slice(5));if(n&&n.kind==='OPEN'&&n.agreed){enterCamp(n);return}}
 walkTo(...vTarget(f));
}
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
 panel.classList.toggle('rcchat',h.includes('id="rcLog"'));
 panel.innerHTML=h;
 if(f.startsWith('room:'))rcAfter(f.slice(5));
 renderCampModal();
}
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
function homeCard(){
 const r=S.reading,ses=S.session;
 const st=ses?(ses.status==='RUNNING'?`스탠드 켜짐 · <span id="homeT">${fmtHMS(elapsed())}</span>`:'스탠드 확인 필요'):'스탠드 꺼짐';
 const F=[['sofa','🛋','소파','지금 읽는 책 · 메모'],['lamp','💡','스탠드','독서 타이머'],['shelf','📚','책장','다 읽은 책 '+S.finished.length+'권'],['calendar','📅','달력','독서한 날 · 월 목표'],['mirror','🪞','거울','캐릭터 꾸미기'],['window','🪟','창문',''],['door','🚪','문','마을로 나가기']];
 return `<div class="panel-head"><h2>오늘의 방</h2></div>
  <div class="card">${r?`<b>『${esc(r.title)}』</b> 읽는 중${r.totalPages?`<div class="progress" style="margin:8px 0 6px"><i style="width:${r.progress}%"></i></div>`:''}<div class="muted">${r.totalPages?r.progress+'% · ':''}${st}</div>`:'<b>소파가 비어 있어요</b><div class="muted" style="margin-top:4px">읽을 책을 올려두면 스탠드를 켤 수 있어요</div>'}
  <div class="muted" style="margin-top:6px">오늘 ${todayMin()}분${calData().streak?' · '+calData().streak+'일 연속':''}</div></div>
  <label>가구</label>${F.map(([k,ic,n,d])=>`<button class="home-f" data-act="home" data-f="${k}"><i>${ic}</i><span class="grow">${n}</span><span class="muted">${d}</span></button>`).join('')}
  <p class="muted" style="margin-top:10px">방 안의 가구를 눌러도 돼요. 바닥을 누르면 캐릭터가 걸어가요.</p>`;
}
// 쪽수 → 퍼센트 자동 계산
function updProgress(r){r.progress=r.totalPages&&r.page!=null?Math.min(100,Math.max(0,Math.round(r.page/r.totalPages*100))):0} // 전체 쪽수나 현재 쪽이 없으면 퍼센트를 비운다 (#26)
function pgHint(r){if(!r.totalPages)return '전체 쪽수를 적으면 퍼센트가 자동으로 계산돼요';if(r.page!=null&&r.page>r.totalPages)return '전체 쪽수보다 커요. 100%로 계산해요';return r.page!=null?r.page+'쪽까지 읽었어요 · 메모에 쪽수를 적어도 자동으로 올라가요':'현재 쪽을 적으면 퍼센트가 자동으로 계산돼요'}
function bthumb(b){return `<div class="bthumb" style="background:${bookColor(b.title||'')}">${b.cover?`<img src="${esc(b.cover)}" alt="" onerror="this.remove()">`:''}</div>`}
// 책 검색: 제목·저자·ISBN, 또는 ISBN이 들어 있는 책 링크. 인터넷이 없으면 직접 입력한다.
async function searchBooks(q){
 q=q.trim();if(!q)return {err:'검색어를 적어 주세요'};
 let query=q;
 if(/^https?:\/\//i.test(q)){const m=q.match(/97[89]\d{10}|(?<!\d)\d{9}[\dXx](?!\d)/);if(!m)return {err:'이 링크에서 책을 찾지 못했어요. 제목으로 찾아 보세요'};query='isbn:'+m[0]}
 else if(/^[\d\s-]{10,17}$/.test(q))query='isbn:'+q.replace(/[-\s]/g,'');
 const get=async url=>{const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),7000);try{const res=await fetch(url,{signal:ctl.signal});if(!res.ok)throw new Error('http '+res.status);return await res.json()}finally{clearTimeout(tm)}};
 // 1순위: 구글 북스 (키 없이 쓰면 공용 한도가 금방 차서 자주 실패한다. BOOK_API_KEY에 키를 넣으면 안정적)
 const viaGoogle=async()=>{const j=await get('https://www.googleapis.com/books/v1/volumes?maxResults=6&printType=books&q='+encodeURIComponent(query)+(BOOK_API_KEY?'&key='+BOOK_API_KEY:''));
  return (j.items||[]).map(it=>{const v=it.volumeInfo||{},ids=v.industryIdentifiers||[];
   return {title:v.title||'',author:(v.authors||[]).join(', '),pages:v.pageCount||0,isbn:(ids.find(x=>x.type==='ISBN_13')||ids[0]||{}).identifier||'',cover:((v.imageLinks||{}).thumbnail||'').replace(/^http:/,'https:').replace('&edge=curl','')}}).filter(x=>x.title)};
 // 2순위: Open Library (키 없음. ISBN으로는 잘 찾고, 한국어 제목 검색은 약하다)
 const viaOpenLibrary=async()=>{const j=await get('https://openlibrary.org/search.json?limit=6&fields=title,author_name,number_of_pages_median,isbn,cover_i&q='+encodeURIComponent(query));
  return (j.docs||[]).map(d=>({title:d.title||'',author:(d.author_name||[]).join(', '),pages:d.number_of_pages_median||0,isbn:(d.isbn||[]).find(x=>x.length===13)||(d.isbn||[])[0]||'',cover:d.cover_i?'https://covers.openlibrary.org/b/id/'+d.cover_i+'-M.jpg':''})).filter(x=>x.title)};
 let items=[],failed=0;
 for(const f of [viaGoogle,viaOpenLibrary]){try{items=await f();if(items.length)break}catch(e){failed++}}
 if(items.length)return {items};
 if(failed===2)return {err:navigator.onLine?'책 정보를 가져오지 못했어요. 아래에 직접 적어 주세요':'인터넷에 연결되어 있지 않아요. 아래에 직접 적어 주세요'};
 return {items:[]};
}
const BOOK_API_KEY=''; // 구글 북스 API 키 (선택)
async function runSearch(){
 panelView.msg='찾는 중…';panelView.res=null;renderPanel();
 const r=await searchBooks(panelView.q||'');
 if(panelOpen!=='sofa'||S.reading)return;
 if(r.err){panelView.msg=r.err}else if(!r.items.length){panelView.msg='찾지 못했어요. 아래에 직접 적어 주세요'}else{panelView.msg='';panelView.res=r.items}
 renderPanel();
}
function sofaPanel(){
 const r=S.reading;
 if(!r){const pv=panelView,picked=pv.cover||pv.isbn;
  return head('소파 · 읽을 책 올리기')+`<p class="muted">지금 읽는 책 한 권만 올릴 수 있어요.</p>
  <label for="bq">책 찾기</label>
  <div class="row"><input id="bq" placeholder="제목, 저자, ISBN, 책 링크" value="${esc(pv.q||'')}"><button data-act="bsearch">찾기</button></div>
  <div class="muted" id="bmsg" style="margin-top:4px">${esc(pv.msg||'')}</div>
  ${pv.res&&pv.res.length?pv.res.map((it,i)=>`<button class="book" data-act="bpick" data-i="${i}">${bthumb(it)}<div class="grow"><div>『${esc(it.title)}』</div><div class="muted">${esc(it.author||'저자 정보 없음')}${it.pages?' · '+it.pages+'쪽':''}</div></div></button>`).join(''):''}
  ${picked?`<div class="card row">${bthumb({title:pv.t||'',cover:pv.cover})}<div class="grow"><b>『${esc(pv.t||'')}』</b><div class="muted">${esc(pv.a||'')}${pv.tp?' · '+pv.tp+'쪽':''}</div></div><button class="ghost" data-act="bclear">다시 찾기</button></div>`:''}
  <label for="bt">제목</label><input id="bt" placeholder="데미안" value="${esc(pv.t||'')}"><div class="err" id="btE"></div>
  <label for="ba">저자</label><input id="ba" placeholder="헤르만 헤세" value="${esc(pv.a||'')}"><div class="err" id="baE"></div>
  <label for="btp">전체 쪽수 (선택)</label><input id="btp" type="number" min="1" inputmode="numeric" placeholder="모르면 비워 두세요" value="${esc(pv.tp||'')}">
  <div class="muted" style="margin-top:4px">책을 찾으면 표지, 제목, 저자, 쪽수가 한 번에 채워져요. 못 찾으면 직접 적어도 돼요.</div>
  <div class="foot" style="margin-top:14px"><button class="primary" data-act="addBook" style="width:100%">소파에 두기</button></div>`}
 if(panelView.mode==='finish'){const st=panelView.rating||0;
  return head('완독했어요')+`<div class="card"><b>『${esc(r.title)}』</b><div class="muted">${esc(r.author)} · 메모 ${r.notes.length}개</div></div>
  <label>별점 (선택)</label><div class="stars">${[1,2,3,4,5].map(n=>`<button data-act="star" data-n="${n}" class="${n<=st?'on':''}" aria-label="${n}점">★</button>`).join('')}</div>
  <label for="rv">한줄평 (선택)</label><input id="rv" placeholder="오래 남을 것 같은 책" value="${esc(panelView.review||'')}">
  <div class="row foot" style="margin-top:14px"><button data-act="cancelFinish">뒤로</button><button class="primary grow" data-act="doFinish">책장에 꽂기</button></div>`}
 if(panelView.mode==='drop'){return head('포기할까요?')+`<p>『${esc(r.title)}』을 소파에서 내려요. 남긴 메모 ${r.notes.length}개는 책장의 ‘포기한 책’에 그대로 보관돼요.</p>
  <div class="row"><button class="grow" data-act="cancelFinish">계속 읽기</button><button class="grow" data-act="doDrop" style="color:var(--danger)">포기</button></div>`}
 const type=panelView.type||'MEMO';
 return head('소파 · 읽는 중')+`<div class="card"><div class="row">${bthumb(r)}<div class="grow"><b>『${esc(r.title)}』</b><div class="muted">${esc(r.author)} · ${shortDate(r.startedAt)}부터</div></div></div>
  <label for="pg" style="margin-top:12px">어디까지 읽었나요?</label>
  <div class="row"><input id="pg" type="number" min="0" inputmode="numeric" placeholder="현재 쪽" value="${r.page==null?'':r.page}" style="width:96px"><span class="muted">/</span><input id="tp" type="number" min="1" inputmode="numeric" placeholder="전체 쪽" value="${r.totalPages||''}" style="width:96px"><span class="muted">쪽</span><b id="pv" class="grow" style="font-weight:normal;font-size:24px;text-align:right">${r.totalPages?r.progress+'%':''}</b></div>
  <div class="progress" style="margin:8px 0 4px"><i style="width:${r.progress||0}%"></i></div>
  <div class="muted" id="pgHint">${pgHint(r)}</div></div>
  <label>오늘 읽은 부분 남기기</label>
  <div class="seg"><button data-act="type" data-t="MEMO" class="${type==='MEMO'?'on':''}">메모</button><button data-act="type" data-t="QUOTE" class="${type==='QUOTE'?'on':''}">인용구</button></div>
  <textarea id="nc" style="margin-top:8px" placeholder="${type==='QUOTE'?'마음에 남은 문장을 그대로 적어요':'읽으면서 든 생각을 적어요'}">${esc(panelView.draft||'')}</textarea>
  <div class="err" id="ncE"></div>
  <div class="row" style="margin-top:6px"><input id="np" type="number" min="1" placeholder="쪽 (선택)" style="width:110px"><button class="primary grow" data-act="addNote">추가</button></div>
  <div style="margin-top:10px">${r.notes.length?r.notes.slice().reverse().map((n,ix)=>noteHTML(n,r.notes.length-1-ix,true)).join(''):'<p class="muted">아직 남긴 기록이 없어요.</p>'}</div>
  <div class="row foot" style="margin-top:14px"><button data-act="drop">포기</button><button class="primary grow" data-act="finish">완독</button></div>`;
}
function noteHTML(n,ix,del){return `<div class="note ${n.type==='QUOTE'?'q':''}">${n.type==='QUOTE'?'“'+esc(n.content)+'”':esc(n.content)}<div class="meta"><span>${n.type==='QUOTE'?'인용구':'메모'}${n.page?' · '+n.page+'쪽':''} · ${shortDate(n.at)}</span>${del?`<button class="ghost" style="padding:0 4px;font-size:12px" data-act="delNote" data-i="${ix}">삭제</button>`:''}</div></div>`}
function lampPanel(){
 const r=S.reading,ses=S.session,v=panelView;
 const tools=`<details style="margin-top:14px"><summary class="muted" style="cursor:pointer">테스트 도구 (시간 앞당기기)</summary><div class="row wrap" style="margin-top:8px"><button data-act="ff" data-m="10">+10분</button><button data-act="ff" data-m="60">+60분 · 확인 알림</button><button data-act="ff" data-m="185">+3시간 · 깜빡함</button></div><p class="muted">실제로는 서버의 시작 시각을 기준으로 계산해요. 여기서는 시작 시각을 과거로 옮겨서 흉내 내요. 알림은 5초 안에 와요.</p></details>`;
 if(ses&&ses.status==='NEEDS_CONFIRM'){
  const lastOk=ses.lastCheckAt-ses.startedAt>=60000;const lm=Math.floor((ses.lastCheckAt-ses.startedAt)/60000);
  if(v.mode==='cmanual')return head('스탠드 · 언제까지 읽었나요?')+`<label for="cm">읽은 시간 (분)</label><input id="cm" type="number" min="1" max="600" placeholder="45"><div class="err" id="cmE"></div><div class="row foot" style="margin-top:12px"><button data-act="back2">뒤로</button><button class="primary grow" data-act="confirmManual">저장</button></div>`;
  return head('스탠드 · 확인이 필요해요')+`<div class="card"><b>${fmtClock(ses.startedAt)}에 켠 스탠드가 아직 켜져 있어요.</b><div class="muted" style="margin-top:4px">3시간이 넘어서 기록을 잠시 멈췄어요. 언제까지 읽었나요?</div></div>
   ${lastOk?`<button class="primary" style="width:100%;margin-top:6px" data-act="confirmLast">마지막으로 '계속'을 누른 ${fmtClock(ses.lastCheckAt)}까지 · ${lm}분</button>`:`<button class="primary" style="width:100%;margin-top:6px" data-act="confirmHour">1시간 읽은 걸로 기록</button>`}
   <div class="row" style="margin-top:8px"><button class="grow" data-act="cmanual">직접 입력</button><button class="grow" data-act="discard" style="color:var(--danger)">기록 안 함</button></div>`;
 }
 if(!r)return head('스탠드 · 꺼짐')+`<p>소파에 책을 올리면 스탠드를 켤 수 있어요.</p><button class="primary" data-act="goSofa" style="width:100%">소파로 가기</button>`;
 const bookMin=minOfBook(r.id);
 if(ses){
  if(v.mode==='stop'){const pr=v.prog??r.progress;
   return head('읽기 끝')+`<div class="card"><div class="muted">이번에 읽은 시간</div><div style="font-size:28px">${fmtHMS(elapsed())}</div><div class="muted">${fmtClock(ses.startedAt)} ~ 지금 · 『${esc(r.title)}』</div></div>
   <label for="sp">어디까지 읽었나요?</label><div class="row"><input type="number" id="sp" min="0" inputmode="numeric" placeholder="현재 쪽" value="${r.page==null?'':r.page}" style="width:110px">${r.totalPages?`<span class="muted">/ ${r.totalPages}쪽</span>`:`<input type="number" id="stp" min="1" inputmode="numeric" placeholder="전체 쪽" style="width:110px">`}<b id="spv" class="grow" style="font-weight:normal;font-size:22px;text-align:right">${r.totalPages?r.progress+'%':''}</b></div>
   <label for="sm">한 줄 메모 (선택)</label><input id="sm" placeholder="오늘 읽은 부분에서 남기고 싶은 것" value="${esc(v.memo||'')}">
   <div class="row foot" style="margin-top:14px"><button data-act="back2">계속 읽기</button><button class="primary grow" data-act="stopSave">끄고 저장</button></div>`}
  return head('스탠드 · 켜짐')+`<div class="card" style="text-align:center"><div class="muted">『${esc(r.title)}』 읽는 중</div><div id="timerBig" style="font-size:40px;letter-spacing:1px;margin:4px 0">${fmtHMS(elapsed())}</div><div class="muted">${fmtClock(ses.startedAt)}에 켰어요 · 이 책 누적 ${bookMin}분</div></div>
   <p class="muted">화면을 꺼도, 앱을 닫아도 계속 기록돼요. 다시 열면 켠 시각부터 다시 계산해요.</p>${notifyRow()}
   <div class="row"><button class="primary grow" data-act="stopAsk">💡 스탠드 끄기</button>${pipOK()?`<button class="grow" data-act="pip">바탕화면에 띄우기</button>`:''}</div>${pipOK()?'':'<p class="muted" style="margin-top:6px">바탕화면 띄우기는 데스크톱 크롬·엣지·파이어폭스 151 이상에서 돼요.</p>'}
   <button class="ghost" style="width:100%;margin-top:6px;color:var(--danger)" data-act="discard">기록 안 하고 끄기</button>${tools}`;
 }
 if(v.mode==='manual')return head('직접 기록')+`<p class="muted">스탠드를 못 켜고 밖에서 읽었을 때 쓰세요.</p>
   <label>언제</label><div class="seg"><button data-act="mday" data-d="0" class="${(v.day||0)==0?'on':''}">오늘</button><button data-act="mday" data-d="1" class="${v.day==1?'on':''}">어제</button></div>
   <label for="mm">읽은 시간 (분)</label><input id="mm" type="number" min="1" max="600" placeholder="30"><div class="err" id="mmE"></div>
   <div class="row foot" style="margin-top:12px"><button data-act="back2">뒤로</button><button class="primary grow" data-act="manualSave">기록하기</button></div>`;
 const recent=S.sessions.filter(x=>x.bookId===r.id).sort((p,q)=>q.startedAt-p.startedAt).slice(0,5);
 return head('스탠드 · 꺼짐')+`<div class="card"><b>『${esc(r.title)}』</b><div class="muted" style="margin-top:4px">이 책 누적 ${bookMin}분 · 오늘 ${todayMin()}분</div></div>
  <button class="primary" style="width:100%" data-act="startTimer">스탠드 켜고 읽기 시작</button>
  <button style="width:100%;margin-top:6px" data-act="manual">밖에서 읽었어요 · 직접 기록</button>
  <label>최근 기록</label>${recent.length?recent.map(x=>`<div class="row" style="font-size:14px;padding:6px 0;border-bottom:1px solid var(--line)"><span class="grow">${fmtDay(x.startedAt)} ${x.source==='MANUAL'?'직접 기록':fmtClock(x.startedAt)+' ~ '+fmtClock(x.endedAt)}</span><b style="font-weight:normal">${x.minutes}분</b></div>`).join(''):'<p class="muted">아직 기록이 없어요.</p>'}`;
}
function shelfPanel(){
 const v=panelView;
 if(v.book!=null){const later=v.list==='later',list=later?S.later:v.drop?S.dropped:S.finished;const b=list.find(x=>x.id===v.book);if(!b){panelView={};return shelfPanel()}
  const tab=v.tab||(later?'rooms':'notes');const tabs=later?[['rooms','공유방 '+(b.rooms?b.rooms.length:0)]]:[['notes','기록 '+b.notes.length],['review','한줄평']].concat(b.rooms&&b.rooms.length?[['rooms','공유방 '+b.rooms.length]]:[]);
  let body='';
  if(tab==='notes')body=b.notes.length?b.notes.map(n=>noteHTML(n)).join(''):'<p class="muted">남긴 메모가 없어요.</p>';
  if(tab==='review')body=`<div class="card">${b.rating?`<div style="color:#e0a43a">${'★'.repeat(b.rating)}<span style="color:#d6c9ad">${'★'.repeat(5-b.rating)}</span></div>`:''}<div>${b.review?esc(b.review):'<span class="muted">한줄평이 없어요.</span>'}</div></div>`;
  if(tab==='rooms'){
   body=b.rooms.map(rm=>{const lbl=String(rm.title||'').replace(b.title,'').replace(/[『』]/g,'').trim()||(rm.rtype==='OWN'?'각자 읽기':'이야기방');return `<div class="card"><b>${esc(lbl)}</b><div class="muted">${rm.period} · 가져온 기록</div><div style="margin-top:8px">${rm.messages.map(m=>`<div class="msg"><b>${esc(m.who)}</b>${esc(m.text)}</div>`).join('')}</div></div>`}).join('')+'<p class="muted">다른 참여자 이름은 익명으로 보관돼요.</p>'}
  return head('책장')+`<button class="ghost" data-act="back" style="padding:4px 0">← 목록</button>
   <div class="row" style="margin-top:6px">${bthumb(b)}<div><b>『${esc(b.title)}』</b><div class="muted">${esc(b.author)} · ${later?'나중에 읽을 책':v.drop?'포기':shortDate(b.finishedAt)+' 완독'}</div>${!later&&minOfBook(b.id)>0?`<div class="muted">⏱ 읽은 시간 ${fmtMin(minOfBook(b.id))} · 기록 ${S.sessions.filter(x=>x.bookId===b.id).length}번</div>`:''}</div></div>
   ${later?`<button class="primary" data-act="laterToSofa" data-id="${b.id}" style="width:100%;margin-top:8px">소파에 올리기</button>`:''}
   <div class="tabs">${tabs.map(([k,l])=>`<button data-act="tab" data-t="${k}" class="${tab===k?'on':''}">${l}</button>`).join('')}</div>${body}`}
 const showDrop=v.list==='drop',showLater=v.list==='later';
 const list=showLater?S.later.slice().reverse():showDrop?S.dropped:S.finished.slice().reverse();
 return head('책장')+`<div class="tabs"><button data-act="list" data-t="done" class="${!showDrop&&!showLater?'on':''}">다 읽은 책 ${S.finished.length}</button><button data-act="list" data-t="drop" class="${showDrop?'on':''}">포기한 책 ${S.dropped.length}</button><button data-act="list" data-t="later" class="${showLater?'on':''}">나중에 읽을 책 ${S.later.length}</button></div>
  ${showLater?'<p class="muted">공유방에서 가져왔는데 아직 내 책장에 없는 책이에요. 이 책을 소파에 올리면 이 목록에서 빠지고, 공유방 기록은 그대로 따라와요.</p>':''}
  ${list.length?list.map(b=>`<button class="book" data-act="openBook" data-id="${b.id}" data-drop="${showDrop?1:0}"><div class="spine" style="background:${bookColor(b.title)}"></div><div class="grow"><div>『${esc(b.title)}』</div><div class="muted">${esc(b.author)}${b.rating?' · '+'★'.repeat(b.rating):''}</div></div>${b.rooms&&b.rooms.length?'<span class="badge">공유방</span>':''}</button>`).join(''):'<p class="muted">아직 없어요.</p>'}`;
}
function mirrorPanel(){
 const a=tempAvatar,fc=S.finished.length;
 const lock={face:v=>v==='glasses'&&!S.unlocked.glasses,head:v=>v==='beanie'&&fc<10};
 const opt=(lab,inner)=>`<div class="opt"><label>${lab}</label><div class="row wrap">${inner}</div></div>`;
 const chips=(k,list)=>list.map(([v,n])=>{const lk=lock[k]&&lock[k](v);return `<button class="acc ${a[k]===v?'on':''}" data-act="av" data-k="${k}" data-v="${v}" ${lk?'disabled':''}>${n}${lk?(k==='face'?' · 첫 책 기록 후':' · 10권 읽으면'):''}</button>`}).join('');
 const img=G3?`<img src="${G3.snap(a,'body')}" alt="유령 미리보기">`:'';
 return head('전신거울')+`<div class="mir"><div class="mir-l"><div class="mir-pv">${img}</div>
   <button class="shuffle" data-act="shuffle" aria-label="셔플" title="셔플"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg></button></div>
  <div class="mir-r">
  ${opt('색상',COLORS.map(([n,c])=>`<button class="sw ${a.color===c?'on':''}" style="background:${c}" data-act="av" data-k="color" data-v="${c}" aria-label="${n}"></button>`).join(''))}
  ${opt('표정',chips('expr',EXPR))}${opt('얼굴 장식',chips('face',FACE))}${opt('머리 장식',chips('head',HEAD))}${opt('손에 든 소품',chips('prop',PROP))}
  </div></div>
  <div class="row foot" style="margin-top:16px"><button data-act="cancelMirror" class="grow">취소</button><button class="primary grow" data-act="saveMirror">저장</button></div>`;
}
// 목표 카드의 "목표를 바꿨어요" 표시 (결정 #39). 달 중간에 바꾸면 그 달에 기록이 남고, 지난 달을 볼 때도 보인다.
function goalNoteText(c){const ch=c.changes;
 if(ch.length)return '🔁 목표를 바꿨어요 · '+ch[0].from+'→'+c.goal+'권 ('+mmdd(ch[ch.length-1].at)+(ch.length>1?', '+ch.length+'번':'')+')';
 if(c.off===0&&!c.goalSet&&c.goal!=null)return '지난 달 목표를 이어받았어요';return ''}
const goalStatText=c=>c.goal==null?'완독 '+c.done+'권 · 이 달은 목표 기록이 없어요':'완독 '+c.done+'/'+c.goal+'권'+(c.done>=c.goal?' · 목표 달성':c.off<0?' · 목표 미달성':'')+' · 포기한 책은 세지 않아요';
function calendarPanel(){
 const off=Math.min(0,panelView.calOff||0),c=calData(off),cur=off===0,pct=c.goal?Math.min(100,Math.round(c.done/c.goal*100)):0;
 const heads=['일','월','화','수','목','금','토'].map(n=>`<b>${n}</b>`).join('');
 let cells='';for(let i=0;i<c.first;i++)cells+='<i></i>';
 for(let d=1;d<=c.dim;d++)cells+=`<i class="${c.marks.includes(d)?'on':''}${d===c.today?' today':''}">${d}</i>`;
 const goalCard=cur
  ?`<div class="card"><div class="row"><span class="grow">이번 달 완독 목표</span><button data-act="goalDec" aria-label="목표 줄이기">−</button><input id="goal" type="number" min="1" max="99" value="${c.goal}" style="width:64px;text-align:center"><button data-act="goalInc" aria-label="목표 늘리기">+</button><span>권</span></div>`
  :`<div class="card"><div class="row"><span class="grow">${c.m}월 완독 목표</span><b style="font-weight:normal;font-size:20px">${c.goal!=null?c.goal+'권':'기록 없음'}</b></div>`;
 return head('달력')+`<div class="card"><div class="row"><button data-act="calPrev" aria-label="이전 달" ${c.canPrev?'':'disabled'}>‹</button><b class="grow" style="text-align:center">${c.y}년 ${c.m}월</b><button data-act="calNext" aria-label="다음 달" ${c.canNext?'':'disabled'}>›</button></div>
  <div class="cal" style="margin-top:8px">${heads}${cells}</div>
  <div class="muted" style="margin-top:8px">초록색에 점이 찍힌 날은 책을 읽었거나 완독한 날이에요.</div></div>
  ${cur?`<div class="card"><div class="row"><span class="grow">연속 독서일</span><b style="font-weight:normal;font-size:20px">${c.streak}일</b></div><div class="muted">오늘 또는 어제부터 이어서 센 날수예요. 같은 날 여러 번 읽어도 하루예요.</div></div>`:''}
  ${goalCard}
  ${c.goal!=null?`<div class="progress" style="margin:10px 0 6px"><i id="goalBar" style="width:${pct}%"></i></div>`:''}<div class="muted" id="goalStat">${goalStatText(c)}</div><div class="muted" id="goalNote" style="margin-top:6px">${goalNoteText(c)}</div>${cur?'':'<div class="muted" style="margin-top:6px">지난 달의 목표는 바꿀 수 없어요.</div>'}</div>`;
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
function boardPanel(){
 const sec=(t,k)=>{const l=S.news.filter(n=>n.kind===k);return l.length?`<label>${t}</label>`+l.map(roomCard).join(''):''};
 return head('마을 게시판')+(S.news.length?sec('열린 방','OPEN')+sec('곧 열릴 방','SOON')+sec('지난 방','CLOSED'):'<p class="muted">지금 열린 공유방이 없어요.</p>')
  +'<button class="primary" data-act="newRoom" style="width:100%;margin-top:10px">모닥불 피우기</button>'
  +'<label for="jl">초대 링크로 들어가기</label><div class="row"><input id="jl" placeholder="초대 링크나 코드"><button data-act="joinLink">들어가기</button></div>'
  +'<p class="muted" style="margin-top:10px">공유방 기록은 종료 후 7일 동안만 보관돼요. 모닥불이 작아지다 꺼지면 사라져요.</p>';
}
// ===== 마을 광장: 방에 들어가지 않고 하는 짧은 대화. 하루 뒤 사라진다 =====
const hhmm=ts=>new Date(ts).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
const plazaLogHtml=()=>S.plaza.length?S.plaza.slice(-30).map(m=>`<div class="msg ${m.mine?'me':''}"><b>${esc(m.who)}</b>${esc(m.text)}<i>${hhmm(m.ts)}</i></div>`).join(''):'<p class="muted">아직 아무도 말하지 않았어요. 첫 마디를 남겨 보세요.</p>';
function plazaSay(who,text,i,mine){
 S.plaza.push({who,text,ts:Date.now(),mine:!!mine});S.plaza=S.plaza.slice(-60);save();
 if(G3)G3.say(i,text);
 const lg=document.getElementById('pzLog');if(pzShown&&lg){const atEnd=lg.scrollHeight-lg.scrollTop-lg.clientHeight<40||mine;lg.innerHTML=plazaLogHtml();if(atEnd)lg.scrollTop=lg.scrollHeight}
}
// 광장 대화창: 광장(돌바닥) 안에 있을 때만 보이고, 밖으로 나가면 사라진다. 제목을 누르면 접어 둘 수 있다.
let pzShown=false;
const pzBox=document.getElementById('plazaChat');
const pzHeadText=()=>{document.getElementById('pzHead').textContent='💬 광장 이야기 · 접속 ('+String(NPCS.length+1).padStart(2,'0')+'/'+VMAX+') '+(pzBox.classList.contains('min')?'▴':'▾')};
function syncPlazaChat(){
 const on=VIEW==='village'&&inPlaza(sim.x,sim.z);if(on===pzShown)return;pzShown=on;
 document.getElementById('stageWrap').classList.toggle('pz',on);
 if(on){const lg=document.getElementById('pzLog');lg.innerHTML=plazaLogHtml();lg.scrollTop=lg.scrollHeight;pzHeadText()}}
pzBox.addEventListener('click',e=>{if(e.target.closest('#pzHead')){pzBox.classList.toggle('min');pzHeadText()}if(e.target.closest('#pzSend'))plazaSend()});
pzBox.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.target.id==='pz'){e.preventDefault();plazaSend()}});
// 폰 키보드가 올라오면 하단 채팅창이 키보드 위로 올라오게 한다
if(window.visualViewport){const vv=visualViewport,adj=()=>document.documentElement.style.setProperty('--kb',Math.max(0,innerHeight-vv.height-vv.offsetTop)+'px');vv.addEventListener('resize',adj);vv.addEventListener('scroll',adj)}
function plazaSend(){
 const inp=document.getElementById('pz'),e=document.getElementById('pzE'),t=inp.value.trim().slice(0,40);if(!t){inp.value='';return}
 if(!inPlaza(sim.x,sim.z)){e.textContent='광장 안으로 걸어가는 중이에요. 도착하면 보낼 수 있어요';return}
 e.textContent='';inp.value='';inp.focus();plazaSay('나',t,-1,true);
 setTimeout(()=>{if(VIEW==='village')plazaSay('@'+NPCS[1].name,NPC_REPLY[Math.floor(Math.random()*NPC_REPLY.length)],1)},2200+Math.random()*2000);
}
// 체험판: 가짜 이웃이 가끔 말을 건다
setInterval(()=>{S.plaza=(S.plaza||[]).filter(m=>Date.now()-m.ts<864e5);if(VIEW!=='village'||Math.random()<.4)return;const i=Math.floor(Math.random()*NPCS.length);plazaSay('@'+NPCS[i].name,NPC_SAY[Math.floor(Math.random()*NPC_SAY.length)],i)},9000);
// ===== 모닥불 피우기 (공유방 개설) =====
const RDEF=()=>({kind:'SAME',bookSel:S.reading?'sofa':'',bookTitle:'',name:'',start:'now',when:'',days:7,vis:'invite',max:8});
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
const MAXMSG=300,SEND_GAP=5000;let rcLast=0;
const NAMEPOOL=['@나무','@달빛','@구름','@바다','@모래','@하늘','@바람','@여울','@노을','@이끼','@솔','@봄비','@담쟁이','@반딧불','@물결','@새벽','@고래','@해님','@도토리','@별빛','@안개','@돌담','@산들','@풀잎','@종이배','@낮달','@오솔길','@소나기','@온새미','@아침'];
const BOOKPOOL=['아몬드','어린 왕자','사피엔스','채식주의자','불편한 편의점','모순','데미안','82년생 김지영'];
const ROOM_SAY=['처음엔 느리게 읽히다가 중반부터 확 빨려 들어갔어요','이 장면에서 한참 멈춰 있었어요','문장이 너무 좋아서 밑줄 쳤어요','저는 이 인물이 이해되면서도 답답했어요','여기까지 읽은 분 계세요?','다음 장이 기대돼요','잠깐 덮어 두고 생각 좀 했어요','오늘은 여기까지 읽고 쉴게요','마음에 남는 문장이 있어요','예상 못 한 전개였어요','분위기가 확 달라지는 부분이었어요','같이 읽으니까 끝까지 읽게 돼요'];
const rcKey=s=>String(s||'').replace(/[『』\s]/g,'');
const roomBook=n=>n.book||shortTitle(n);
const rcMine=m=>m.who==='나'&&!m.left;
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
 if(!n.max||n.max>RMAX)n.max=RMAX;   // 방 최대 인원은 20명까지 (예전에 더 크게 만든 방도 맞춘다)
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
S.news.forEach(rcNorm);save();
// 모닥불 장면에 있을 때 글을 보내거나 받으면 그 사람 머리 위에 말풍선을 띄운다.
function campBubble(n,m){
 if(VIEW!=='shared'||CAMP_ID!==n.id||!G3||m.del)return;
 const i=rcMine(m)?-1:Math.max(0,n.members.indexOf(m.who))%5,t=m.text.length>40?m.text.slice(0,40)+'…':m.text;
 G3.say(i,t)}
function rcFakeMsg(n){
 if(!n.members.length)return;const who=n.members[Math.floor(Math.random()*n.members.length)],p=myPos(n).page;let page=null;
 if(n.rtype!=='OWN')page=p?Math.max(1,Math.round(p+Math.random()*100-25)):Math.round(10+Math.random()*300);
 const fm={id:'m'+Date.now()+Math.floor(Math.random()*99),who,text:ROOM_SAY[Math.floor(Math.random()*ROOM_SAY.length)],page,ts:Date.now()};n.messages.push(fm);campBubble(n,fm);
 if(n.messages.length>300)n.messages.splice(0,n.messages.length-300);
 const viewing=panelOpen==='room:'+n.id&&(panelView.tab||'chat')==='chat';if(viewing)n.lastRead=Date.now();
 save();render();if(viewing)rcRefresh(n)}
// 체험판: 참여 중인 열린 방에 가짜 참여자가 가끔 글을 보낸다
setInterval(()=>{const l=S.news.filter(n=>n.kind==='OPEN'&&n.agreed&&n.members.length);if(l.length&&Math.random()<.6)rcFakeMsg(l[Math.floor(Math.random()*l.length)])},12000);
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
  const ask=panelView.delAsk===m.id;
  out+=`<div class="rm${mine?' me':''}"><div class="rm-h"><i style="background:${rcColor(m.left?'나간':m.who)}"></i><b>${esc(rcName(m))}</b>${m.who===n.owner&&!m.left?CROWN:''}${m.page!=null?`<span class="pg">${m.page}쪽</span>`:''}<time>${hhmm(m.ts)}</time>${mine&&n.kind==='OPEN'&&!ask?`<button class="rm-x" data-act="rcDelAsk" data-id="${m.id}" aria-label="내 글 메뉴">⋯</button>`:''}</div>`
   +`<div class="rm-t">${esc(m.text)}</div>`
   +(ask?`<div class="row" style="margin-top:6px"><span class="muted grow">이 글을 삭제할까요?</span><button data-act="rcDelNo">취소</button><button data-act="rcDelYes" data-id="${m.id}" style="color:var(--danger)">삭제</button></div>`:'')+`</div>`});
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
 if(Date.now()-rcLast<SEND_GAP){e.textContent='조금 뒤에 보내 주세요';return}
 const pg=n.rtype==='OWN'?null:rcPage(n);
 const mm={id:'m'+Date.now(),who:'나',text:t,page:pg??null,ts:Date.now()};n.messages.push(mm);campBubble(n,mm);if(n.messages.length>300)n.messages.splice(0,n.messages.length-300);
 rcLast=Date.now();panelView.draft='';ta.value='';e.textContent='';n.lastRead=Date.now();save();render();rcRefresh(n,true);ta.focus()}
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
 const state=n.kind==='CLOSED'?'종료 · D-'+roomLeft(n):(n.closesAt?mmdd(n.closesAt)+' 종료':'진행 중');
 const tabs=`<div class="seg rtabs">${[['chat','대화'],['members','참여자'],['info','방 정보']].map(([v,l])=>`<button data-act="rctab" data-v="${v}" class="${tab===v?'on':''}">${l}</button>`).join('')}</div>`;
 let body='';
 if(tab==='chat')body=rcBand(n)+rcSpoilBar(n)+`<div class="rlog" id="rcLog">${rcLogHtml(n)}</div><div style="text-align:center"><button class="rchip" id="rcDown" data-act="rcDown" style="display:none">↓ 맨 아래로</button></div>`+rcFoot(n);
 if(tab==='members')body=rcMembersHtml(n);
 if(tab==='info')body=rcInfoHtml(n);
 const camp=VIEW==='shared';
 // 책 제목은 한 화면에 한 번만: 장면에서는 위 제목줄이, 모달에서는 창 제목이 맡는다
 const bk=!camp||rcKey(n.title).includes(rcKey(roomBook(n)))?'':'『'+esc(roomBook(n))+'』 · ';
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
 if(act==='rctab'){panelView.tab=b.dataset.v;panelView.leaveAsk=false;panelView.delAsk=null;renderPanel();return true}
 if(act==='rcChip'){panelView.chipEdit=true;renderPanel();const i=document.getElementById('rcPg');if(i)i.focus();return true}
 if(act==='rcChipOk'){const v=Math.round(+document.getElementById('rcPg').value);panelView.pg=v>=1&&v<=9999?v:null;panelView.chipEdit=false;renderPanel();return true}
 if(act==='rcChipNone'){panelView.pg=null;panelView.chipEdit=false;renderPanel();return true}
 if(act==='rcSend'){if(n)rcSend(n);return true}
 if(act==='rcDown'){const lg=document.getElementById('rcLog');if(lg)lg.scrollTop=lg.scrollHeight;b.style.display='none';return true}
 if(act==='rcDelAsk'){panelView.delAsk=b.dataset.id;if(n)rcRefresh(n);return true}
 if(act==='rcDelNo'){panelView.delAsk=null;if(n)rcRefresh(n);return true}
 if(act==='rcDelYes'){if(!n)return true;const m=n.messages.find(x=>x.id===b.dataset.id);if(m&&rcMine(m)){m.del=true;m.text='';}panelView.delAsk=null;save();rcRefresh(n);return true}
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
  <label>기간</label>${seg('rdays',[[3,'3일'],[7,'7일'],[14,'14일']],nf.days)}
  ${PUBLIC_ROOMS?`<label>공개 범위</label>${seg('rvis',[['invite','초대 링크로만'],['public','마을에 공개']],nf.vis)}`:'<p class="muted" style="margin:10px 0 0">초대 링크로 부른 친구만 들어올 수 있어요.</p>'}
  <label for="rmax">최대 인원</label><input id="rmax" type="number" min="2" max="${RMAX}" value="${nf.max}" style="width:100px">
  
  <div class="err" id="rerr"></div>
  <div class="foot" style="margin-top:14px"><button class="primary" data-act="rcreate" style="width:100%">모닥불 피우기</button></div>`;
}
function createRoom(){
 const nf=panelView.nf,err=m=>{document.getElementById('rerr').textContent=m};
 const b=nfBook(nf),max=Math.round(+nf.max);
 if(S.news.filter(n=>n.mine&&n.kind!=='CLOSED').length>=2)return err('동시에 열 수 있는 모닥불은 2개예요. 하나를 끝낸 뒤에 다시 피워 주세요');
 if(nf.kind==='SAME'&&!b)return err('함께 읽을 책을 골라 주세요');
 if(!(max>=2&&max<=RMAX))return err('최대 인원은 2~'+RMAX+'명이에요');
 const now=Date.now();let opens=now;
 if(nf.start==='later'){opens=new Date(nf.when).getTime();if(!(opens>now+60000))return err('시작 시각은 지금보다 뒤로 정해 주세요')}
 const name=(nf.name||'').trim()||defaultRoomName(nf),closes=opens+nf.days*DAY;
 const room={id:'r'+now,kind:opens<=now?'OPEN':'SOON',title:name,sub:'',book:b?b.title:'',author:b?b.author:'',cover:b?b.cover:'',isbn:b?b.isbn:'',rtype:nf.kind,mine:true,people:1,max,vis:nf.vis,inviteCode:genCode(),opensAt:opens,closesAt:closes,alarm:true,done:false,messages:[],period:mmdd(opens)+' ~ '+mmdd(closes)};
 rcNorm(room);S.news.push(room);save();panelView.created=room.id;render();renderPanel();buildSr();toast('모닥불을 피웠어요');
}
async function copyLink(n){const link=inviteLink(n);try{await navigator.clipboard.writeText(link);toast('링크를 복사했어요')}catch(e){const i=document.getElementById('invLink');if(i){i.select();try{document.execCommand('copy');toast('링크를 복사했어요')}catch(_){toast('링크를 길게 눌러 복사해 주세요')}}}}
function findByCode(c){c=String(c||'').trim();const m=/join=([A-Za-z0-9]+)/i.exec(c);if(m)c=m[1];c=c.toUpperCase();return S.news.find(n=>n.inviteCode===c)}
function joinByCode(c){
 const n=findByCode(c);
 if(!n){toast('초대 코드를 찾을 수 없어요. 체험판에서는 같은 브라우저에서 만든 모닥불만 열려요');return false}
 if(VIEW!=='village'){enterVillage();setTimeout(()=>openV('room:'+n.id),900)}else openV('room:'+n.id);
 toast(n.mine?'내가 만든 모닥불이에요':'모닥불에 들어왔어요');return true;
}
function windowPanel(){
 const K={OPEN:['진행 중',''],SOON:['예정','gray'],CLOSED:['종료','warn']};
 const sc=windowScene();
 return head('창문')+`<div class="muted" style="margin:0 0 8px">오늘 창밖은 ${sc.season} ${sc.weather}이에요.</div>`+S.news.map(n=>{const [l,c]=K[n.kind];let act='';
  if(n.kind==='OPEN')act=`<button data-act="goVillage">마을로 가기</button>`;
  if(n.kind==='SOON')act=`<button data-act="alarm" data-id="${n.id}">${n.alarm?'알림 받는 중 ✓':'알림 받기'}</button>`;
  if(n.kind==='CLOSED')act=n.done?`<span class="muted">내 서재로 가져옴 ✓</span>`:(rcEmpty(n))?`<span class="muted">가져올 대화가 없어요</span>`:`<button class="primary" data-act="import" data-id="${n.id}">내 서재로 가져오기</button>`;
  return `<div class="card"><div class="row"><span class="badge ${c}">${l}</span>${rcUnread(n)?'<span class="badge">새 글</span>':''}<b class="grow" style="font-weight:normal">${esc(n.title)}</b></div><div class="muted" style="margin:6px 0 8px">${esc(roomSub(n))}</div>${act}</div>`}).join('')+'<p class="muted">공유방 기록은 종료 후 7일 동안만 보관돼요.</p>'
  +`<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">테스트 도구 (창밖 풍경 바꿔 보기)</summary><div class="row wrap" style="margin-top:8px"><button data-act="sceneNext">다른 날씨 보기</button></div><p class="muted">실제로는 날짜마다 풍경이 바뀌어요. 여기서는 다음 날씨로 넘겨 봐요.</p></details>`
  +(S.news.some(n=>n.kind==='SOON')?`<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">테스트 도구 (개방 시각 앞당기기)</summary><div class="row wrap" style="margin-top:8px">${S.news.filter(n=>n.kind==='SOON').map(n=>`<button data-act="openNow" data-id="${n.id}">${esc(n.title)} 지금 열기</button>`).join('')}</div><p class="muted">알림 받기를 켜 둔 방은 열릴 때 알림이 와요.</p></details>`:'');
}
function cancelMirror(){tempAvatar=null;zoom(false);render()}

panel.addEventListener('change',e=>{
 if(e.target.id==='rbook'){panelView.nf.bookSel=e.target.value;renderPanel()}
 if(e.target.id==='goal'){const s=e.target.value;if(s!=='')setGoal(+s);save();renderPanel();render()} // 칸을 벗어나면 1~99로 맞춰 화면과 저장값을 일치시킨다
});
panel.addEventListener('input',e=>{
 if(e.target.id==='rname')panelView.nf.name=e.target.value;
 if(e.target.id==='rmax')panelView.nf.max=e.target.value;
 if(e.target.id==='rbookt')panelView.nf.bookTitle=e.target.value;
 if(e.target.id==='rwhen')panelView.nf.when=e.target.value;
 if(e.target.id==='goal'){let v=Math.round(+e.target.value);if(!(v>=1))return;v=Math.min(99,v);if(v!==+e.target.value)e.target.value=v;setGoal(v);
  const c=calData(),bar=document.getElementById('goalBar'),st=document.getElementById('goalStat'),nt=document.getElementById('goalNote');
  if(bar)bar.style.width=Math.min(100,Math.round(c.done/c.goal*100))+'%';if(st)st.textContent=goalStatText(c);if(nt)nt.textContent=goalNoteText(c);render()}
 if(e.target.id==='pg'||e.target.id==='tp'){const r=S.reading,pg=document.getElementById('pg').value,tp=document.getElementById('tp').value;
  r.page=pg===''?null:Math.max(0,Math.round(+pg));r.totalPages=Math.round(+tp)>=1?Math.min(9999,Math.round(+tp)):null;updProgress(r);save();
  document.getElementById('pv').textContent=r.totalPages?r.progress+'%':'';const bar=panel.querySelector('.card .progress i');if(bar)bar.style.width=(r.progress||0)+'%';
  document.getElementById('pgHint').textContent=pgHint(r);render()}
 if(e.target.id==='bq'){panelView.q=e.target.value}
 if(e.target.id==='btp'){panelView.tp=e.target.value}
 if(e.target.id==='rc'){panelView.draft=e.target.value}
 if(e.target.id==='nc'){panelView.draft=e.target.value;document.getElementById('ncE').textContent=''}
 if(e.target.id==='bt'){panelView.t=e.target.value;document.getElementById('btE').textContent=''}
 if(e.target.id==='ba'){panelView.a=e.target.value;document.getElementById('baE').textContent=''}
 if(e.target.id==='rv'){panelView.review=e.target.value}
 if(e.target.id==='sp'||e.target.id==='stp'){const r=S.reading,sp=document.getElementById('sp'),stp=document.getElementById('stp'),tot=r.totalPages||(stp&&Math.max(0,Math.min(9999,+stp.value)))||0,pgv=sp.value===''?null:+sp.value;
  document.getElementById('spv').textContent=tot&&pgv!=null?Math.min(100,Math.max(0,Math.round(pgv/tot*100)))+'%':''}
 if(e.target.id==='sm'){panelView.memo=e.target.value}
});
panel.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='bq'){e.preventDefault();runSearch()}if(e.key==='Enter'&&e.target.id==='pz'&&!e.isComposing){e.preventDefault();plazaSend()}
 if(e.key==='Enter'&&!e.shiftKey&&e.target.id==='rc'&&!e.isComposing){e.preventDefault();const n=S.news.find(x=>'room:'+x.id===panelOpen);if(n)rcSend(n)}});
const onPanelClick=e=>{
 const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act;
 if(act==='cmClose'){panelView.sheet=null;renderPanel();return}
 if(act==='close')return VIEW==='shared'?askExitCamp():closePanel();
 if(act==='plazaSend')return plazaSend();
 if(act==='home'){openF(b.dataset.f);return}
 if(act==='handle')return panel.classList.toggle('full');
 if(act==='addBook'){const t=(panelView.t||'').trim(),a=(panelView.a||'').trim();let bad=false;
  if(!t){document.getElementById('btE').textContent='제목을 입력해 주세요';bad=true}
  if(!a){document.getElementById('baE').textContent='저자를 입력해 주세요';bad=true}
  if(bad)return;
  const tp=Math.round(+panelView.tp)>=1?Math.min(9999,Math.round(+panelView.tp)):null;  // 전체 쪽수: 빈 값 또는 1~9999
  const li=S.later.findIndex(x=>x.title===t),lrooms=li>=0?S.later.splice(li,1)[0].rooms:[]; // 나중에 읽을 책에 있던 책이면 목록에서 빼고 공유방 기록을 이어 받는다
  S.reading={id:Date.now(),title:t,author:a,cover:panelView.cover||'',isbn:panelView.isbn||'',totalPages:tp,page:0,progress:0,notes:[],rooms:lrooms,startedAt:today()};panelView={};
  const wasOb=S.onboard===1;if(wasOb)S.onboard=2;save();render();renderPanel();toast('소파에 『'+t+'』을 올렸어요');return}
 if(act==='laterToSofa'){const i=S.later.findIndex(x=>x.id===+b.dataset.id);if(i<0)return;   // 나중에 읽을 책을 책장에서 바로 소파에 올린다. 공유방 기록이 따라온다
  if(S.reading){toast('소파에 이미 읽는 책이 있어요. 먼저 완독하거나 포기해 주세요');return}
  const lb=S.later.splice(i,1)[0];S.reading={id:Date.now(),title:lb.title,author:lb.author||'',cover:lb.cover||'',isbn:lb.isbn||'',totalPages:lb.totalPages||null,page:0,progress:0,notes:[],rooms:lb.rooms||[],startedAt:today()};
  save();closePanel();render();toast('소파에 『'+lb.title+'』을 올렸어요. 공유방 기록이 따라왔어요');return}
 if(act==='type'){panelView.type=b.dataset.t;renderPanel();return}
 if(act==='addNote'){const c=(panelView.draft||'').trim();if(!c){document.getElementById('ncE').textContent='내용을 입력해 주세요';return}
  const pg=Math.max(0,Math.round(+document.getElementById('np').value))||null,rd=S.reading;rd.notes.push({type:panelView.type||'MEMO',content:c,page:pg,at:today()});panelView.draft='';
  if(pg&&(rd.page==null||pg>rd.page)){rd.page=pg;updProgress(rd);toast(pg+'쪽까지 읽은 걸로 기록했어요'+(rd.totalPages?' ('+rd.progress+'%)':''))}
  save();render();renderPanel();return}
 if(act==='delNote'){S.reading.notes.splice(+b.dataset.i,1);save();renderPanel();return}
 if(act==='finish'){panelView.mode='finish';renderPanel();return}
 if(act==='drop'){panelView.mode='drop';renderPanel();return}
 if(act==='cancelFinish'){panelView.mode=null;renderPanel();return}
 if(act==='star'){panelView.rating=+b.dataset.n===panelView.rating?0:+b.dataset.n;renderPanel();return}
 if(act==='doFinish'){if(S.session&&S.session.status==='NEEDS_CONFIRM'){openF('lamp');toast('먼저 스탠드 시간을 확인해 주세요');return}const rating=panelView.rating||0,review=(panelView.review||'').trim();   // endSession()이 panelView를 비우기 전에 별점·한줄평을 챙긴다 (Codex QA)
 if(S.session)endSession(Date.now(),'FINISH',true);const r=S.reading;const id=r.id||Date.now();S.finished.push({id,title:r.title,author:r.author,cover:r.cover||'',isbn:r.isbn||'',totalPages:r.totalPages||null,rating,review,finishedAt:ymd(),notes:r.notes,rooms:r.rooms||[]});
  S.reading=null;panelView={};save();closePanel();render();if(G3)G3.flash('shelf');toast('『'+r.title+'』을 책장에 꽂았어요');return}
 if(act==='doDrop'){if(S.session&&S.session.status==='NEEDS_CONFIRM'){openF('lamp');toast('먼저 스탠드 시간을 확인해 주세요');return}if(S.session)endSession(Date.now(),'FINISH',true);const r=S.reading;S.dropped.push({id:r.id||Date.now(),title:r.title,author:r.author,cover:r.cover||'',isbn:r.isbn||'',totalPages:r.totalPages||null,rating:0,review:'',finishedAt:ymd(),notes:r.notes,rooms:r.rooms||[]});S.reading=null;panelView={};save();closePanel();render();toast('소파를 비웠어요');return}
 if(act==='goSofa'){openF('sofa');return}
 if(act==='startTimer'){startTimer();return}
 if(act==='pip'){openPip();return}
 if(act==='stopAsk'){panelView={mode:'stop'};renderPanel();return}
 if(act==='back2'){panelView={};renderPanel();return}
 if(act==='stopSave'){const r=S.reading,sp=document.getElementById('sp'),stp=document.getElementById('stp');
  if(stp&&stp.value){const tp=Math.round(+stp.value);r.totalPages=tp>=1?Math.min(9999,tp):null}   // 소파 입력과 같은 규칙: 1~9999, 아니면 비움 (#36)
  if(sp&&sp.value!=='')r.page=Math.max(0,Math.round(+sp.value));updProgress(r);const m=(panelView.memo||'').trim();if(m)r.notes.push({type:'MEMO',content:m,page:null,at:today()});endSession(Date.now(),'LAMP');return}
 if(act==='discard'){if(pipWin)pipDone(0);S.session=null;save();panelView={};render();renderPanel();toast('기록하지 않고 스탠드를 껐어요');return}
 if(act==='ff'){const ms=+b.dataset.m*60000;S.session.startedAt-=ms;S.session.lastCheckAt-=ms;if(+b.dataset.m>=180)S.session.lastCheckAt=S.session.startedAt+70*60000;save();checkSession(true);return}
 if(act==='confirmLast'){endSession(S.session.lastCheckAt,'CONFIRM');return}
 if(act==='confirmHour'){endSession(S.session.startedAt+3600000,'CONFIRM');return}
 if(act==='cmanual'){panelView={mode:'cmanual'};renderPanel();return}
 if(act==='confirmManual'){const m=Math.round(+document.getElementById('cm').value);if(!(m>=1&&m<=600&&m*60000<=Date.now()-S.session.startedAt)){document.getElementById('cmE').textContent='1~600분 사이, 켠 뒤 지난 시간 안으로 입력해 주세요';return}endSession(S.session.startedAt+m*60000,'CONFIRM');return}
 if(act==='manual'){panelView={mode:'manual',day:0};renderPanel();return}
 if(act==='mday'){panelView.day=+b.dataset.d;renderPanel();return}
 if(act==='manualSave'){const m=Math.round(+document.getElementById('mm').value);if(!(m>=1&&m<=600)){document.getElementById('mmE').textContent='1~600분 사이로 입력해 주세요';return}
  const d=new Date();d.setDate(d.getDate()-(panelView.day||0));d.setHours(12,0,0,0);S.sessions.push({id:Date.now(),bookId:S.reading.id,startedAt:d.getTime(),endedAt:d.getTime()+m*60000,minutes:m,source:'MANUAL',endedBy:'MANUAL'});save();panelView={};render();renderPanel();toast(m+'분을 기록했어요');return}
 if(act==='list'){panelView={list:b.dataset.t};renderPanel();return}
 if(act==='openBook'){panelView={book:+b.dataset.id,drop:b.dataset.drop==='1',list:panelView.list};renderPanel();return}
 if(act==='back'){panelView={list:panelView.list};renderPanel();return}
 if(act==='tab'){panelView.tab=b.dataset.t;renderPanel();return}
 if(act==='av'){if(b.disabled)return;tempAvatar[b.dataset.k]=b.dataset.v;renderPanel();render();return}
 if(act==='shuffle'){const pk=l=>l[Math.floor(Math.random()*l.length)][0];tempAvatar={color:COLORS[Math.floor(Math.random()*COLORS.length)][1],expr:pk(EXPR),face:pk(FACE.filter(([v])=>!(v==='glasses'&&!S.unlocked.glasses))),head:pk(HEAD.filter(([v])=>!(v==='beanie'&&S.finished.length<10))),prop:pk(PROP)};renderPanel();render();return}
 if(act==='sceneNext'){S.sceneShift=(S.sceneShift||0)+1;save();render();renderPanel();return}
 if(act==='bsearch'){runSearch();return}
 if(act==='bpick'){const it=(panelView.res||[])[+b.dataset.i];if(!it)return;Object.assign(panelView,{t:it.title,a:it.author,tp:it.pages||'',cover:it.cover,isbn:it.isbn,res:null,msg:''});renderPanel();return}
 if(act==='bclear'){Object.assign(panelView,{cover:'',isbn:'',res:null,msg:''});renderPanel();return}
 if(act==='goalDec'||act==='goalInc'){setGoal(calData().goal+(act==='goalInc'?1:-1));renderPanel();render();return}
 if(act==='calPrev'){panelView.calOff=(panelView.calOff||0)-1;renderPanel();return}
 if(act==='calNext'){panelView.calOff=Math.min(0,(panelView.calOff||0)+1);renderPanel();return}
 if(act==='cancelMirror'){closePanel();return}
 if(act==='saveMirror'){S.avatar={...tempAvatar};tempAvatar=null;save();panelOpen=null;closePanel();render();toast('새 모습을 저장했어요');return}
 if(act==='goVillage'){closePanel();openF('door');return}
 if(act==='alarm'){const n=S.news.find(x=>x.id===b.dataset.id);n.alarm=!n.alarm;save();
  if(n.alarm&&notifyState()==='ask')askNotify();
  render();renderPanel();if(n.alarm)toast(notifyState()==='off'||notifyState()==='none'?'브라우저 알림이 꺼져 있어요. 열려 있을 때 화면으로만 알려드려요':'개방되면 알려드릴게요');return}
 if(act==='askNotify'){askNotify();return}
 if(rcAct(act,b))return;
 if(act==='newRoom'){openV('fire:new');return}
 if(act==='joinLink'){joinByCode(document.getElementById('jl').value);return}
 if(act==='rkind'){panelView.nf.kind=b.dataset.v;renderPanel();return}
 if(act==='rstart'){panelView.nf.start=b.dataset.v;renderPanel();return}
 if(act==='rdays'){panelView.nf.days=+b.dataset.v;renderPanel();return}
 if(act==='rvis'){panelView.nf.vis=b.dataset.v;renderPanel();return}
 if(act==='rcreate'){createRoom();return}
 if(act==='copyLink'){const n=S.news.find(x=>x.id===b.dataset.id);if(n){copyLink(n);b.classList.add('done');b.innerHTML=ICON_CHECK;setTimeout(()=>{b.classList.remove('done');b.innerHTML=ICON_COPY},1500)}return}
 if(act==='shareLink'){const n=S.news.find(x=>x.id===b.dataset.id);if(n)navigator.share({title:'모닥불에 초대해요',text:n.title,url:inviteLink(n)}).catch(()=>{});return}
 if(act==='friendIn'){const n=S.news.find(x=>x.id===b.dataset.id);if(!n)return;if(n.people>=n.max){toast('정원이 가득 찼어요 ('+n.people+'/'+n.max+'명)');return}n.people++;n.members.push(NAMEPOOL.find(x=>!n.members.includes(x))||'@친구');save();if(VIEW==='shared'&&G3)G3.setView('shared',n);render();renderPanel();toast('친구가 들어왔어요 ('+n.people+'/'+n.max+'명)');return}
 if(act==='closeRoom'){const n=S.news.find(x=>x.id===b.dataset.id);if(!n)return;
  if(n.kind==='SOON'){S.news=S.news.filter(x=>x!==n);toast('모닥불을 취소했어요')}else{n.kind='CLOSED';n.closesAt=Date.now();n.deleteAt=Date.now()+7*DAY;toast('모닥불을 일찍 껐어요. 7일 뒤에 사라져요')}
  save();render();buildSr();closePanel();return}
 if(act==='openNow'){const n=S.news.find(x=>x.id===b.dataset.id);n.opensAt=Date.now();fireDue();return}
 if(act==='import'){const n=S.news.find(x=>x.id===b.dataset.id);if(rcEmpty(n)){toast('가져올 대화가 없어요');return}if(!n.book){toast('이 방에는 내 책이 정해지지 않아서 가져올 곳이 없어요');return}const rec={title:n.title,period:n.period,rtype:n.rtype,messages:rcSnapshot(n)};   // 다른 참여자는 익명, 삭제된 글은 뺀다
  // 내가 읽은 책(다 읽은 책·포기한 책·읽는 중)에 있으면 거기에 붙이고, 없으면 "나중에 읽을 책"에 담는다 (다 읽은 책으로 세지 않는다)
  let bk=S.finished.find(x=>x.title===n.book)||S.dropped.find(x=>x.title===n.book),msg='『'+n.book+'』에 공유방 탭이 생겼어요';
  if(!bk&&S.reading&&S.reading.title===n.book){bk=S.reading;if(!bk.rooms)bk.rooms=[];msg='『'+n.book+'』을 읽는 중이라, 다 읽으면 책장에 공유방 탭이 생겨요'}
  if(!bk){bk=S.later.find(x=>x.title===n.book);if(!bk){bk={id:Date.now(),title:n.book,author:n.author||'',cover:n.cover||'',isbn:n.isbn||'',addedAt:ymd(),notes:[],rooms:[]};S.later.push(bk);msg='『'+n.book+'』을 "나중에 읽을 책"에 담고 공유방 기록을 같이 넣었어요'}}
  if(!bk.rooms)bk.rooms=[];bk.rooms.push(rec);n.done=true;save();render();renderPanel();toast(msg);return}
};
panel.addEventListener('click',onPanelClick);document.getElementById('campModalPanel').addEventListener('click',onPanelClick);   // 모닥불 장면의 참여자·방 정보 모달도 같은 버튼 처리를 쓴다
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
const CAP=3*3600000,CHECK=3600000;
let pipWin=null;
function pipOK(){return 'documentPictureInPicture' in window}
function pipScene(on=true){return flat(()=>pipScene0(on))}
function pipScene0(on){
 const a=S.avatar,bc=S.reading?bookColor(S.reading.title):'#6d8f6b';
 let g=`<polygon points="${pts(Array.from({length:28},(_,j)=>{const t=j/28*Math.PI*2;return P(4.9+1.6*Math.cos(t),5.2+1.6*Math.sin(t),0)}))}" fill="#ffd46b" opacity="${on?.35:0}" style="transition:opacity .4s"/>`;
 g+=box(4,3.8,0,1.8,1.8,0.55,'#c9784c')+box(4,3.8,0.55,0.45,1.8,0.95,'#c9784c')+box(4.45,3.8,0.55,1.35,0.35,0.42,'#d48555')+box(4.45,4.15,0.55,1.3,1.1,0.18,'#e39a68');
 g+=G3?`<image href="${G3.snap(a,'pip')}" x="-42" y="48" width="104" height="104"/>`:'';
 g+=box(4.45,5.25,0.55,1.35,0.35,0.42,'#d48555');
 const [gx,gy]=P(4.43,6.23,2.55);
 g+=`<g id="plamp" style="cursor:pointer">${hull(4.0,5.8,0,0.9,0.9,3.3)}`+(on?`<ellipse cx="${gx}" cy="${gy}" rx="26" ry="12" fill="#ffe08a" opacity=".5"/>`:'')+box(4.25,6.05,0,0.36,0.36,0.08,'#6b5a48')+box(4.4,6.2,0.08,0.06,0.06,2.6,'#6b5a48')+box(4.15,5.95,2.6,0.56,0.56,0.55,on?'#ffd46b':'#e9dcc0')+`</g>`;
 return `<svg viewBox="-105 45 210 150" width="100%" style="display:block">${g}</svg>`;
}
async function openPip(){
 if(!pipOK()){toast('이 브라우저는 바탕화면 띄우기를 지원하지 않아요');return}
 if(pipWin){pipWin.focus();return}
 try{pipWin=await documentPictureInPicture.requestWindow({width:240,height:250})}
 catch(e){toast('이 화면에서는 띄울 수 없어요. 파일로 열어서 크롬에서 해보세요');return}
 const d=pipWin.document;
 d.title='읽는 중';
 d.body.innerHTML=`<style>body{margin:0;background:#efe9da;font-family:"Gowun Dodum",system-ui,sans-serif;color:#3b3226;display:flex;flex-direction:column;height:100vh}
 #plamp .hull{fill:transparent;stroke:transparent;stroke-width:3}#plamp:hover .hull{stroke:#fff6d8}#plamp:hover{filter:brightness(1.08)}
 .t{font-size:26px;text-align:center;letter-spacing:1px}.b{display:flex;gap:6px;padding:0 10px 10px}
 button{flex:1;font:inherit;border:0;border-radius:10px;padding:8px;background:#4f7a5a;color:#fff;cursor:pointer;font-size:15px}
 .s{font-size:12px;text-align:center;color:#8a7d6a;margin-top:-2px}</style>
 <div id="scene" style="flex:1;min-height:0">${pipScene()}</div>
 <div class="t" id="pt">${fmtHMS(elapsed())}</div><div class="s" id="ps">『${esc(S.reading?S.reading.title:'')}』</div>
 <div class="s" id="ph" style="margin:2px 0 10px">스탠드를 누르면 끝나요</div>`;
 d.getElementById('plamp').addEventListener('click',()=>{if(!(S.session&&S.session.status==='RUNNING'))return;
  const sc=d.getElementById('scene');if(sc)sc.innerHTML=pipScene(false);setTimeout(()=>endSession(Date.now(),'PIP'),450)});
 pipWin.addEventListener('pagehide',()=>{pipWin=null});
}
function pipDone(min){
 const w=pipWin;if(!w)return;const d=w.document;
 const t=d.getElementById('pt'),s=d.getElementById('ps'),h=d.getElementById('ph'),sc=d.getElementById('scene');
 if(sc)sc.innerHTML=pipScene(false);
 if(t)t.textContent=min>=1?min+'분 기록':'기록 안 함';if(s)s.textContent='스탠드를 껐어요';if(h)h.textContent='';
 setTimeout(()=>{try{w.close()}catch(e){}},1800);
}
function elapsed(){return S.session?Date.now()-S.session.startedAt:0}
function fmtHMS(ms){const t=Math.max(0,Math.floor(ms/1000));const h=Math.floor(t/3600),m=Math.floor(t%3600/60),x=t%60;return (h?h+':'+String(m).padStart(2,'0'):String(m).padStart(2,'0'))+':'+String(x).padStart(2,'0')}
function fmtClock(e){const d=new Date(e);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function fmtDay(e){const d=new Date(e);return (d.getMonth()+1)+'.'+String(d.getDate()).padStart(2,'0')}
function minOfBook(id){return S.sessions.filter(x=>x.bookId===id).reduce((a,x)=>a+x.minutes,0)}
const fmtMin=m=>m>=60?Math.floor(m/60)+'시간'+(m%60?' '+m%60+'분':''):m+'분';
function todayMin(){const k=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),t=k(Date.now());return S.sessions.filter(x=>k(x.endedAt||x.startedAt)===t).reduce((a,x)=>a+x.minutes,0)} // 달력과 같은 기준: 한국 시간, 종료일에 세션 전체를 센다
function startTimer(){
 if(!S.reading||S.session)return;
 const now=Date.now();S.session={id:now,bookId:S.reading.id,startedAt:now,lastCheckAt:now,status:'RUNNING'};save();
 panelView={};render();renderPanel();toast('스탠드를 켰어요. 읽기 시작!');
 if(notifyState()==='ask')askNotify();
 if(!isSit())walkTo(...TARGET.sofa,sitDown);
}
function endSession(end,by,quiet){
 if(S.session&&S.session.status==='NEEDS_CONFIRM'&&by!=='CONFIRM')end=S.session.lastCheckAt; // 확인 전에는 마지막으로 확인한 시각까지만 기록한다
 if(pipWin){const mm=S.session?Math.floor((end-S.session.startedAt)/60000):0;pipDone(mm);}
 const ses=S.session;if(!ses)return;const min=Math.floor((end-ses.startedAt)/60000);S.session=null;  // 1분 미만(59초까지)은 기록하지 않는다
 if(min<1){if(!quiet)toast('1분 미만은 기록하지 않아요')}
 else{S.sessions.push({id:ses.id,bookId:ses.bookId,startedAt:ses.startedAt,endedAt:end,minutes:min,source:'TIMER',endedBy:by});if(!quiet)toast(min+'분 읽었어요. 스탠드를 껐어요')}
 save();panelView={};render();renderPanel();
}
function checkSession(force){
 const ses=S.session;if(!ses)return;
 if(ses.status==='RUNNING'&&Date.now()-ses.startedAt>CAP){ses.status='NEEDS_CONFIRM';save();render();if(panelOpen==='lamp')renderPanel();return}
 if(force){render();if(panelOpen==='lamp'||!panelOpen)renderPanel()}
}
// 브라우저 알림: 이 페이지를 열어 둔 동안 온다. 창을 닫은 뒤에도 받으려면 서버 푸시가 필요하다 (DATA_API.md).
function notifyState(){if(!('Notification' in window))return 'none';return Notification.permission==='granted'?'on':Notification.permission==='denied'?'off':'ask'}
function askNotify(){if(!('Notification' in window))return Promise.resolve();return Promise.resolve(Notification.requestPermission()).then(()=>{if(panelOpen)renderPanel()})}
function notify(title,body,tag,onclick){
 if(notifyState()==='on'){try{const n=new Notification(title,{body,tag,icon:G3?G3.snap(S.avatar,'head'):undefined});n.onclick=()=>{window.focus();n.close();if(onclick)onclick()};return}catch(e){}}
 toast(title+' · '+body); // 알림을 못 보낼 때는 화면 안내로 대신한다
}
function notifyRow(){
 const st=notifyState();
 if(st==='ask')return `<div class="row" style="margin-top:8px"><span class="muted grow">60분마다 읽고 있는지 알림으로 물어봐요</span><button data-act="askNotify">알림 켜기</button></div>`;
 if(st==='on')return '<p class="muted">알림이 켜져 있어요. 60분마다 읽고 있는지 물어봐요. 이 페이지를 열어 둘 때 와요.</p>';
 if(st==='off')return '<p class="muted">브라우저에서 알림이 꺼져 있어요. 주소창 옆 자물쇠에서 알림을 허용해 주세요.</p>';
 return '<p class="muted">이 브라우저는 알림을 지원하지 않아요. 화면의 안내로만 알려드려요.</p>';
}
function fireDue(){
 const ses=S.session;
 if(ses){
  if(ses.status==='NEEDS_CONFIRM'&&!ses.notifiedConfirm){ses.notifiedConfirm=true;save();notify('확인이 필요해요',fmtClock(ses.startedAt)+'에 켠 스탠드가 아직 켜져 있어요. 언제까지 읽었는지 알려 주세요.','confirm',()=>openF('lamp'))}
  else if(ses.status==='RUNNING'&&Date.now()-ses.lastCheckAt>=CHECK&&ses.notifiedAt!==ses.lastCheckAt){ses.notifiedAt=ses.lastCheckAt;save();notify('아직 읽고 있어요?',(S.reading?'『'+S.reading.title+'』을 ':'')+'읽은 지 60분이 지났어요. 계속 읽고 있나요?','check')}
 }
 // 종료 후 7일이 지난 공유방은 사라진다 (가져온 기록은 내 서재에 남는다)
 // 내가 만든 모닥불은 기간이 끝나면 종료되고, 그때부터 7일 보관된다
 S.news.forEach(n=>{if(n.mine&&n.kind==='OPEN'&&n.closesAt&&Date.now()>=n.closesAt){n.kind='CLOSED';n.deleteAt=Date.now()+7*DAY;save();render();if(panelOpen&&panelOpen!=='plaza')renderPanel()}});
 const nb=S.news.length;S.news=S.news.filter(n=>!(n.kind==='CLOSED'&&n.deleteAt&&Date.now()>=n.deleteAt));
 if(S.news.length!==nb){save();render();buildSr();if(panelOpen&&panelOpen!=='plaza')renderPanel()}
 S.news.forEach(n=>{if(n.kind==='SOON'&&n.opensAt&&Date.now()>=n.opensAt){
  n.kind='OPEN';n.sub='지금 열렸어요';
  if(n.alarm&&!n.notified){n.notified=true;notify('이야기방이 열렸어요',n.title,'room-'+n.id,()=>openF('window'))}
  save();render();if(panelOpen==='window')renderPanel()}});
}
function renderNotice(){
 const n=document.getElementById('notice');const ses=S.session;
 if(ses&&ses.status==='NEEDS_CONFIRM'){n.style.display='flex';n.innerHTML=`<span>${fmtClock(ses.startedAt)}에 켠 스탠드가 아직 켜져 있어요</span><button data-n="confirm">확인하기</button>`}
 else if(ses&&Date.now()-ses.lastCheckAt>=CHECK){n.style.display='flex';n.innerHTML=`<span>아직 읽고 있어요? <small style="opacity:.7">(알림 예시)</small></span><button data-n="cont">계속</button><button data-n="stop">스탠드 끄기</button>`}
 else n.style.display='none';
}
document.getElementById('notice').addEventListener('click',e=>{const b=e.target.closest('[data-n]');if(!b)return;e.stopPropagation();
 if(b.dataset.n==='cont'){S.session.lastCheckAt=Date.now();save();render();toast('계속 기록할게요')}
 if(b.dataset.n==='stop'){openF('lamp');panelView={mode:'stop'};renderPanel()}
 if(b.dataset.n==='confirm'){openF('lamp')}
});
setInterval(()=>{if(!S.session)return;if(pipWin){const el=pipWin.document.getElementById('pt');if(el)el.textContent=fmtHMS(elapsed())}checkSession();if(S.session&&S.session.status==='RUNNING'){const t=fmtHMS(elapsed());const a=document.getElementById('lampTime');if(a)a.textContent=t;const big=document.getElementById('timerBig');if(big)big.textContent=t;const ht=document.getElementById('homeT');if(ht)ht.textContent=t;
 document.getElementById('hdrStats').textContent=hdrText(' · ⏱ '+t);
 const n=document.getElementById('notice');if(n.style.display==='none'&&Date.now()-S.session.lastCheckAt>=CHECK)renderNotice()}},1000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkSession(true)});
addEventListener('pageshow',e=>{if(e.persisted)checkSession(true)}); // 모바일 뒤로가기 캐시 복귀
setInterval(fireDue,5000);
render();renderPanel();entryFlash();checkSession(true);
// 초대 링크(#join=코드)로 열면 그 모닥불로 들어간다
(function(){const m=/#join=([A-Za-z0-9]+)/.exec(location.hash);if(m){history.replaceState(null,'',location.href.split('#')[0]);setTimeout(()=>joinByCode(m[1]),700)}})();
