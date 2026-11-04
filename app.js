
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var DAY=864e5,HR=36e5,MIN=6e4;
var KEY='studyspace.v1';

/* ---------- helpers ---------- */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fmtDate(ts){return new Date(ts).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function toLocalInput(ts){var d=new Date(ts-new Date(ts).getTimezoneOffset()*MIN);return d.toISOString().slice(0,16)}
function rel(ms){var a=Math.abs(ms),d=Math.floor(a/DAY),h=Math.floor(a%DAY/HR),m=Math.floor(a%HR/MIN),s=Math.floor(a%MIN/1000);
  if(d>=1)return d+'d '+h+'h'; if(h>=1)return h+'h '+m+'m'; if(m>=1)return m+'m '+String(s).padStart(2,'0')+'s'; return s+'s'}
function cdText(ms){return ms>=0?'in '+rel(ms):rel(ms)+' ago'}
function size(b){return b>1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB'}
function hashPw(s){var h=5381;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return 'x'+(h>>>0).toString(36)}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
var IC={
 bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 sound:'<path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7"/>',
 mute:'<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/>',
 trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4"/>',
 leaf:'<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c3-4 6-7 10-9"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
 trash:'<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
 out:'<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>'
};
function ic(n,s){s=s||18;return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[n]+'</svg>'}

/* ---------- rewards ---------- */
var TIERS={
 immortal:{n:'Mythical Immortal',c:'#E2A21A',d:'First 3 students to finish tasks'},
 honor:{n:'Mythical Honor',c:'#D9534F',d:'Next 3 students'},
 mythic:{n:'Mythic',c:'#16A39F',d:'Next 3 students'},
 legend:{n:'Legend',c:'#4F8BD6',d:'Next 3 students'},
 elite:{n:'Elite',c:'#6BAE57',d:'All remaining students who have started or finished tasks'},
 warrior:{n:'Warrior',c:'#8A9690',d:'Students who have not started or finished any task'}
};
var STAGES=['Seed','Sprout','Seedling','Sapling','Budding','Blooming','Flourishing','Golden Bloom'];
function calcXP(t,at){
  if(t.type==='personal')return {base:5,bonus:0,xp:5,late:false};
  var late=at>t.due,base=late?5:10,bonus=0;
  if(!late)bonus=5+Math.min(10,Math.floor((t.due-at)/(12*HR)));
  return {base:base,bonus:bonus,xp:base+bonus,late:late};
}

/* ---------- state ---------- */
var S,ui={tab:'tasks',filter:'open',itab:'dashboard',modal:null,alerts:[],sound:true,authTab:'in',err:'',confirmDel:null,gOpen:false};
function load(){try{var j=localStorage.getItem(KEY);return j?JSON.parse(j):null}catch(e){return null}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

function seed(){
  var now=Date.now(),r=rng(11),pw=hashPw('demo1234');
  var users=[
    {id:'i1',name:'Prof. Elena Marquez',email:'instructor@studyspace.demo',role:'instructor',pw:pw},
    {id:'s0',name:'Mika Santos',email:'student@studyspace.demo',role:'student',pw:pw}
  ];
  ['Jordan Reyes','Aiko Tanaka','Liam Okafor','Sofia Duarte','Noah Lindqvist','Priya Nair','Mateo Cruz','Hana Kim','Ethan Brooks','Zara Ahmed','Lucas Moreau','Chloe Bennett','Omar Haddad','Isla Fraser'].forEach(function(n,i){
    users.push({id:'s'+(i+1),name:n,email:n.toLowerCase().replace(/[^a-z]+/g,'.')+'@studyspace.demo',role:'student',pw:pw});
  });
  function mk(id,type,title,course,desc,off,max,files){return {id:id,type:type,title:title,course:course,desc:desc,due:now+off,max:max,files:files||[],owner:'i1',created:now-7*DAY}}
  var tasks=[
    mk('t1','assignment','Subnetting worksheet','Computer Networks','Subnet the 192.168.10.0/24 block into 6 subnets. For each one, list the network address, broadcast address, and usable host range.',5*HR,50,[{name:'subnetting-worksheet.pdf',size:182000}]),
    mk('t2','quiz','Quiz 3: Normalization','Database Systems','Covers 1NF through BCNF. Closed notes, 20 minutes.',DAY+3*HR,30),
    mk('t3','activity','Wireframe a landing page','Web Development','Sketch mobile and desktop wireframes for a student-club landing page. Submit a PDF or image.',2*DAY+2*HR,20,[{name:'wireframe-brief.docx',size:64000}]),
    mk('t4','assignment','ER diagram: library system','Database Systems','Model books, members, loans, and fines. Include cardinalities and keys.',4*DAY,40),
    mk('t5','quiz','Quiz 4: Routing protocols','Computer Networks','Static routes, RIP, and OSPF basics.',6*DAY+4*HR,25),
    mk('t6','assignment','Packet Tracer lab 2','Computer Networks','Configure VLANs on the provided topology and submit the .pkt file.',-DAY-2*HR,60,[{name:'lab2-topology.pkt',size:420000}]),
    mk('t7','activity','Intro reflection','Web Development','Write 200 words about what you hope to build this term.',-5*DAY,10)
  ];
  tasks.push({id:'p1',type:'personal',title:'Review chapter 5 notes',course:'Personal',desc:'Skim the highlights and redo the practice problems.',due:now+DAY+8*HR,max:0,files:[],owner:'s0',done:false});
  var order=['t7','t6','t1','t3','t2','t4','t5'];
  var counts={s1:7,s2:6,s3:6,s4:5,s5:5,s6:4,s7:4,s8:3,s9:3,s10:2,s11:2,s12:1};
  var subs={};
  tasks.forEach(function(t){subs[t.id]={}});
  Object.keys(counts).forEach(function(sid){
    order.slice(0,counts[sid]).forEach(function(tid){
      var t=tasks.filter(function(x){return x.id===tid})[0];
      var past=t.due<now,at;
      if(past)at=r()<.18?t.due+3*HR:t.due-Math.round(r()*3*DAY)-HR;
      else at=Math.min(now-Math.round(r()*2*DAY)-HR,t.due-HR);
      var x=calcXP(t,at);
      subs[tid][sid]={status:'done',completedAt:at,files:[],note:'',late:x.late,xp:x.xp,base:x.base,bonus:x.bonus,
        score:(past&&r()<.8)?Math.round(t.max*(.7+r()*.3)):null};
    });
  });
  var t7=tasks[6],at7=t7.due-DAY,x7=calcXP(t7,at7);
  subs.t7.s0={status:'done',completedAt:at7,files:[{name:'reflection.docx',size:21000}],note:'',late:false,xp:x7.xp,base:x7.base,bonus:x7.bonus,score:8};
  subs.t1.s13={status:'progress',completedAt:null,files:[],note:'',late:false,xp:0,score:null};
  return {users:users,tasks:tasks,subs:subs,session:null,notifs:[],seen:{}};
}

/* ---------- selectors ---------- */
function me(){return S.users.filter(function(u){return u.id===S.session})[0]||null}
function taskById(id){return S.tasks.filter(function(t){return t.id===id})[0]}
function getSub(tid,sid){return (S.subs[tid]&&S.subs[tid][sid])||null}
function myTasks(){var u=me();return S.tasks.filter(function(t){return t.type!=='personal'||t.owner===u.id})}
function statusOf(t,sid){
  if(t.type==='personal')return t.done?'done':'todo';
  var s=getSub(t.id,sid);return s?s.status:'todo';
}
function isDone(t,sid){return statusOf(t,sid)==='done'}
function students(){return S.users.filter(function(u){return u.role==='student'})}
function assigned(){return S.tasks.filter(function(t){return t.type!=='personal'})}
function plantOf(sid){
  var done=0,xp=0;
  assigned().forEach(function(t){var s=getSub(t.id,sid);if(s&&s.status==='done'){done++;xp+=s.xp||0}});
  S.tasks.forEach(function(t){if(t.type==='personal'&&t.owner===sid&&t.done){done++;xp+=5}});
  return {count:done,xp:xp,level:Math.floor(done/3),prog:done%3};
}
function standings(){
  var rows=students().map(function(u){
    var done=0,started=0,xp=0,last=0;
    assigned().forEach(function(t){var s=getSub(t.id,u.id);if(!s)return;
      if(s.status==='done'){done++;xp+=s.xp||0;last=Math.max(last,s.completedAt||0)}else if(s.status==='progress')started++});
    return {u:u,done:done,started:started,xp:xp,last:last};
  });
  var fin=rows.filter(function(r){return r.done>0}).sort(function(a,b){return b.xp-a.xp||a.last-b.last});
  var mid=rows.filter(function(r){return r.done===0&&r.started>0});
  var low=rows.filter(function(r){return r.done===0&&r.started===0});
  var keys=['immortal','honor','mythic','legend'];
  fin.forEach(function(r,i){r.pos=i+1;r.tier=i<12?keys[Math.floor(i/3)]:'elite'});
  mid.forEach(function(r){r.pos=null;r.tier='elite'});
  low.forEach(function(r){r.pos=null;r.tier='warrior'});
  return fin.concat(mid,low);
}

/* ---------- sound + reminders ---------- */
var ac=null;
function unlockAudio(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume()}catch(e){}}
function beep(){
  if(!ui.sound)return;
  try{unlockAudio();if(!ac)return;var t0=ac.currentTime+.02;
    [0,.2,.4,.95,1.15,1.35].forEach(function(d,i){
      var o=ac.createOscillator(),g=ac.createGain();o.type='triangle';
      o.frequency.value=[784,988,1175][i%3];
      g.gain.setValueAtTime(0,t0+d);g.gain.linearRampToValueAtTime(.2,t0+d+.02);g.gain.exponentialRampToValueAtTime(.001,t0+d+.18);
      o.connect(g);g.connect(ac.destination);o.start(t0+d);o.stop(t0+d+.2);
    });
  }catch(e){}
}
function reminderText(left){
  if(left>HR)return 'Due in '+rel(left)+'. Plan some time for it today.';
  if(left>0)return 'Due in '+rel(left)+'. Time to wrap up.';
  if(left>-HR)return 'The deadline is now.';
  return 'Overdue by '+rel(left)+'. Submit as soon as you can.';
}
function pushAlert(t,left,level){
  var a={id:uid('a'),taskId:t.id,title:t.title,msg:reminderText(left),level:level,ts:Date.now()};
  ui.alerts.unshift(a);ui.alerts=ui.alerts.slice(0,3);
  S.notifs.unshift({id:a.id,taskId:t.id,title:t.title,msg:a.msg,level:level,ts:a.ts,read:false});
  S.notifs=S.notifs.slice(0,40);
}
function checkReminders(){
  var u=me();if(!u||u.role!=='student')return;
  var now=Date.now(),fired=false;
  myTasks().forEach(function(t){
    if(isDone(t,u.id))return;
    var left=t.due-now,fire=null;
    [[DAY,'24h','soon'],[HR,'1h','urgent'],[0,'due','overdue']].forEach(function(l){
      if(left<=l[0]){var k=t.id+':'+t.due+':'+l[1];if(!S.seen[k]){S.seen[k]=1;fire=l}}
    });
    if(fire){pushAlert(t,left,fire[2]);fired=true}
  });
  if(fired){save();render();beep()}
}

/* ---------- toasts ---------- */
function toast(m){var d=document.createElement('div');d.className='toast';d.textContent=m;$('#toasts').appendChild(d);setTimeout(function(){d.remove()},3400)}

/* ---------- plant art (pixel grid, 5px cells) ---------- */
function plantSVG(level,prog){
  var lv=Math.min(level,7),U=5,cx=20,base=28,pl=[],pt=[];
  function px(a,c,r,cls){a.push('<rect x="'+(c*U)+'" y="'+(r*U)+'" width="'+U+'" height="'+U+'" class="'+cls+'"/>')}
  var H=lv===0?prog*2:Math.round(4+lv*2.2+prog*.6),top=base-H,thick=lv>=3,lx=thick?cx-1:cx,rx=cx,i,k,r;
  if(lv===0&&prog===0){px(pl,cx,base,'p-seed');px(pl,cx+1,base,'p-seed');}
  else{
    for(r=base;r>=top;r--){px(pl,cx,r,'p-stem');if(thick)px(pl,cx-1,r,'p-stem')}
    if(lv===0){px(pl,cx-1,top,'p-leaf');px(pl,cx+1,top,'p-leaf2');if(prog>1){px(pl,cx-2,top+1,'p-leaf');px(pl,cx+2,top+1,'p-leaf2')}}
    var n=Math.floor((H-1)/2),len=2+Math.min(lv,3);
    for(i=0;i<n;i++){
      var row=base-2-i*2,side=i%2?1:-1,cls=i%2?'p-leaf2':'p-leaf',sz=Math.max(2,len-Math.floor(i/3));
      for(k=1;k<=sz;k++){px(pl,side<0?lx-k:rx+k,(k===sz&&sz>2)?row-1:row,cls)}
      px(pl,side<0?lx-1:rx+1,row+1,cls);
    }
    if(lv===3){px(pl,cx,top-1,'p-bud');px(pl,cx,top-2,'p-bud')}
    if(lv>=4){
      var fr=lv>=6?2:1,fy=top-fr,pc='p-petal'+(lv>=7?' gold':'');
      for(var d=1;d<=fr;d++){px(pl,cx-d,fy,pc);px(pl,cx+d,fy,pc);px(pl,cx,fy-d,pc);px(pl,cx,fy+d,pc)}
      if(lv>=6){px(pl,cx-1,fy-1,pc);px(pl,cx+1,fy-1,pc);px(pl,cx-1,fy+1,pc);px(pl,cx+1,fy+1,pc)}
      px(pl,cx,fy,'p-core');
      if(lv>=6){var y2=base-Math.round(H*.55),x2=cx+5;
        px(pl,x2-1,y2,pc);px(pl,x2+1,y2,pc);px(pl,x2,y2-1,pc);px(pl,x2,y2+1,pc);px(pl,x2,y2,'p-core')}
      if(lv>=7){px(pl,cx-7,fy+2,'p-glow');px(pl,cx+7,fy,'p-glow');px(pl,cx-5,fy-3,'p-glow');px(pl,cx+4,fy-4,'p-glow')}
    }
  }
  for(k=14;k<=25;k++)px(pt,k,29,'p-soil');
  for(k=12;k<=27;k++){px(pt,k,30,'p-rim');px(pt,k,31,'p-rim')}
  for(r=32;r<=40;r++){var sh=Math.floor((r-32)/3);for(k=13+sh;k<=26-sh;k++)px(pt,k,r,(k===13+sh+1)?'p-rim':'p-pot')}
  return '<svg viewBox="0 0 200 220" class="plant" shape-rendering="crispEdges" role="img" aria-label="Plant, level '+level+'"><g class="sway">'+pl.join('')+'</g>'+pt.join('')+'</svg>';
}

/* ---------- views ---------- */
function tierBadge(k,big){var t=TIERS[k];return '<span class="tier'+(big?' tier-big':'')+'" style="--tc:'+t.c+'"><i></i>'+t.n+'</span>'}

function loginView(){
  var reg=ui.authTab==='up';
  return '<div class="login"><section class="pitch"><span class="eyebrow">Player 1 ready</span><h1>Study <span>Space</span></h1>'+
  '<p>See what is due next, get a reminder you can actually hear, and watch a plant grow every time you finish something.</p>'+
  '<ul><li><span class="d"></span><span>Every activity, assignment, and quiz sorted by the nearest deadline.</span></li>'+
  '<li><span class="d"></span><span>Alarm-style reminders the day before, an hour before, and at the deadline.</span></li>'+
  '<li><span class="d"></span><span>Finish early for bonus XP and climb from Warrior to Mythical Immortal.</span></li></ul></section>'+
  '<section class="panel"><div class="tabs" role="tablist"><button role="tab" aria-selected="'+!reg+'" data-act="auth-tab" data-v="in">Sign in</button><button role="tab" aria-selected="'+reg+'" data-act="auth-tab" data-v="up">Create account</button></div>'+
  '<button class="btn google block" data-act="google">'+
  '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.4-4.7 7.1l7.5 5.8c4.4-4.1 7-10.1 7-17.4z"/><path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.500 42.600 14.600 48 24 48z"/></svg>Continue with Google</button>'+
  '<div class="or">or use email</div>'+
  '<form data-form="'+(reg?'register':'login')+'" autocomplete="on" novalidate>'+
  (reg?'<div class="field"><label for="f-name">Full name</label><input id="f-name" name="name" required autocomplete="name"></div>':'')+
  '<div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" required autocomplete="email"></div>'+
  '<div class="field"><label for="f-pw">Password</label><input id="f-pw" name="pw" type="password" required autocomplete="'+(reg?'new-password':'current-password')+'"></div>'+
  (reg?'<div class="field"><label>I am a</label><div class="roles"><label><input type="radio" name="role" value="student" checked> Student</label><label><input type="radio" name="role" value="instructor"> Instructor</label></div></div>':'')+
  '<div class="err" role="alert">'+esc(ui.err)+'</div>'+
  '<button class="btn primary block" type="submit">'+(reg?'Create account':'Sign in')+'</button></form>'+
  '<div class="divider"></div><div class="eyebrow" style="margin-bottom:8px">Try the demo</div>'+
  '<div class="demo"><button class="btn" data-act="demo" data-v="student">As a student</button><button class="btn" data-act="demo" data-v="instructor">As an instructor</button></div>'+
  '<p class="muted small" style="margin-top:12px">Prototype: accounts and tasks are saved in this browser only, and Google sign-in is simulated.</p></section></div>';
}

function header(u){
  var navs=u.role==='student'?[['tasks','My tasks']]:[['dashboard','Dashboard'],['tasks','Tasks'],['students','Students']];
  var cur=u.role==='student'?'tasks':ui.itab;
  var unread=S.notifs.filter(function(n){return !n.read}).length;
  return '<header class="top"><div class="bar"><div class="brand"><span class="logo">'+ic('leaf',18)+'</span>Study Space</div>'+
  '<nav class="nav" aria-label="Sections">'+navs.map(function(n){return '<button data-act="nav" data-v="'+n[0]+'" aria-current="'+(n[0]===cur)+'">'+n[1]+'</button>'}).join('')+'</nav>'+
  '<span class="spacer"></span>'+
  (u.role==='student'?'<button class="icon-btn" data-act="bell" aria-label="Reminders">'+ic('bell')+(unread?'<span class="badge-n">'+unread+'</span>':'')+'</button>':'')+
  '<button class="icon-btn" data-act="sound" aria-label="'+(ui.sound?'Mute alert sound':'Unmute alert sound')+'">'+ic(ui.sound?'sound':'mute')+'</button>'+
  '<div class="who"><b>'+esc(u.name)+'</b><span class="muted small">'+u.role[0].toUpperCase()+u.role.slice(1)+'</span></div>'+
  '<button class="icon-btn" data-act="logout" aria-label="Sign out">'+ic('out')+'</button></div>'+alertBar()+'</header>';
}
function alertBar(){
  if(!ui.alerts.length)return '';
  return '<div class="alerts" role="alert">'+ui.alerts.map(function(a){
    return '<div class="alert '+a.level+'"><span class="ring">'+ic('bell',18)+'</span><div class="a-body"><strong>'+esc(a.title)+'</strong><span>'+esc(a.msg)+'</span></div>'+
    '<button class="btn sm" data-act="alert-open" data-id="'+a.taskId+'">Open</button><button class="icon-btn" data-act="alert-x" data-aid="'+a.id+'" aria-label="Dismiss reminder">'+ic('x',16)+'</button></div>'}).join('')+'</div>';
}

function scoreText(t,sid){
  if(t.type==='personal')return t.done&&t.score?String(t.score):'';
  var s=getSub(t.id,sid);if(!s||s.status!=='done')return '';
  return s.score==null?'Awaiting score':s.score+'/'+t.max;
}
function taskRow(t,sid){
  var st=statusOf(t,sid),done=st==='done',left=t.due-Date.now(),pill='';
  if(done){var sc=scoreText(t,sid);pill='<span class="pill ok">'+ic('check',13)+(t.type==='personal'?'Done':'Submitted')+'</span>'+(sc&&sc!=='Awaiting score'?'<span class="pill score">'+esc(sc)+'</span>':(sc?'<span class="pill">'+sc+'</span>':''))}
  else if(left<0)pill='<span class="pill bad">Overdue</span>';
  else if(left<DAY)pill='<span class="pill warn">Due soon</span>';
  else if(st==='progress')pill='<span class="pill info">In progress</span>';
  return '<article class="task'+(done?' done':'')+'" data-act="open" data-id="'+t.id+'" tabindex="0" role="button" aria-label="Open '+esc(t.title)+'">'+
  '<div><span class="type '+t.type+'">'+(t.type==='personal'?'Personal':t.type)+'</span><h3>'+esc(t.title)+'</h3>'+
  '<div class="meta"><span>'+esc(t.course)+'</span><span>Due '+fmtDate(t.due)+'</span>'+(t.files&&t.files.length?'<span>'+ic('file',13)+' '+t.files.length+'</span>':'')+(t.max?'<span>'+t.max+' pts</span>':'')+'</div></div>'+
  '<div class="side">'+(done?'':'<span class="cd" data-due="'+t.due+'">'+cdText(left)+'</span>')+'<div class="row" style="gap:6px;justify-content:flex-end">'+pill+'</div></div></article>';
}

function studentView(u){
  var all=myTasks(),now=Date.now();
  var open=all.filter(function(t){return !isDone(t,u.id)}).sort(function(a,b){return a.due-b.due});
  var done=all.filter(function(t){return isDone(t,u.id)}).sort(function(a,b){return b.due-a.due});
  var overdue=open.filter(function(t){return t.due<now}).length;
  var f=ui.filter;
  function match(t){return f==='quiz'?t.type==='quiz':f==='work'?(t.type==='assignment'||t.type==='activity'):f==='personal'?t.type==='personal':true}
  var shownOpen=f==='done'?[]:open.filter(match),shownDone=(f==='done'||f==='open')?done:[];
  if(f==='open')shownDone=done;else if(f!=='done')shownDone=[];
  var nxt=open.filter(function(t){return t.due>=now})[0];
  var sum=open.length+' open'+(overdue?' · '+overdue+' overdue':'')+(nxt?' · next due in <span class="mono">'+rel(nxt.due-now)+'</span>':'');
  var hr=new Date().getHours(),greet=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
  var P=plantOf(u.id),stand=standings(),mine=stand.filter(function(r){return r.u.id===u.id})[0];
  var chips=[['open','All'],['quiz','Quizzes'],['work','Assignments & activities'],['personal','Personal'],['done','Completed']];
  var stage=STAGES[Math.min(P.level,7)],toNext=3-P.prog;
  var top=stand.filter(function(r){return r.pos&&r.pos<=3});
  return '<div class="main"><div class="hello"><h1>'+greet+', '+esc(u.name.split(' ')[0])+'</h1><p>'+sum+'</p></div>'+
  '<div class="grid"><section class="panel" aria-label="Tasks"><div class="head"><div class="chips">'+chips.map(function(c){return '<button class="chip" data-act="filter" data-v="'+c[0]+'" aria-pressed="'+(f===c[0])+'">'+c[1]+'</button>'}).join('')+'</div>'+
  '<button class="btn primary" data-act="add-personal">'+ic('plus',16)+'Personal task</button></div>'+
  (shownOpen.length?'<div class="tasks">'+shownOpen.map(function(t){return taskRow(t,u.id)}).join('')+'</div>':(f==='done'?'':'<div class="empty">Nothing open here. Add a personal task or check another filter.</div>'))+
  (shownDone.length?'<div class="sec-title">Completed</div><div class="tasks">'+shownDone.map(function(t){return taskRow(t,u.id)}).join('')+'</div>':'')+
  (f==='done'&&!done.length?'<div class="empty">No completed tasks yet.</div>':'')+
  '</section><aside class="rail">'+
  '<section class="panel"><div class="eyebrow">Your plant</div><div class="plant-box">'+plantSVG(P.level,P.prog)+'</div>'+
  '<div class="lvl">Level '+P.level+' · '+stage+'</div><div class="pips" aria-label="'+P.prog+' of 3 tasks toward next level">'+[0,1,2].map(function(i){return '<span class="pip'+(i<P.prog?' on':'')+'"></span>'}).join('')+'</div>'+
  '<p class="xp">'+toNext+' more task'+(toNext>1?'s':'')+' to reach level '+(P.level+1)+' · <b>'+P.xp+' XP</b></p></section>'+
  '<section class="panel"><div class="row between"><div class="eyebrow">Class rank</div><button class="btn sm" data-act="standings">'+ic('trophy',14)+'All</button></div>'+
  '<div style="margin-top:8px">'+tierBadge(mine.tier,true)+'</div><p class="muted small" style="margin-top:2px">'+(mine.pos?'#'+mine.pos+' of '+stand.length+' students':'Finish a task to get on the board')+' · '+mine.xp+' XP from class tasks</p>'+
  '<div class="lb">'+top.map(function(r){return '<div class="'+(r.u.id===u.id?'me':'')+'"><span class="pos">'+r.pos+'</span><span class="nm">'+esc(r.u.name)+'</span><span class="xpv">'+r.xp+'</span></div>'}).join('')+'</div></section>'+
  '</aside></div></div>';
}

/* instructor */
function instructorView(u){
  var t=ui.itab;
  return '<div class="main">'+(t==='dashboard'?instDash():t==='tasks'?instTasks():instStudents())+'</div>';
}
function taskStats(t){
  var st=students(),done=0,graded=0,prog=0;
  st.forEach(function(s){var x=getSub(t.id,s.id);if(!x)return;if(x.status==='done'){done++;if(x.score!=null)graded++}else if(x.status==='progress')prog++});
  return {total:st.length,done:done,graded:graded,prog:prog};
}
function pending(){
  var out=[];
  assigned().forEach(function(t){students().forEach(function(s){var x=getSub(t.id,s.id);if(x&&x.status==='done'&&x.score==null)out.push({t:t,s:s,x:x})})});
  return out.sort(function(a,b){return b.x.completedAt-a.x.completedAt});
}
function gradeInput(t,sid,val){return '<input type="number" min="0" max="'+t.max+'" step="1" value="'+(val==null?'':val)+'" placeholder="/'+t.max+'" data-grade="'+t.id+'|'+sid+'" aria-label="Score out of '+t.max+'">'}
function instDash(){
  var ts=assigned().sort(function(a,b){return a.due-b.due}),now=Date.now();
  var upcoming=ts.filter(function(t){return t.due>=now&&t.due-now<7*DAY}).length;
  var sumDone=0,sumAll=0;ts.forEach(function(t){var s=taskStats(t);sumDone+=s.done;sumAll+=s.total});
  var pend=pending(),stand=standings();
  return '<div class="head" style="margin-bottom:0"><div class="hello"><h1>Class overview</h1><p>See who is on track and who needs a nudge.</p></div><button class="btn primary" data-act="new-task">'+ic('plus',16)+'New task</button></div>'+
  '<section class="panel"><div class="stats"><div class="stat"><b>'+ts.length+'</b><span>tasks created</span></div><div class="stat"><b>'+students().length+'</b><span>students enrolled</span></div>'+
  '<div class="stat"><b>'+(sumAll?Math.round(sumDone/sumAll*100):0)+'%</b><span>average completion</span></div><div class="stat"><b>'+upcoming+'</b><span>due in the next 7 days</span></div><div class="stat"><b>'+pend.length+'</b><span>waiting for a score</span></div></div></section>'+
  '<div class="grid"><section class="panel"><h2>Progress by task</h2><div class="prog">'+ts.map(function(t){var s=taskStats(t),pc=s.total?Math.round(s.done/s.total*100):0;
    return '<div class="prog-row"><div class="t"><span class="type '+t.type+'">'+t.type+'</span><b>'+esc(t.title)+'</b><span class="muted small">'+esc(t.course)+' · due '+fmtDate(t.due)+'</span></div>'+
    '<div class="bar-track" aria-label="'+pc+'% complete"><div class="bar-fill" style="width:'+pc+'%"></div></div><button class="btn sm" data-act="view-subs" data-id="'+t.id+'">'+s.done+'/'+s.total+'</button></div>'}).join('')+'</div></section>'+
  '<aside class="rail"><section class="panel"><h2>Needs a score</h2>'+(pend.length?'<div class="tbl-wrap"><table><tbody>'+pend.slice(0,6).map(function(p){return '<tr><td><b>'+esc(p.s.name)+'</b><br><span class="muted small">'+esc(p.t.title)+'</span></td><td>'+gradeInput(p.t,p.s.id,null)+'</td></tr>'}).join('')+'</tbody></table></div>':'<p class="muted" style="margin-top:8px">Everything submitted has a score.</p>')+'</section>'+
  '<section class="panel"><h2>Top of the class</h2><div class="lb">'+stand.filter(function(r){return r.pos&&r.pos<=5}).map(function(r){return '<div><span class="pos">'+r.pos+'</span><span class="nm">'+esc(r.u.name)+'</span><span class="xpv">'+r.xp+'</span></div>'}).join('')+'</div></section></aside></div>';
}
function instTasks(){
  var ts=assigned().sort(function(a,b){return a.due-b.due});
  return '<div class="head" style="margin-bottom:0"><div class="hello"><h1>Tasks</h1><p>Sorted by nearest deadline.</p></div><button class="btn primary" data-act="new-task">'+ic('plus',16)+'New task</button></div>'+
  '<section class="panel">'+(ts.length?'<div class="tasks">'+ts.map(function(t){var s=taskStats(t),left=t.due-Date.now();
    return '<article class="task" style="cursor:default"><div><span class="type '+t.type+'">'+t.type+'</span><h3>'+esc(t.title)+'</h3><div class="meta"><span>'+esc(t.course)+'</span><span>Due '+fmtDate(t.due)+'</span><span>'+t.max+' pts</span>'+(t.files.length?'<span>'+ic('file',13)+' '+t.files.length+'</span>':'')+'</div></div>'+
    '<div class="side"><span class="cd" data-due="'+t.due+'">'+cdText(left)+'</span><div class="row" style="gap:6px;justify-content:flex-end"><button class="btn sm" data-act="view-subs" data-id="'+t.id+'">'+s.done+'/'+s.total+' done</button><button class="btn sm" data-act="edit-task" data-id="'+t.id+'" aria-label="Edit">'+ic('edit',14)+'</button></div></div></article>'}).join('')+'</div>':'<div class="empty">No tasks yet. Create the first one.</div>')+'</section>';
}
function instStudents(){
  var stand=standings(),n=assigned().length;
  return '<div class="hello"><h1>Students</h1><p>Rank updates as students finish tasks.</p></div><section class="panel"><div class="tbl-wrap"><table><thead><tr><th>#</th><th>Student</th><th>Rank</th><th>Progress</th><th>XP</th></tr></thead><tbody>'+
  stand.map(function(r){var pc=n?Math.round(r.done/n*100):0;
    return '<tr class="click" data-act="view-student" data-id="'+r.u.id+'" tabindex="0"><td class="mono">'+(r.pos||'–')+'</td><td><b>'+esc(r.u.name)+'</b><br><span class="muted small">'+esc(r.u.email)+'</span></td><td>'+tierBadge(r.tier)+'</td>'+
    '<td style="min-width:140px"><div class="bar-track"><div class="bar-fill" style="width:'+pc+'%"></div></div><span class="muted small">'+r.done+' of '+n+' done'+(r.started?' · '+r.started+' started':'')+'</span></td><td class="mono">'+r.xp+'</td></tr>'}).join('')+'</tbody></table></div>'+
  '<div class="divider"></div><div class="row" style="gap:16px">'+Object.keys(TIERS).map(function(k){return tierBadge(k)}).join('')+'</div></section>';
}

/* ---------- modals ---------- */
function sheet(title,body,wide,sub){
  return '<div class="sheet'+(wide?' wide':'')+'"><div class="sheet-h"><div>'+(sub||'')+'<h2>'+title+'</h2></div><button class="icon-btn" data-act="close" aria-label="Close">'+ic('x')+'</button></div>'+body+'</div>';
}
function fileList(fs){return fs&&fs.length?'<div class="files">'+fs.map(function(f){return '<span class="file">'+ic('file',14)+esc(f.name)+' <span class="muted">'+size(f.size)+'</span></span>'}).join('')+'</div>':''}

function modalHTML(){
  var m=ui.modal,u=me();if(!m)return '';
  if(m.t==='google'){
    return sheet('Choose a Google account',
    '<form data-form="google"><p class="muted small" style="margin-bottom:12px">This is a simulated Google sign-in. A real build would use Google OAuth through the User Service.</p>'+
    '<div class="field"><label for="g-name">Name</label><input id="g-name" name="name" autocomplete="name"></div>'+
    '<div class="field"><label for="g-email">Google email</label><input id="g-email" name="email" type="email" required placeholder="you@gmail.com"></div>'+
    '<div class="field"><label>Role (new accounts)</label><div class="roles"><label><input type="radio" name="role" value="student" checked> Student</label><label><input type="radio" name="role" value="instructor"> Instructor</label></div></div>'+
    '<div class="err" role="alert">'+esc(ui.err)+'</div><button class="btn primary block" type="submit">Continue</button></form>');
  }
  if(m.t==='notifs'){
    return sheet('Reminders',
    '<div class="row between" style="margin-bottom:12px"><button class="btn sm" data-act="test-alert">Play test alert</button><button class="btn sm" data-act="sound">'+ic(ui.sound?'sound':'mute',14)+(ui.sound?'Sound on':'Sound off')+'</button></div>'+
    '<p class="muted small" style="margin-bottom:10px">You get a reminder 24 hours before, 1 hour before, and at the deadline.</p>'+
    (S.notifs.length?'<div class="tasks">'+S.notifs.slice(0,12).map(function(n){return '<div class="task" style="cursor:default;grid-template-columns:1fr auto"><div><b>'+esc(n.title)+'</b><div class="muted small">'+esc(n.msg)+'</div></div><span class="muted small">'+new Date(n.ts).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'</span></div>'}).join('')+'</div>':'<div class="empty">No reminders yet.</div>'));
  }
  if(m.t==='standings'){
    var stand=standings();
    return sheet('Class standings',
    '<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Student</th><th>Rank</th><th>Done</th><th>XP</th></tr></thead><tbody>'+stand.map(function(r){
      return '<tr'+(r.u.id===u.id?' style="font-weight:600;background:var(--accent-soft)"':'')+'><td class="mono">'+(r.pos||'–')+'</td><td>'+esc(r.u.name)+'</td><td>'+tierBadge(r.tier)+'</td><td class="mono">'+r.done+'</td><td class="mono">'+r.xp+'</td></tr>'}).join('')+'</tbody></table></div>'+
    '<div class="divider"></div><dl class="kv">'+Object.keys(TIERS).map(function(k){return '<dt>'+tierBadge(k)+'</dt><dd class="muted">'+TIERS[k].d+'</dd>'}).join('')+'</dl>',true);
  }
  if(m.t==='task'){
    var t=taskById(m.id);if(!t)return '';
    var done=isDone(t,u.id),sub=getSub(t.id,u.id),left=t.due-Date.now(),pers=t.type==='personal';
    var body='<dl class="kv"><dt>Course</dt><dd>'+esc(t.course)+'</dd><dt>Deadline</dt><dd>'+fmtDate(t.due)+' · <span class="cd" data-due="'+t.due+'">'+cdText(left)+'</span></dd>'+(t.max?'<dt>Points</dt><dd>'+t.max+'</dd>':'')+'</dl>'+
      (t.desc?'<p>'+esc(t.desc)+'</p>':'')+(t.files&&t.files.length?'<div class="eyebrow" style="margin-top:14px">Attachments</div>'+fileList(t.files):'');
    body+='<div class="divider"></div>';
    if(done){
      if(pers){body+='<div class="row"><span class="pill ok">'+ic('check',13)+'Completed</span>'+(t.score?'<span class="pill score">Score '+esc(t.score)+'</span>':'')+'</div>'+(t.files.length?'':'')}
      else{
        body+='<div class="row"><span class="pill ok">'+ic('check',13)+'Submitted'+(sub.late?' late':'')+'</span><span class="pill '+(sub.score==null?'':'score')+'">'+(sub.score==null?'Awaiting score':'Score '+sub.score+'/'+t.max)+'</span></div>'+
        '<dl class="kv"><dt>Submitted</dt><dd>'+fmtDate(sub.completedAt)+'</dd><dt>XP earned</dt><dd><b class="mono">+'+sub.xp+'</b>'+(sub.bonus?' <span class="muted">(includes +'+sub.bonus+' for finishing early)</span>':'')+'</dd></dl>'+
        (sub.files&&sub.files.length?'<div class="eyebrow">Your files</div>'+fileList(sub.files):'')+(sub.note?'<p class="muted small" style="margin-top:8px">Note: '+esc(sub.note)+'</p>':'');
      }
    }else if(pers){
      body+='<form data-form="complete-personal" data-id="'+t.id+'"><div class="field"><label for="ps">Your score (optional)</label><input id="ps" name="score" placeholder="e.g. 18/20"></div><button class="btn primary" type="submit">'+ic('check',16)+'Mark complete</button></form>';
    }else{
      var xpHint=left>0?'Finish before the deadline for bonus XP.':'This is past due, so it earns reduced XP.';
      body+='<form data-form="submit" data-id="'+t.id+'"><div class="field"><label for="sf">'+(t.type==='quiz'?'Attach your work (optional)':'Attach your work')+'</label><input id="sf" name="files" type="file" multiple></div>'+
      '<div class="field"><label for="sn">Note to instructor (optional)</label><textarea id="sn" name="note"></textarea></div>'+
      '<p class="muted small" style="margin-bottom:12px">'+xpHint+'</p><div class="row">'+(statusOf(t,u.id)==='todo'?'<button class="btn" type="button" data-act="start" data-id="'+t.id+'">Start working</button>':'<span class="pill info">In progress</span>')+
      '<button class="btn primary" type="submit">'+ic('check',16)+(t.type==='quiz'?'Mark quiz as taken':'Submit & complete')+'</button></div></form>';
    }
    if(pers){body+='<div class="divider"></div><div class="row"><button class="btn" data-act="edit-personal" data-id="'+t.id+'">'+ic('edit',15)+'Edit</button><button class="btn danger" data-act="del-personal" data-id="'+t.id+'">'+ic('trash',15)+(ui.confirmDel===t.id?'Confirm delete':'Delete')+'</button></div>'}
    return sheet(esc(t.title),body,false,'<span class="type '+t.type+'">'+(pers?'Personal':t.type)+'</span>');
  }
  if(m.t==='personal'){
    var e=m.id?taskById(m.id):null;
    return sheet(e?'Edit personal task':'Add personal task',
    '<form data-form="personal" data-id="'+(e?e.id:'')+'"><div class="field"><label for="pt">Title</label><input id="pt" name="title" required value="'+esc(e?e.title:'')+'"></div>'+
    '<div class="field"><label for="pd">Details</label><textarea id="pd" name="desc">'+esc(e?e.desc:'')+'</textarea></div>'+
    '<div class="field"><label for="pdue">Deadline</label><input id="pdue" name="due" type="datetime-local" required value="'+toLocalInput(e?e.due:Date.now()+DAY)+'"></div>'+
    '<div class="field"><label for="pf">Attach files</label><input id="pf" name="files" type="file" multiple>'+(e?fileList(e.files):'')+'</div>'+
    '<div class="err" role="alert">'+esc(ui.err)+'</div><button class="btn primary block" type="submit">'+(e?'Save changes':'Add task')+'</button></form>');
  }
  if(m.t==='itask'){
    var x=m.id?taskById(m.id):null;
    return sheet(x?'Edit task':'Create task',
    '<form data-form="itask" data-id="'+(x?x.id:'')+'"><div class="two"><div class="field"><label for="it-type">Type</label><select id="it-type" name="type">'+['assignment','activity','quiz'].map(function(k){return '<option value="'+k+'"'+(x&&x.type===k?' selected':'')+'>'+k[0].toUpperCase()+k.slice(1)+'</option>'}).join('')+'</select></div>'+
    '<div class="field"><label for="it-max">Points</label><input id="it-max" name="max" type="number" min="1" value="'+(x?x.max:50)+'" required></div></div>'+
    '<div class="field"><label for="it-title">Title</label><input id="it-title" name="title" required value="'+esc(x?x.title:'')+'"></div>'+
    '<div class="field"><label for="it-course">Course</label><input id="it-course" name="course" required value="'+esc(x?x.course:'')+'" placeholder="e.g. Computer Networks"></div>'+
    '<div class="field"><label for="it-desc">Instructions</label><textarea id="it-desc" name="desc">'+esc(x?x.desc:'')+'</textarea></div>'+
    '<div class="field"><label for="it-due">Deadline</label><input id="it-due" name="due" type="datetime-local" required value="'+toLocalInput(x?x.due:Date.now()+3*DAY)+'"></div>'+
    '<div class="field"><label for="it-files">Attach files</label><input id="it-files" name="files" type="file" multiple>'+(x?fileList(x.files):'')+'</div>'+
    '<div class="err" role="alert">'+esc(ui.err)+'</div><div class="row"><button class="btn primary" type="submit">'+(x?'Save changes':'Publish to class')+'</button>'+
    (x?'<button class="btn danger" type="button" data-act="del-task" data-id="'+x.id+'">'+ic('trash',15)+(ui.confirmDel===x.id?'Confirm delete':'Delete')+'</button>':'')+'</div></form>');
  }
  if(m.t==='subs'){
    var tk=taskById(m.id);if(!tk)return '';
    return sheet(esc(tk.title),'<p class="muted small">Due '+fmtDate(tk.due)+' · '+tk.max+' points. Type a score and press Tab to save.</p><div class="tbl-wrap"><table><thead><tr><th>Student</th><th>Status</th><th>Submitted</th><th>Score</th></tr></thead><tbody>'+
    students().map(function(s){var sb=getSub(tk.id,s.id),st=sb?sb.status:'todo';
      return '<tr><td>'+esc(s.name)+'</td><td>'+(st==='done'?'<span class="pill ok">'+ic('check',12)+(sb.late?'Late':'Done')+'</span>':st==='progress'?'<span class="pill info">In progress</span>':'<span class="pill">Not started</span>')+'</td><td class="muted small">'+(st==='done'?fmtDate(sb.completedAt)+(sb.files&&sb.files.length?' · '+sb.files.length+' file':''):'–')+'</td><td>'+(st==='done'?gradeInput(tk,s.id,sb.score):'–')+'</td></tr>'}).join('')+'</tbody></table></div>',true,'<span class="type '+tk.type+'">'+tk.type+'</span>');
  }
  if(m.t==='student'){
    var s=S.users.filter(function(q){return q.id===m.id})[0];if(!s)return '';
    var row=standings().filter(function(r){return r.u.id===s.id})[0],P=plantOf(s.id);
    return sheet(esc(s.name),'<div class="row" style="gap:16px">'+tierBadge(row.tier,true)+'<span class="muted">Plant level '+P.level+' · '+row.xp+' XP</span></div>'+
    '<div class="tbl-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Score</th></tr></thead><tbody>'+assigned().sort(function(a,b){return a.due-b.due}).map(function(tk){var sb=getSub(tk.id,s.id),st=sb?sb.status:'todo';
      return '<tr><td>'+esc(tk.title)+'<br><span class="muted small">Due '+fmtDate(tk.due)+'</span></td><td>'+(st==='done'?'<span class="pill ok">'+ic('check',12)+(sb.late?'Late':'Done')+'</span>':st==='progress'?'<span class="pill info">In progress</span>':(tk.due<Date.now()?'<span class="pill bad">Missing</span>':'<span class="pill">Not started</span>'))+'</td><td>'+(st==='done'?gradeInput(tk,s.id,sb.score):'–')+'</td></tr>'}).join('')+'</tbody></table></div>',true,'<span class="eyebrow">Student progress</span>');
  }
  return '';
}
function openModal(m){ui.modal=m;ui.err='';ui.confirmDel=null;drawModal()}
function closeModal(){ui.modal=null;ui.confirmDel=null;drawModal();render()}
function drawModal(){var el=$('#modal');if(!ui.modal){el.hidden=true;el.innerHTML='';return}el.innerHTML=modalHTML();el.hidden=false}

/* ---------- render ---------- */
function render(){
  var app=$('#app'),u=me();
  if(!u){app.innerHTML=loginView();return}
  app.innerHTML=header(u)+(u.role==='student'?studentView(u):instructorView(u));
  tick();
}
function tick(){
  var now=Date.now();
  document.querySelectorAll('.cd').forEach(function(e){var ms=+e.dataset.due-now;e.textContent=cdText(ms);e.classList.toggle('late',ms<0);e.classList.toggle('soon',ms>=0&&ms<DAY)});
}

/* ---------- actions ---------- */
function signIn(user){
  S.session=user.id;ui.tab='tasks';ui.itab='dashboard';ui.filter='open';ui.alerts=[];ui.err='';ui.modal=null;
  save();unlockAudio();drawModal();render();
  setTimeout(checkReminders,500);
}
function fileMeta(input){return input&&input.files?Array.prototype.map.call(input.files,function(f){return {name:f.name,size:f.size}}):[]}
function award(u,before){
  var after=plantOf(u.id);
  if(after.level>before.level)setTimeout(function(){toast('Your plant grew to level '+after.level+': '+STAGES[Math.min(after.level,7)])},900);
}
function setScore(tid,sid,val){
  var t=taskById(tid),s=getSub(tid,sid);if(!t||!s)return;
  s.score=val===''?null:Math.max(0,Math.min(t.max,Math.round(+val)));save();toast('Score saved');
  if(!ui.modal)render();
}

function onSubmit(e){
  var f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();
  var kind=f.dataset.form,fd=new FormData(f),u=me();
  if(kind==='login'){
    var em=String(fd.get('email')||'').trim().toLowerCase(),pw=String(fd.get('pw')||'');
    var found=S.users.filter(function(x){return x.email===em})[0];
    if(!found||found.pw!==hashPw(pw)){ui.err='That email and password do not match an account.';render();return}
    signIn(found);return;
  }
  if(kind==='register'){
    var nm=String(fd.get('name')||'').trim(),em2=String(fd.get('email')||'').trim().toLowerCase(),pw2=String(fd.get('pw')||'');
    if(!nm||!/^\S+@\S+\.\S+$/.test(em2)){ui.err='Enter your name and a valid email address.';render();return}
    if(pw2.length<6){ui.err='Use a password with at least 6 characters.';render();return}
    if(S.users.some(function(x){return x.email===em2})){ui.err='An account with that email already exists. Try signing in.';render();return}
    var nu={id:uid('u'),name:nm,email:em2,role:fd.get('role')==='instructor'?'instructor':'student',pw:hashPw(pw2)};
    S.users.push(nu);signIn(nu);return;
  }
  if(kind==='google'){
    var ge=String(fd.get('email')||'').trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(ge)){ui.err='Enter your Google email address.';drawModal();return}
    var gu=S.users.filter(function(x){return x.email===ge})[0];
    if(!gu){gu={id:uid('u'),name:String(fd.get('name')||'').trim()||ge.split('@')[0],email:ge,role:fd.get('role')==='instructor'?'instructor':'student',pw:null,google:true};S.users.push(gu)}
    signIn(gu);return;
  }
  if(kind==='submit'){
    var t=taskById(f.dataset.id),files=fileMeta(f.querySelector('input[type=file]')),at=Date.now(),x=calcXP(t,at),before=plantOf(u.id);
    S.subs[t.id]=S.subs[t.id]||{};
    S.subs[t.id][u.id]={status:'done',completedAt:at,files:files,note:String(fd.get('note')||'').trim(),late:x.late,xp:x.xp,base:x.base,bonus:x.bonus,score:null};
    save();ui.modal=null;drawModal();render();
    toast('+'+x.xp+' XP'+(x.bonus?' ('+x.bonus+' early bonus)':x.late?' (late)':''));award(u,before);return;
  }
  if(kind==='complete-personal'){
    var pt=taskById(f.dataset.id),b2=plantOf(u.id);pt.done=true;pt.completedAt=Date.now();pt.score=String(fd.get('score')||'').trim();
    save();ui.modal=null;drawModal();render();toast('+5 XP');award(u,b2);return;
  }
  if(kind==='personal'){
    var title=String(fd.get('title')||'').trim(),due=new Date(fd.get('due')).getTime();
    if(!title||isNaN(due)){ui.err='Add a title and a deadline.';drawModal();return}
    var nf=fileMeta(f.querySelector('input[type=file]')),id=f.dataset.id,pt2=id?taskById(id):null;
    if(pt2){pt2.title=title;pt2.desc=String(fd.get('desc')||'').trim();if(pt2.due!==due){Object.keys(S.seen).forEach(function(k){if(k.indexOf(pt2.id+':')===0)delete S.seen[k]})}pt2.due=due;pt2.files=pt2.files.concat(nf)}
    else S.tasks.push({id:uid('p'),type:'personal',title:title,course:'Personal',desc:String(fd.get('desc')||'').trim(),due:due,max:0,files:nf,owner:u.id,done:false});
    save();ui.modal=null;drawModal();render();toast(pt2?'Task updated':'Task added');setTimeout(checkReminders,300);return;
  }
  if(kind==='itask'){
    var ti=String(fd.get('title')||'').trim(),co=String(fd.get('course')||'').trim(),d2=new Date(fd.get('due')).getTime(),mx=Math.max(1,Math.round(+fd.get('max')||0));
    if(!ti||!co||isNaN(d2)){ui.err='Add a title, course, and deadline.';drawModal();return}
    var nf2=fileMeta(f.querySelector('input[type=file]')),eid=f.dataset.id,et=eid?taskById(eid):null;
    if(et){et.type=fd.get('type');et.title=ti;et.course=co;et.desc=String(fd.get('desc')||'').trim();et.max=mx;if(et.due!==d2){Object.keys(S.seen).forEach(function(k){if(k.indexOf(et.id+':')===0)delete S.seen[k]})}et.due=d2;et.files=et.files.concat(nf2)}
    else{var nt={id:uid('t'),type:fd.get('type'),title:ti,course:co,desc:String(fd.get('desc')||'').trim(),due:d2,max:mx,files:nf2,owner:u.id,created:Date.now()};S.tasks.push(nt);S.subs[nt.id]={}}
    save();ui.modal=null;drawModal();render();toast(et?'Task updated':'Task published to the class');return;
  }
}

function onClick(e){
  var el=e.target.closest('[data-act]');if(!el){if(e.target.id==='modal')closeModal();return}
  var a=el.dataset.act,id=el.dataset.id,u=me();
  unlockAudio();
  switch(a){
    case 'auth-tab':ui.authTab=el.dataset.v;ui.err='';render();break;
    case 'google':ui.err='';openModal({t:'google'});break;
    case 'demo':{var d=S.users.filter(function(x){return x.email===(el.dataset.v==='student'?'student@studyspace.demo':'instructor@studyspace.demo')})[0];if(d)signIn(d);break}
    case 'logout':S.session=null;ui.alerts=[];ui.modal=null;save();drawModal();render();break;
    case 'nav':if(u.role==='student')ui.tab=el.dataset.v;else ui.itab=el.dataset.v;render();break;
    case 'filter':ui.filter=el.dataset.v;render();break;
    case 'sound':ui.sound=!ui.sound;if(ui.sound)beep();render();if(ui.modal&&ui.modal.t==='notifs')drawModal();break;
    case 'bell':S.notifs.forEach(function(n){n.read=true});save();render();openModal({t:'notifs'});break;
    case 'test-alert':{var t0=myTasks().filter(function(t){return !isDone(t,u.id)}).sort(function(x,y){return x.due-y.due})[0]||S.tasks[0];pushAlert(t0,t0.due-Date.now(),'urgent');S.notifs[0].read=true;save();render();drawModal();beep();break}
    case 'alert-x':ui.alerts=ui.alerts.filter(function(x){return x.id!==el.dataset.aid});render();break;
    case 'alert-open':openModal({t:'task',id:id});break;
    case 'close':closeModal();break;
    case 'open':openModal({t:'task',id:id});break;
    case 'start':{var s=getSub(id,u.id);if(!s){S.subs[id]=S.subs[id]||{};S.subs[id][u.id]={status:'progress',completedAt:null,files:[],note:'',late:false,xp:0,score:null}}save();drawModal();toast('Marked as in progress');break}
    case 'add-personal':openModal({t:'personal'});break;
    case 'edit-personal':openModal({t:'personal',id:id});break;
    case 'del-personal':
      if(ui.confirmDel===id){S.tasks=S.tasks.filter(function(t){return t.id!==id});save();ui.modal=null;ui.confirmDel=null;drawModal();render();toast('Task deleted')}
      else{ui.confirmDel=id;drawModal()}break;
    case 'standings':openModal({t:'standings'});break;
    case 'new-task':openModal({t:'itask'});break;
    case 'edit-task':openModal({t:'itask',id:id});break;
    case 'del-task':
      if(ui.confirmDel===id){S.tasks=S.tasks.filter(function(t){return t.id!==id});delete S.subs[id];save();ui.modal=null;ui.confirmDel=null;drawModal();render();toast('Task deleted')}
      else{ui.confirmDel=id;drawModal()}break;
    case 'view-subs':openModal({t:'subs',id:id});break;
    case 'view-student':openModal({t:'student',id:id});break;
  }
}
document.addEventListener('submit',onSubmit);
document.addEventListener('click',onClick);
document.addEventListener('change',function(e){var g=e.target.getAttribute&&e.target.getAttribute('data-grade');if(g){var p=g.split('|');setScore(p[0],p[1],e.target.value)}});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&ui.modal){closeModal();return}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[data-act][tabindex]')&&e.target.tagName!=='INPUT'){e.preventDefault();onClick({target:e.target})}
});
document.addEventListener('pointerdown',unlockAudio,{once:true});

