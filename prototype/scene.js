// 방·마을·공유방의 3D와 캐릭터. app.js에서 createScene()을 한 번 호출한다.
/* ===== 3D: 원목 방 + 유령 (three.js) ===== */
function createScene(){
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
  matsDirty=true;dimKey=extraKey=shelfKey=mirrorKey=calKey=winKey='';shelfGift=null;giftKey='';giftMotion=0;
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
 let shelfGift=null,giftKey='',giftMotion=0;
 function animateGift(){giftMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:performance.now()+900}
 function rebuildBooks(titles){
  clear(shelfBooks);let i=0;
  const layout=LAY[MQ.matches?'tall':'wide'];
  [3.3,2.2,1.1,0].forEach(z=>{for(let k=0;k<layout.K;k++){const t=titles[i];if(t){const y=.75+k*.42,h=.66+((t.length*7)%5)*.06;shelfBooks.add(mesh(new THREE.BoxGeometry(.6,h,.32),mat(bookColor(t),.85),[.48,z+.12+h/2,y+.16]))}i++}});
 }
 function sync(c){
  const gk=JSON.stringify(c.gift||null);
  if(gk!==giftKey||!shelfGift){
   giftKey=gk;if(shelfGift){FG.shelf.remove(shelfGift);dispose(shelfGift)}
   shelfGift=new THREE.Group();FG.shelf.add(shelfGift);
   if(c.gift)shelfGift.add(mesh(new THREE.BoxGeometry(.6,.72,.32),mat(bookColor(c.gift.book.title),.85),[.48,.5,LAY[MQ.matches?'tall':'wide'].shelfEnd-.45]));
  }
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
  NEIGHBORS.forEach(n=>{house('neighbor:'+n.id,...n.house,false);const [x,z,w,d,h]=n.house;addLabel(esc(n.name)+'의 집',x+w/2,h*1.7+.35,z+d/2)});
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
  vilPick=vilPick.filter(k=>!k.userData.fire);Object.keys(vilMats).forEach(k=>{if(k.startsWith('room:')||k==='fire:new')delete vilMats[k]});   // 이전 모닥불의 클릭 영역·재질이 남으면 새 모닥불 자리를 눌러도 옛 방이 열린다
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
  function vhull(g,x,y,z,w,dp,h,f){const k=new THREE.Mesh(new THREE.BoxGeometry(w,h,dp),new THREE.MeshBasicMaterial({visible:false}));k.position.set(x+w/2,z+h/2,y+dp/2);k.userData={f,hull:true,fire:true};g.add(k);vilPick.push(k)}
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
   campGuests.push({M:g,x,z,rot:Math.atan2(-x,-z),ph:i*.7});addLabel(esc(name.startsWith('@')?name:'@'+name)+esc(rcBookTag(n,name.replace(/^@/,''))),x,2.45,z);
  });
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2,rad=5.3+(i%3)*.6,x=Math.cos(a)*rad,z=Math.sin(a)*rad;
   if(x+z>1)continue;
   const trunk=mesh(new THREE.CylinderGeometry(.13,.18,1.3,8),mat('#443e34',.9),[x,.62,z]);campG.add(trunk);
   campG.add(mesh(new THREE.ConeGeometry(.9,2.3,8),mat(i%2?'#315344':'#42644d',.9),[x,2,z]));
  }
 }
 function setView(v,n){
  view=v;camFree=false;panP=null;if(roomG)roomG.visible=v==='room'||v==='neighbor';
  if(roomG)roomG.children.forEach(g=>g.visible=v!=='neighbor'||g===FG.shelf);
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
  else if(view==='neighbor'){vh=Math.max(6.4,5.6/a);T.set(1.2,1.9,1.8)}   // 책장과 내 캐릭터만 가운데 크게, 방문 중에는 고정 구도
  else{const {X,Y}=L,Wn=(X+Y)*.7071+1.0,Hn=(X+Y)*.354+6.2;vh=Math.max(Hn,Wn/a);T.set(X/2,2.1,Y/2)}
  cam.left=-vh*a/2;cam.right=vh*a/2;cam.top=vh/2;cam.bottom=-vh/2;cam.updateProjectionMatrix();
  cam.position.copy(T).addScaledVector(dirV,40);cam.lookAt(T);cam.updateMatrixWorld();
  sun.position.set(T.x+9,14,T.z+6);sun.target.position.set(T.x,0,T.z);
 }
 function relayout(){buildRoom();fit()}
 const rc=new THREE.Raycaster(),nd=new THREE.Vector2();
 function pick(ev){
  const r=cv.getBoundingClientRect();nd.set((ev.clientX-r.left)/r.width*2-1,-((ev.clientY-r.top)/r.height*2-1));rc.setFromCamera(nd,cam);
  const h=rc.intersectObjects(view==='neighbor'?pickables.filter(o=>o.userData.f==='shelf'):view==='room'?pickables:view==='village'?vilPick:[],false);if(!h.length)return null;
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
  if(shelfGift){const k=giftMotion?Math.max(0,Math.min(1,(giftMotion-now)/900)):0;shelfGift.position.x=1.6*k*k;shelfGift.position.y=.2*Math.sin(k*Math.PI);if(!k)giftMotion=0}
  if(view==='village'){ // 따라가는 카메라: 유령 위치로 부드럽게 이동
   if(!camFree){const k=Math.min(1,dt*5);T.x+=(M.root.position.x-T.x)*k;T.z+=(M.root.position.z-T.z)*k}
   cam.position.copy(T).addScaledVector(dirV,40);cam.lookAt(T);sun.position.set(T.x+9,14,T.z+6);sun.target.position.set(T.x,0,T.z);
  }
  for(const f in flashUntil){const left=flashUntil[f]-now;if(left>0){const k=.28*Math.abs(Math.sin(left/90));matsOf[f].forEach(m=>{if(m.emissive&&!m.userData.keepEmis)m.emissive.setRGB(k,k*.9,k*.5)})}else{delete flashUntil[f];emis(f,f===hoverF)}}
  place(el('nameTag'),M.root.position.x,M.root.position.y+2.5,M.root.position.z);
  if(view==='room'){
   if(el('giftMark').style.display!=='none')place(el('giftMark'),.6,1.1,L.shelfEnd-.45);
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
 return {sync,pick,setHover,flash,relayout,snap,fit,setView,say,panStart,panMove,panEnd,follow,animateGift,houses:()=>vilHouses,npcs:()=>vilNpcs.map(n=>[n.x,n.z]),winImg:()=>winCv.toDataURL()};
}
