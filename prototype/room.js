// 내 방 기능. 화면 문구는 각 *Panel(), 버튼 동작은 roomAction()에서 수정한다.
// 공유 상태 S·저장·모달은 app.js, 3D 모양은 scene.js를 함께 사용한다.

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
// ISBN-10이면 13자리로 바꾼다 (978 + 앞 9자리 + 검사 숫자). 올바른 ISBN이 아니면 빈 문자열
function toIsbn13(s){
 s=String(s).replace(/[-\s]/g,'').toUpperCase();
 if(/^97[89]\d{10}$/.test(s)){let t=0;for(let i=0;i<12;i++)t+=+s[i]*(i%2?3:1);return (10-t%10)%10===+s[12]?s:''}
 if(/^\d{9}[\dX]$/.test(s)&&[...s].reduce((t,c,i)=>t+(c==='X'?10:+c)*(10-i),0)%11===0){const b='978'+s.slice(0,9);let t=0;for(let i=0;i<12;i++)t+=+b[i]*(i%2?3:1);return b+(10-t%10)%10}
 return '';
}
async function searchBooks(q){
 q=q.trim();if(!q)return {err:'검색어를 적어 주세요'};

 let query=q,isbn='';
 if(/^https?:\/\//i.test(q)){const m=q.match(/97[89]\d{10}|(?<!\d)\d{9}[\dXx](?!\d)/);if(!m)return {err:'이 링크에서 책을 찾지 못했어요. 제목으로 찾아 보세요'};isbn=toIsbn13(m[0]);query='isbn:'+(isbn||m[0])}
 else if(/^[\dXx\s-]{10,17}$/.test(q)){isbn=toIsbn13(q);if(!isbn)return {err:'ISBN이 올바르지 않아요. 숫자 10자리 또는 13자리를 확인해 주세요'};query='isbn:'+isbn}
 // 서버 검색 주소를 넣으면 한국 책은 국립중앙도서관(백엔드 GET /books/search)에서 먼저 찾고, 실패하면 아래 구글 북스·Open Library로 넘어간다
 if(BOOK_SEARCH_URL){try{const res=await fetch(BOOK_SEARCH_URL+'?q='+encodeURIComponent(q));
  if(res.status===400)return {err:(await res.json()).message};
  if(res.ok)return {items:(await res.json()).map(x=>({title:x.title,author:x.author||'',pages:x.totalPages||0,isbn:x.isbn||'',cover:x.coverUrl||''}))}}catch(e){}}
 const get=async url=>{const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),7000);try{const res=await fetch(url,{signal:ctl.signal});if(!res.ok)throw new Error('http '+res.status);return await res.json()}finally{clearTimeout(tm)}};
 // 1순위: 구글 북스 (키 없이 쓰면 공용 한도가 금방 차서 자주 실패한다. BOOK_API_KEY에 키를 넣으면 안정적)
 const viaGoogle=async()=>{const j=await get('https://www.googleapis.com/books/v1/volumes?maxResults=6&printType=books&q='+encodeURIComponent(query)+(BOOK_API_KEY?'&key='+BOOK_API_KEY:''));
  return (j.items||[]).map(it=>{const v=it.volumeInfo||{},ids=v.industryIdentifiers||[];
   return {title:v.title||'',author:(v.authors||[]).join(', '),pages:v.pageCount||0,isbn:(ids.find(x=>x.type==='ISBN_13')||ids[0]||{}).identifier||'',cover:((v.imageLinks||{}).thumbnail||'').replace(/^http:/,'https:').replace('&edge=curl','')}}).filter(x=>x.title)};
 // 2순위: Open Library (키 없음. ISBN으로는 잘 찾고, 한국어 제목 검색은 약하다)
 const viaOpenLibrary=async()=>{const j=await get('https://openlibrary.org/search.json?limit=6&fields=title,author_name,number_of_pages_median,isbn,cover_i&q='+encodeURIComponent(query));
  return (j.docs||[]).map(d=>({title:d.title||'',author:(d.author_name||[]).join(', '),pages:d.number_of_pages_median||0,isbn:(d.isbn||[]).find(x=>x.length===13)||(d.isbn||[])[0]||'',cover:d.cover_i?'https://covers.openlibrary.org/b/id/'+d.cover_i+'-M.jpg':''})).filter(x=>x.title)};
 // ISBN으로 찾을 때는 Open Library의 정확한 ISBN 조회를 쓴다(검색 API는 다른 판을 섞어 준다)
 const viaOpenLibraryIsbn=async()=>{const j=await get('https://openlibrary.org/api/books?format=json&jscmd=data&bibkeys=ISBN:'+isbn),d=j['ISBN:'+isbn];
  return d&&d.title?[{title:d.title,author:(d.authors||[]).map(a=>a.name).join(', '),pages:d.number_of_pages||0,isbn,cover:(d.cover||{}).medium||''}]:[]};
 let items=[],failed=0;
 const sources=isbn?[async()=>(await viaGoogle()).map(x=>({...x,isbn})),viaOpenLibraryIsbn]:[viaGoogle,viaOpenLibrary];
 for(const f of sources){try{items=await f();if(items.length)break}catch(e){failed++}}
 if(items.length)return {items};
 if(failed>=2)return {err:navigator.onLine?'책 정보를 가져오지 못했어요. 아래에 직접 적어 주세요':'인터넷에 연결되어 있지 않아요. 아래에 직접 적어 주세요'};
 return {items:[]};
}
// 백엔드 책 검색 주소. 주소 끝에 ?searchApi=http://localhost:8080/books/search 를 붙여 한 번 열면 저장된다(지우려면 ?searchApi=). 비어 있으면 서버 없이 구글 북스·Open Library만 쓴다
const BOOK_SEARCH_URL=(()=>{try{const q=new URLSearchParams(location.search);if(q.has('searchApi')){const v=q.get('searchApi');v?localStorage.setItem('rr-search-url',v):localStorage.removeItem('rr-search-url')}return localStorage.getItem('rr-search-url')||''}catch(e){return ''}})();
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
  <div class="row bsearch"><input id="bq" placeholder="책 제목이나 저자를 적어 주세요" value="${esc(pv.q||'')}"><button class="ibtn" data-act="bsearch" aria-label="책 찾기" title="찾기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg></button></div>
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
 return head('책장')+incomingGiftHtml()+`<div class="tabs"><button data-act="list" data-t="done" class="${!showDrop&&!showLater?'on':''}">다 읽은 책 ${S.finished.length}</button><button data-act="list" data-t="drop" class="${showDrop?'on':''}">포기한 책 ${S.dropped.length}</button><button data-act="list" data-t="later" class="${showLater?'on':''}">나중에 읽을 책 ${S.later.length}</button></div>
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


// ===== 입력칸: 제목·저자·쪽수·메모·목표 =====
function bindRoomEvents(){
 panel.addEventListener('change',e=>{
 if(e.target.id==='goal'){const s=e.target.value;if(s!=='')setGoal(+s);save();renderPanel();render()} // 칸을 벗어나면 1~99로 맞춰 화면과 저장값을 일치시킨다
 });
 panel.addEventListener('input',e=>{
 if(e.target.id==='goal'){let v=Math.round(+e.target.value);if(!(v>=1))return;v=Math.min(99,v);if(v!==+e.target.value)e.target.value=v;setGoal(v);
  const c=calData(),bar=document.getElementById('goalBar'),st=document.getElementById('goalStat'),nt=document.getElementById('goalNote');
  if(bar)bar.style.width=Math.min(100,Math.round(c.done/c.goal*100))+'%';if(st)st.textContent=goalStatText(c);if(nt)nt.textContent=goalNoteText(c);render()}
 if(e.target.id==='pg'||e.target.id==='tp'){const r=S.reading,pg=document.getElementById('pg').value,tp=document.getElementById('tp').value;
  r.page=pg===''?null:Math.max(0,Math.round(+pg));r.totalPages=Math.round(+tp)>=1?Math.min(9999,Math.round(+tp)):null;updProgress(r);save();
  document.getElementById('pv').textContent=r.totalPages?r.progress+'%':'';const bar=panel.querySelector('.card .progress i');if(bar)bar.style.width=(r.progress||0)+'%';
  document.getElementById('pgHint').textContent=pgHint(r);render()}
 if(e.target.id==='bq'){panelView.q=e.target.value}
 if(e.target.id==='btp'){panelView.tp=e.target.value}
 if(e.target.id==='nc'){panelView.draft=e.target.value;document.getElementById('ncE').textContent=''}
 if(e.target.id==='bt'){panelView.t=e.target.value;document.getElementById('btE').textContent=''}
 if(e.target.id==='ba'){panelView.a=e.target.value;document.getElementById('baE').textContent=''}
 if(e.target.id==='rv'){panelView.review=e.target.value}
 if(e.target.id==='sp'||e.target.id==='stp'){const r=S.reading,sp=document.getElementById('sp'),stp=document.getElementById('stp'),tot=r.totalPages||(stp&&Math.max(0,Math.min(9999,+stp.value)))||0,pgv=sp.value===''?null:+sp.value;
  document.getElementById('spv').textContent=tot&&pgv!=null?Math.min(100,Math.max(0,Math.round(pgv/tot*100)))+'%':''}
 if(e.target.id==='sm'){panelView.memo=e.target.value}
 });
 panel.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='bq'){e.preventDefault();runSearch()}});
}

// ===== 버튼 동작: 소파·스탠드·책장·거울·달력 =====
function roomAction(act,b){
 if(act==='addBook'){const t=(panelView.t||'').trim(),a=(panelView.a||'').trim();let bad=false;
  if(!t){document.getElementById('btE').textContent='제목을 입력해 주세요';bad=true}
  if(!a){document.getElementById('baE').textContent='저자를 입력해 주세요';bad=true}
  if(bad)return true;
  const tp=Math.round(+panelView.tp)>=1?Math.min(9999,Math.round(+panelView.tp)):null;  // 전체 쪽수: 빈 값 또는 1~9999
  const li=S.later.findIndex(x=>x.title===t),lrooms=li>=0?S.later.splice(li,1)[0].rooms:[]; // 나중에 읽을 책에 있던 책이면 목록에서 빼고 공유방 기록을 이어 받는다
  S.reading={id:Date.now(),title:t,author:a,cover:panelView.cover||'',isbn:panelView.isbn||'',totalPages:tp,page:0,progress:0,notes:[],rooms:lrooms,startedAt:today()};panelView={};
  const wasOb=S.onboard===1;if(wasOb)S.onboard=2;save();render();renderPanel();toast('소파에 『'+t+'』을 올렸어요');return true}
 if(act==='laterToSofa'){const i=S.later.findIndex(x=>x.id===+b.dataset.id);if(i<0)return true;   // 나중에 읽을 책을 책장에서 바로 소파에 올린다. 공유방 기록이 따라온다
  if(S.reading){toast('소파에 이미 읽는 책이 있어요. 먼저 완독하거나 포기해 주세요');return true}
  const lb=S.later.splice(i,1)[0];S.reading={id:Date.now(),title:lb.title,author:lb.author||'',cover:lb.cover||'',isbn:lb.isbn||'',totalPages:lb.totalPages||null,page:0,progress:0,notes:[],rooms:lb.rooms||[],startedAt:today()};
  save();closePanel();render();toast('소파에 『'+lb.title+'』을 올렸어요. 공유방 기록이 따라왔어요');return true}
 if(act==='type'){panelView.type=b.dataset.t;renderPanel();return true}
 if(act==='addNote'){const c=(panelView.draft||'').trim();if(!c){document.getElementById('ncE').textContent='내용을 입력해 주세요';return true}
  const pg=Math.max(0,Math.round(+document.getElementById('np').value))||null,rd=S.reading;rd.notes.push({type:panelView.type||'MEMO',content:c,page:pg,at:today()});panelView.draft='';
  if(pg&&(rd.page==null||pg>rd.page)){rd.page=pg;updProgress(rd);toast(pg+'쪽까지 읽은 걸로 기록했어요'+(rd.totalPages?' ('+rd.progress+'%)':''))}
  save();render();renderPanel();return true}
 if(act==='delNote'){S.reading.notes.splice(+b.dataset.i,1);save();renderPanel();return true}
 if(act==='finish'){panelView.mode='finish';renderPanel();return true}
 if(act==='drop'){panelView.mode='drop';renderPanel();return true}
 if(act==='cancelFinish'){panelView.mode=null;renderPanel();return true}
 if(act==='star'){panelView.rating=+b.dataset.n===panelView.rating?0:+b.dataset.n;renderPanel();return true}
 if(act==='doFinish'){if(S.session&&S.session.status==='NEEDS_CONFIRM'){openF('lamp');toast('먼저 스탠드 시간을 확인해 주세요');return true}const rating=panelView.rating||0,review=(panelView.review||'').trim();   // endSession()이 panelView를 비우기 전에 별점·한줄평을 챙긴다 (Codex QA)
 if(S.session)endSession(Date.now(),'FINISH',true);const r=S.reading;const id=r.id||Date.now();S.finished.push({id,title:r.title,author:r.author,cover:r.cover||'',isbn:r.isbn||'',totalPages:r.totalPages||null,rating,review,finishedAt:ymd(),notes:r.notes,rooms:r.rooms||[]});
  S.reading=null;panelView={};save();closePanel();render();if(G3)G3.flash('shelf');toast('『'+r.title+'』을 책장에 꽂았어요');return true}
 if(act==='doDrop'){if(S.session&&S.session.status==='NEEDS_CONFIRM'){openF('lamp');toast('먼저 스탠드 시간을 확인해 주세요');return true}if(S.session)endSession(Date.now(),'FINISH',true);const r=S.reading;S.dropped.push({id:r.id||Date.now(),title:r.title,author:r.author,cover:r.cover||'',isbn:r.isbn||'',totalPages:r.totalPages||null,rating:0,review:'',finishedAt:ymd(),notes:r.notes,rooms:r.rooms||[]});S.reading=null;panelView={};save();closePanel();render();toast('소파를 비웠어요');return true}
 if(act==='goSofa'){openF('sofa');return true}
 if(act==='startTimer'){startTimer();return true}
 if(act==='pip'){openPip();return true}
 if(act==='stopAsk'){panelView={mode:'stop'};renderPanel();return true}
 if(act==='back2'){panelView={};renderPanel();return true}
 if(act==='stopSave'){const r=S.reading,sp=document.getElementById('sp'),stp=document.getElementById('stp');
  if(stp&&stp.value){const tp=Math.round(+stp.value);r.totalPages=tp>=1?Math.min(9999,tp):null}   // 소파 입력과 같은 규칙: 1~9999, 아니면 비움 (#36)
  if(sp&&sp.value!=='')r.page=Math.max(0,Math.round(+sp.value));updProgress(r);const m=(panelView.memo||'').trim();if(m)r.notes.push({type:'MEMO',content:m,page:null,at:today()});endSession(Date.now(),'LAMP');return true}
 if(act==='discard'){if(pipWin)pipDone(0);S.session=null;save();panelView={};render();renderPanel();toast('기록하지 않고 스탠드를 껐어요');return true}
 if(act==='ff'){const ms=+b.dataset.m*60000;S.session.startedAt-=ms;S.session.lastCheckAt-=ms;if(+b.dataset.m>=180)S.session.lastCheckAt=S.session.startedAt+70*60000;save();checkSession(true);return true}
 if(act==='confirmLast'){endSession(S.session.lastCheckAt,'CONFIRM');return true}
 if(act==='confirmHour'){endSession(S.session.startedAt+3600000,'CONFIRM');return true}
 if(act==='cmanual'){panelView={mode:'cmanual'};renderPanel();return true}
 if(act==='confirmManual'){const m=Math.round(+document.getElementById('cm').value);if(!(m>=1&&m<=600&&m*60000<=Date.now()-S.session.startedAt)){document.getElementById('cmE').textContent='1~600분 사이, 켠 뒤 지난 시간 안으로 입력해 주세요';return true}endSession(S.session.startedAt+m*60000,'CONFIRM');return true}
 if(act==='manual'){panelView={mode:'manual',day:0};renderPanel();return true}
 if(act==='mday'){panelView.day=+b.dataset.d;renderPanel();return true}
 if(act==='manualSave'){const m=Math.round(+document.getElementById('mm').value);if(!(m>=1&&m<=600)){document.getElementById('mmE').textContent='1~600분 사이로 입력해 주세요';return true}
  const d=new Date();d.setDate(d.getDate()-(panelView.day||0));d.setHours(12,0,0,0);S.sessions.push({id:Date.now(),bookId:S.reading.id,startedAt:d.getTime(),endedAt:d.getTime()+m*60000,minutes:m,source:'MANUAL',endedBy:'MANUAL'});save();panelView={};render();renderPanel();toast(m+'분을 기록했어요');return true}
 if(act==='list'){panelView={list:b.dataset.t};renderPanel();return true}
 if(act==='openBook'){panelView={book:+b.dataset.id,drop:b.dataset.drop==='1',list:panelView.list};renderPanel();return true}
 if(act==='back'){panelView={list:panelView.list};renderPanel();return true}
 if(act==='tab'){panelView.tab=b.dataset.t;renderPanel();return true}
 if(act==='av'){if(b.disabled)return true;tempAvatar[b.dataset.k]=b.dataset.v;renderPanel();render();return true}
 if(act==='shuffle'){const pk=l=>l[Math.floor(Math.random()*l.length)][0];tempAvatar={color:COLORS[Math.floor(Math.random()*COLORS.length)][1],expr:pk(EXPR),face:pk(FACE.filter(([v])=>!(v==='glasses'&&!S.unlocked.glasses))),head:pk(HEAD.filter(([v])=>!(v==='beanie'&&S.finished.length<10))),prop:pk(PROP)};renderPanel();render();return true}
 if(act==='sceneNext'){S.sceneShift=(S.sceneShift||0)+1;save();render();renderPanel();return true}
 if(act==='bsearch'){runSearch();return true}
 if(act==='bpick'){const it=(panelView.res||[])[+b.dataset.i];if(!it)return true;Object.assign(panelView,{t:it.title,a:it.author,tp:it.pages||'',cover:it.cover,isbn:it.isbn,res:null,msg:''});renderPanel();return true}
 if(act==='bclear'){Object.assign(panelView,{cover:'',isbn:'',res:null,msg:''});renderPanel();return true}
 if(act==='goalDec'||act==='goalInc'){setGoal(calData().goal+(act==='goalInc'?1:-1));renderPanel();render();return true}
 if(act==='calPrev'){panelView.calOff=(panelView.calOff||0)-1;renderPanel();return true}
 if(act==='calNext'){panelView.calOff=Math.min(0,(panelView.calOff||0)+1);renderPanel();return true}
 if(act==='cancelMirror'){closePanel();return true}
 if(act==='saveMirror'){S.avatar={...tempAvatar};tempAvatar=null;save();panelOpen=null;closePanel();render();toast('새 모습을 저장했어요');return true}
 return false;
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

function notifyRow(){
 const st=notifyState();
 if(st==='ask')return `<div class="row" style="margin-top:8px"><span class="muted grow">60분마다 읽고 있는지 알림으로 물어봐요</span><button data-act="askNotify">알림 켜기</button></div>`;
 if(st==='on')return '<p class="muted">알림이 켜져 있어요. 60분마다 읽고 있는지 물어봐요. 이 페이지를 열어 둘 때 와요.</p>';
 if(st==='off')return '<p class="muted">브라우저에서 알림이 꺼져 있어요. 주소창 옆 자물쇠에서 알림을 허용해 주세요.</p>';
 return '<p class="muted">이 브라우저는 알림을 지원하지 않아요. 화면의 안내로만 알려드려요.</p>';
}

function renderNotice(){
 const n=document.getElementById('notice');const ses=S.session;
 if(ses&&ses.status==='NEEDS_CONFIRM'){n.style.display='flex';n.innerHTML=`<span>${fmtClock(ses.startedAt)}에 켠 스탠드가 아직 켜져 있어요</span><button data-n="confirm">확인하기</button>`}
 else if(ses&&Date.now()-ses.lastCheckAt>=CHECK){n.style.display='flex';n.innerHTML=`<span>아직 읽고 있어요? <small style="opacity:.7">(알림 예시)</small></span><button data-n="cont">계속</button><button data-n="stop">스탠드 끄기</button>`}
 else n.style.display='none';
}

function bindRoomTimer(){
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
}