/* ---------- live background ---------- */
(function(){
  var c=$('#bg'),x=c.getContext('2d'),W=0,H=0,dpr=1,motes=[],col={b1:'150,214,176',b2:'246,215,140',m:'27,133,86'};
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function colors(){var cs=getComputedStyle(document.documentElement);col.b1=cs.getPropertyValue('--blob1').trim()||col.b1;col.b2=cs.getPropertyValue('--blob2').trim()||col.b2;col.m=cs.getPropertyValue('--mote').trim()||col.m}
  function resize(){dpr=Math.min(window.devicePixelRatio||1,2);W=c.width=Math.round(innerWidth*dpr);H=c.height=Math.round(innerHeight*dpr);c.style.width=innerWidth+'px';c.style.height=innerHeight+'px';
    motes=[];for(var i=0;i<Math.round(innerWidth/24)+8;i++)motes.push({x:Math.random()*W,y:Math.random()*H,r:(1+Math.random()*2.6)*dpr,vx:(Math.random()-.5)*.18*dpr,vy:-(.08+Math.random()*.28)*dpr,p:Math.random()*6.28});
    draw(0)}
  function blob(cx,cy,r,rgb,a){var g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba('+rgb+','+a+')');g.addColorStop(1,'rgba('+rgb+',0)');x.fillStyle=g;x.fillRect(0,0,W,H)}
  function draw(t){
    x.clearRect(0,0,W,H);var R=Math.max(W,H);
    blob(W*(.2+.06*Math.sin(t*.00007)),H*(.18+.05*Math.cos(t*.00009)),R*.55,col.b1,.55);
    blob(W*(.85+.05*Math.cos(t*.00006)),H*(.82+.06*Math.sin(t*.00008)),R*.6,col.b2,.4);
    motes.forEach(function(m){
      if(!reduce){m.x+=m.vx;m.y+=m.vy;m.p+=.012;if(m.y<-10){m.y=H+10;m.x=Math.random()*W}if(m.x<-10)m.x=W+10;if(m.x>W+10)m.x=-10}
      x.fillStyle='rgba('+col.m+','+(.2+.25*Math.max(0,Math.sin(m.p))).toFixed(3)+')';var q=Math.max(2,Math.round(m.r*1.6));x.fillRect(Math.round(m.x),Math.round(m.y),q,q);
    });
    if(!reduce)requestAnimationFrame(draw);
  }
  colors();resize();window.addEventListener('resize',resize);
  if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){colors();if(reduce)draw(0)});
  new MutationObserver(function(){colors();if(reduce)draw(0)}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();

/* ---------- boot ---------- */
S=load();
if(!S||!S.users||!S.tasks||!S.subs){S=seed();save()}
S.seen=S.seen||{};S.notifs=S.notifs||[];
if(S.session&&!me())S.session=null;
render();
setInterval(tick,1000);
setInterval(checkReminders,15000);
if(me())setTimeout(checkReminders,600);
})();
