/* STUDY SPACE
   Each "service" is a separate module. Today they use localStorage.
   To go real, replace each function body with fetch() calls to /api/... routes. */
const DB={get(k,d){try{return JSON.parse(localStorage.getItem('ss_'+k))??d}catch{return d}},set(k,v){try{localStorage.setItem('ss_'+k,JSON.stringify(v))}catch{}}};
const uid=()=>Math.random().toString(36).slice(2,10);

/* --- User Service --- */
const UserService={
 all:()=>DB.get('users',[]),
 me:()=>UserService.all().find(u=>u.id===DB.get('session')),
 register({name,email,password,role}){
  if(!name||!email||password.length<6)return{error:'Enter your name, a valid email, and a password of 6+ characters.'};
  if(UserService.all().some(u=>u.email===email))return{error:'That email already has an account. Log in instead.'};
  const u={id:uid(),name,email,password,role};DB.set('users',[...UserService.all(),u]);DB.set('session',u.id);return{u}},
 login(email,password){const u=UserService.all().find(u=>u.email===email&&u.password===password);
  if(!u)return{error:'Email or password is incorrect.'};DB.set('session',u.id);return{u}},
 google(name,email,role){let u=UserService.all().find(u=>u.email===email);
  if(!u){u={id:uid(),name,email,role,google:true};DB.set('users',[...UserService.all(),u])}DB.set('session',u.id);return u},
 logout:()=>DB.set('session',null)
};

/* --- Task & Activity Service --- */
const TYPES={quiz:{l:'Quiz',c:'#8a4fd6'},assignment:{l:'Assignment',c:'#3f7cf4'},activity:{l:'Activity',c:'#e08a00'},personal:{l:'Personal',c:'#2f9e63'}};
const TaskService={
 all:()=>DB.get('tasks',[]),
 forUser:u=>TaskService.all().filter(t=>u.role==='instructor'?t.owner===u.id:(t.type!=='personal'||t.owner===u.id)),
 sorted:l=>[...l].sort((a,b)=>new Date(a.due)-new Date(b.due)),
 save(t){const l=TaskService.all();const i=l.findIndex(x=>x.id===t.id);i>=0?l[i]=t:l.push(t);DB.set('tasks',l)},
 remove(id){DB.set('tasks',TaskService.all().filter(t=>t.id!==id))}
};

/* --- Submission Service --- */
const SubmissionService={
 all:()=>DB.get('subs',{}),
 get:(tid,sid)=>SubmissionService.all()[tid+':'+sid],
 set(tid,sid,v){const s=SubmissionService.all();v?s[tid+':'+sid]=v:delete s[tid+':'+sid];DB.set('subs',s)},
 isDone:(tid,sid)=>!!SubmissionService.get(tid,sid)
};

/* --- Progress & Reward Service --- */
const PETS={plant:['🌰','🌱','🌿','🪴','🌳'],pet:['🥚','🐣','🐥','🐔','🦚']};
const STEPS=[0,1,3,6,10];
const RewardService={
 done:sid=>Object.keys(SubmissionService.all()).filter(k=>k.endsWith(':'+sid)).length,
 choice:sid=>DB.get('pet_'+sid,'plant'),setChoice:(sid,c)=>DB.set('pet_'+sid,c),
 stage:n=>STEPS.filter(s=>n>=s).length-1,
 next:n=>STEPS.find(s=>s>n)
};

/* --- Notification Service (alarm-style reminders) --- */
const NotificationService={
 log:sid=>DB.get('notes_'+sid,[]),
 beep(){try{const c=new(window.AudioContext||window.webkitAudioContext)();[0,.22,.44].forEach(t=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.08;o.connect(g);g.connect(c.destination);o.start(c.currentTime+t);o.stop(c.currentTime+t+.12)})}catch{}},
 tick(u){
  if(u.role!=='student')return;
  const seen=DB.get('fired_'+u.id,{}),log=NotificationService.log(u.id);let fired=false;
  TaskService.forUser(u).filter(t=>!SubmissionService.isDone(t.id,u.id)).forEach(t=>{
   const ms=new Date(t.due)-Date.now();
   const rules=[['before',ms<=864e5&&ms>0,'Due within 24 hours'],['due',ms<=0&&ms>-36e5,'Deadline reached']];
   rules.forEach(([k,hit,msg])=>{const key=t.id+k;if(hit&&!seen[key]){seen[key]=1;fired=true;
     log.unshift({title:t.title,msg,at:Date.now(),k});toast(k,t.title,msg);
     try{if(Notification.permission==='granted')new Notification('Study Space: '+t.title,{body:msg})}catch{}}})});
  if(fired){DB.set('fired_'+u.id,seen);DB.set('notes_'+u.id,log.slice(0,40));NotificationService.beep();updateBell()}
 }
};
function toast(k,title,msg){const el=document.createElement('div');el.className='toast '+k;el.innerHTML=`<b>⏰ ${esc(title)}</b>${esc(msg)}`;$('#toasts').append(el);setTimeout(()=>el.remove(),9000)}

/* --- Dashboard Service --- */
const DashboardService={
 student(u){const l=TaskService.forUser(u),d=l.filter(t=>SubmissionService.isDone(t.id,u.id)),p=l.filter(t=>!SubmissionService.isDone(t.id,u.id));
  const today=p.filter(t=>new Date(t.due).toDateString()===new Date().toDateString()).length;
  return{total:l.length,done:d.length,pending:p.length,today,late:p.filter(t=>new Date(t.due)<Date.now()).length,next:TaskService.sorted(p).slice(0,3)}},
 students:()=>UserService.all().filter(u=>u.role==='student')
};

/* ===================== UI ===================== */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S={view:'dashboard',filter:'all',hideDone:false,mode:'login',role:'student',err:''};
const fmt=d=>new Date(d).toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function rel(d){const ms=new Date(d)-Date.now(),a=Math.abs(ms),m=Math.round(a/6e4),h=Math.round(a/36e5),dd=Math.round(a/864e5);const t=m<60?m+' min':h<48?h+' hr':dd+' days';return ms<0?'Overdue by '+t:'Due in '+t}
const urg=d=>{const ms=new Date(d)-Date.now();return ms<0?'late':ms<864e5?'soon':''};

function render(){
 const u=UserService.me();
 if(!u){$('#root').innerHTML=loginView();return}
 const nav=u.role==='student'?[['dashboard','🏠','Home'],['tasks','📋','Tasks'],['garden','🌱','Garden']]:[['dashboard','🏠','Home'],['tasks','📋','My tasks'],['monitor','📊','Progress']];
 if(!nav.some(n=>n[0]===S.view))S.view='dashboard';
 const v={dashboard:u.role==='student'?studentHome:instructorHome,tasks:tasksView,garden:gardenView,monitor:monitorView}[S.view](u);
 $('#root').innerHTML=`<div class="app"><aside><div class="brand">🌱 Study Space</div>
  ${nav.map(n=>`<button class="nav ${S.view===n[0]?'on':''}" onclick="go('${n[0]}')">${n[1]} ${n[2]}</button>`).join('')}
  <div class="who"><b>${esc(u.name)}</b><br>${u.role==='student'?'Student':'Instructor'}<br><button class="btn ghost sm" style="color:#fff;border-color:#ffffff55;margin-top:.5rem" onclick="logout()">Log out</button></div></aside>
  <main>${v}</main></div>`;
 updateBell();
}
const go=v=>{S.view=v;render()};
function bellBtn(u){if(u.role!=='student')return'';const n=NotificationService.log(u.id).length;return`<button class="btn ghost" id="bell" onclick="showNotes()" aria-label="Reminders">🔔 <span id="bn">${n}</span></button>`}
function updateBell(){const u=UserService.me();if(u&&$('#bn'))$('#bn').textContent=NotificationService.log(u.id).length}

/* ---- Login ---- */
function loginView(){const reg=S.mode==='register';
 return`<div class="login"><div class="card"><h1>🌱 Study Space</h1><p style="color:var(--mute);margin:.3rem 0 0">Know what's due next. Grow something while you do it.</p>
 <div class="seg"><button class="tab ${S.role==='student'?'on':''}" onclick="S.role='student';render()">I'm a student</button><button class="tab ${S.role==='instructor'?'on':''}" onclick="S.role='instructor';render()">I'm an instructor</button></div>
 <button class="btn ghost" style="width:100%;margin-top:.8rem" onclick="googleLogin()">Continue with Google</button><div class="or">or use email</div>
 ${reg?`<label for="nm">Full name</label><input id="nm" autocomplete="name">`:''}
 <label for="em">Email</label><input id="em" type="email" autocomplete="email"><label for="pw">Password</label><input id="pw" type="password" autocomplete="${reg?'new':'current'}-password">
 <div class="err" id="err">${esc(S.err)}</div>
 <button class="btn" style="width:100%" onclick="${reg?'doRegister()':'doLogin()'}">${reg?'Create account':'Log in'}</button>
 <p style="text-align:center;margin:1rem 0 0"><button class="tab" onclick="S.mode='${reg?'login':'register'}';S.err='';render()">${reg?'I already have an account':'Create an account'}</button> <button class="tab" onclick="loadDemo()">Try demo data</button></p></div></div>`}
function doLogin(){const r=UserService.login($('#em').value.trim(),$('#pw').value);r.error?(S.err=r.error,render()):afterLogin()}
function doRegister(){const r=UserService.register({name:$('#nm').value.trim(),email:$('#em').value.trim(),password:$('#pw').value,role:S.role});r.error?(S.err=r.error,render()):afterLogin()}
function googleLogin(){const name=prompt('Demo Google sign-in. Your name:');if(!name)return;const email=prompt('Your Google email:');if(!email)return;UserService.google(name,email,S.role);afterLogin()}
function afterLogin(){S.err='';S.view='dashboard';try{Notification.requestPermission()}catch{}render();NotificationService.tick(UserService.me())}
function logout(){UserService.logout();render()}

/* ---- Student home ---- */
function studentHome(u){const s=DashboardService.student(u),n=RewardService.done(u.id),st=RewardService.stage(n),c=RewardService.choice(u.id),nx=RewardService.next(n);
 return`<div class="top"><div><h2>Hi ${esc(u.name.split(' ')[0])}</h2><p>${s.pending?`${s.pending} task${s.pending>1?'s':''} left${s.today?`, ${s.today} due today`:''}.`:'You\'re all caught up. Nice.'}</p></div>${bellBtn(u)}</div>
 <div class="grid g3"><div class="card stat"><b>${s.pending}</b><span>To do</span></div><div class="card stat"><b style="color:var(--hot)">${s.late}</b><span>Overdue</span></div><div class="card stat"><b>${s.done}</b><span>Completed</span></div></div>
 <div class="grid g2" style="margin-top:1rem"><div class="card pet"><div class="big">${PETS[c][st]}</div><div><h3>Your ${c==='plant'?'plant':'pet'}</h3><p style="margin:.2rem 0 .5rem">${nx?`${nx-n} more task${nx-n>1?'s':''} to grow it`:'Fully grown. Legend.'}</p><button class="btn sm" onclick="go('garden')">Open garden</button></div></div>
 <div class="card"><h3 style="margin-bottom:.7rem">Up next</h3>${s.next.length?s.next.map(t=>`<div style="display:flex;justify-content:space-between;gap:.6rem;padding:.4rem 0;border-bottom:1px solid var(--line)"><span><span class="chip" style="--c:${TYPES[t.type].c}">${TYPES[t.type].l}</span> ${esc(t.title)}</span><span class="due ${urg(t.due)}">${rel(t.due)}</span></div>`).join(''):'<div class="empty"><div class="e">🎉</div>Nothing pending.</div>'}</div></div>`}

/* ---- Instructor home ---- */
function instructorHome(u){const l=TaskService.forUser(u),sts=DashboardService.students(),up=TaskService.sorted(l.filter(t=>new Date(t.due)>Date.now())).slice(0,4);
 const comp=l.reduce((a,t)=>a+sts.filter(s=>SubmissionService.isDone(t.id,s.id)).length,0),tot=l.length*sts.length;
 return`<div class="top"><div><h2>Hello, ${esc(u.name.split(' ')[0])}</h2><p>Here's how your classes are doing.</p></div><button class="btn" onclick="taskDialog()">+ New task</button></div>
 <div class="grid g3"><div class="card stat"><b>${l.length}</b><span>Tasks created</span></div><div class="card stat"><b>${sts.length}</b><span>Students</span></div><div class="card stat"><b>${tot?Math.round(comp/tot*100):0}%</b><span>Overall completion</span></div></div>
 <div class="card" style="margin-top:1rem"><h3 style="margin-bottom:.7rem">Coming up</h3>${up.length?up.map(t=>`<div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--line)"><span><span class="chip" style="--c:${TYPES[t.type].c}">${TYPES[t.type].l}</span> ${esc(t.title)}</span><span class="due">${fmt(t.due)}</span></div>`).join(''):'<div class="empty"><div class="e">📝</div>Create your first quiz or assignment.</div>'}</div>`}

/* ---- Tasks ---- */
function tasksView(u){const stu=u.role==='student';let l=TaskService.sorted(TaskService.forUser(u));
 if(S.filter!=='all')l=l.filter(t=>t.type===S.filter);if(stu&&S.hideDone)l=l.filter(t=>!SubmissionService.isDone(t.id,u.id));
 const tabs=['all',...(stu?Object.keys(TYPES):['quiz','assignment','activity'])];
 return`<div class="top"><div><h2>${stu?'All tasks':'My tasks'}</h2><p>Sorted by nearest deadline.</p></div><div style="display:flex;gap:.5rem">${stu?bellBtn(u):''}<button class="btn" onclick="taskDialog()">+ ${stu?'Add personal task':'New task'}</button></div></div>
 <div class="tabs">${tabs.map(f=>`<button class="tab ${S.filter===f?'on':''}" onclick="S.filter='${f}';render()">${f==='all'?'All':TYPES[f].l+'s'}</button>`).join('')}${stu?`<button class="tab ${S.hideDone?'on':''}" onclick="S.hideDone=!S.hideDone;render()">Hide completed</button>`:''}</div>
 ${l.length?l.map(t=>taskCard(t,u)).join(''):'<div class="card empty"><div class="e">📭</div>No tasks here yet. Use the button above to add one.</div>'}`}
function taskCard(t,u){const stu=u.role==='student',sub=stu&&SubmissionService.get(t.id,u.id),own=t.owner===u.id,ty=TYPES[t.type];
 const sts=DashboardService.students(),dn=sts.filter(s=>SubmissionService.isDone(t.id,s.id)).length;
 let acts='';
 if(stu){acts=sub?`<span class="chip" style="--c:var(--leaf)">${sub.kind==='submitted'?'Submitted':'Completed'}</span><button class="btn ghost sm" onclick="undo('${t.id}')">Undo</button>`
  :(t.type==='assignment'?`<button class="btn sm" onclick="submitDialog('${t.id}')">Submit work</button><button class="btn ghost sm" onclick="complete('${t.id}')">Mark done</button>`:`<button class="btn sm" onclick="complete('${t.id}')">Mark done</button>`)}
 else acts=`<span class="meta">${dn}/${sts.length} done</span>`;
 if(own)acts+=`<button class="btn ghost sm" onclick="taskDialog('${t.id}')">Edit</button><button class="btn danger sm" onclick="removeTask('${t.id}')">Delete</button>`;
 return`<div class="card task ${sub?'done':''}" style="--c:${ty.c}"><div class="stripe"></div><div><h3>${esc(t.title)}</h3>
 <div class="meta"><span class="chip">${ty.l}</span>${t.course?`<span>${esc(t.course)}</span>`:''}<span class="due ${sub?'':urg(t.due)}">${sub?fmt(t.due):rel(t.due)+' · '+fmt(t.due)}</span></div>${t.desc?`<div class="meta">${esc(t.desc)}</div>`:''}
 ${sub&&sub.note?`<div class="meta">Your note: ${esc(sub.note)}${sub.file?' · 📎 '+esc(sub.file):''}</div>`:''}</div><div class="acts">${acts}</div></div>`}

/* ---- Garden ---- */
function gardenView(u){const n=RewardService.done(u.id),c=RewardService.choice(u.id),st=RewardService.stage(n),nx=RewardService.next(n),prev=STEPS[st];
 return`<div class="top"><div><h2>Your garden</h2><p>Every completed task helps it grow.</p></div></div>
 <div class="card pet" style="flex-direction:column;text-align:center;padding:2rem"><div class="big" style="font-size:7rem">${PETS[c][st]}</div><h3>Stage ${st+1} of ${STEPS.length}</h3>
 <div style="width:min(320px,100%)"><div class="bar"><i style="width:${nx?Math.round((n-prev)/(nx-prev)*100):100}%"></i></div><p style="margin:.5rem 0 0">${nx?`${nx-n} more to reach the next stage`:'Fully grown!'} · ${n} done</p></div>
 <div class="stages">${PETS[c].map((e,i)=>`<span class="${i<=st?'got':''}">${e}</span>`).join('')}</div></div>
 <div class="card" style="margin-top:1rem"><h3 style="margin-bottom:.7rem">Choose what to grow</h3><div class="pick"><button class="${c==='plant'?'on':''}" onclick="pickPet('plant')">🌳 Plant</button><button class="${c==='pet'?'on':''}" onclick="pickPet('pet')">🐣 Pet</button></div></div>`}
const pickPet=c=>{RewardService.setChoice(UserService.me().id,c);render()};

/* ---- Instructor monitor ---- */
function monitorView(u){const l=TaskService.sorted(TaskService.forUser(u)),sts=DashboardService.students();
 return`<div class="top"><div><h2>Student progress</h2><p>See who has finished each task.</p></div></div>
 ${!sts.length?'<div class="card empty"><div class="e">🧑‍🎓</div>No students have joined yet.</div>':`
 <div class="card"><h3 style="margin-bottom:.6rem">By student</h3>${sts.map(s=>{const d=l.filter(t=>SubmissionService.isDone(t.id,s.id)).length,p=l.length?Math.round(d/l.length*100):0;return`<div style="margin:.7rem 0"><div style="display:flex;justify-content:space-between"><b>${esc(s.name)}</b><span class="meta">${d}/${l.length} · ${p}%</span></div><div class="bar"><i style="width:${p}%"></i></div></div>`}).join('')}</div>
 <div class="card table-wrap" style="margin-top:1rem"><h3 style="margin-bottom:.6rem">By task</h3><table><tr><th>Task</th><th>Due</th>${sts.map(s=>`<th>${esc(s.name.split(' ')[0])}</th>`).join('')}</tr>
 ${l.map(t=>`<tr><td>${esc(t.title)}</td><td>${fmt(t.due)}</td>${sts.map(s=>{const x=SubmissionService.get(t.id,s.id);return`<td title="${x?esc(x.note||''):''}">${x?(x.kind==='submitted'?'📎 Submitted':'✅ Done'):(new Date(t.due)<Date.now()?'⚠️ Missing':'⏳ Pending')}</td>`}).join('')}</tr>`).join('')}</table></div>`}`}

/* ---- Actions & dialogs ---- */
const dlg=()=>$('#dlg');
function toLocal(d){const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,16)}
function taskDialog(id){const u=UserService.me(),t=id?TaskService.all().find(x=>x.id===id):{type:u.role==='student'?'personal':'assignment',due:new Date(Date.now()+864e5*2).toISOString()};
 const types=u.role==='student'?['personal']:['quiz','assignment','activity'];
 dlg().innerHTML=`<h3>${id?'Edit':'New'} ${u.role==='student'?'personal task':'task'}</h3>
 <label for="tt">Title</label><input id="tt" value="${esc(t.title||'')}">
 ${u.role==='student'?'':`<label for="ty">Type</label><select id="ty">${types.map(k=>`<option value="${k}" ${t.type===k?'selected':''}>${TYPES[k].l}</option>`).join('')}</select><label for="tc">Course</label><input id="tc" value="${esc(t.course||'')}" placeholder="e.g. Biology 101">`}
 <label for="td">Deadline</label><input id="td" type="datetime-local" value="${toLocal(t.due)}">
 <label for="tx">Details (optional)</label><textarea id="tx" rows="3">${esc(t.desc||'')}</textarea><div class="err" id="derr"></div>
 <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem"><button class="btn ghost" onclick="dlg().close()">Cancel</button><button class="btn" onclick="saveTask('${id||''}')">Save task</button></div>`;dlg().showModal()}
function saveTask(id){const u=UserService.me(),title=$('#tt').value.trim(),due=$('#td').value;
 if(!title||!due){$('#derr').textContent='Add a title and a deadline.';return}
 const old=id?TaskService.all().find(x=>x.id===id):{};
 TaskService.save({...old,id:id||uid(),title,due:new Date(due).toISOString(),desc:$('#tx').value.trim(),owner:u.id,type:u.role==='student'?'personal':$('#ty').value,course:u.role==='student'?'':$('#tc').value.trim()});
 dlg().close();render();NotificationService.tick(u)}
function removeTask(id){if(confirm('Delete this task? This can\'t be undone.')){TaskService.remove(id);render()}}
function submitDialog(id){const t=TaskService.all().find(x=>x.id===id);
 dlg().innerHTML=`<h3>Submit: ${esc(t.title)}</h3><label for="sf">Attach your file</label><input id="sf" type="file"><label for="sn">Note to instructor (optional)</label><textarea id="sn" rows="3"></textarea>
 <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem"><button class="btn ghost" onclick="dlg().close()">Cancel</button><button class="btn" onclick="submitWork('${id}')">Submit work</button></div>`;dlg().showModal()}
function submitWork(id){const u=UserService.me(),f=$('#sf').files[0];
 SubmissionService.set(id,u.id,{kind:'submitted',at:Date.now(),note:$('#sn').value.trim(),file:f?f.name:''});dlg().close();celebrate(u)}
function complete(id){const u=UserService.me();SubmissionService.set(id,u.id,{kind:'done',at:Date.now()});celebrate(u)}
function undo(id){SubmissionService.set(id,UserService.me().id,null);render()}
function celebrate(u){const before=RewardService.stage(RewardService.done(u.id)-1),after=RewardService.stage(RewardService.done(u.id));render();
 const el=document.createElement('div');el.className='toast';el.style.borderColor='var(--leaf)';el.innerHTML=after>before?`<b>🎉 Your ${RewardService.choice(u.id)} grew!</b>Keep it going.`:'<b>✅ Task done</b>Your garden is one step closer.';$('#toasts').append(el);setTimeout(()=>el.remove(),4000)}
function showNotes(){const u=UserService.me(),l=NotificationService.log(u.id);
 dlg().innerHTML=`<h3>Reminders</h3>${l.length?l.map(n=>`<div style="padding:.5rem 0;border-bottom:1px solid var(--line)"><b>${esc(n.title)}</b><div class="meta">${esc(n.msg)} · ${new Date(n.at).toLocaleString()}</div></div>`).join(''):'<div class="empty"><div class="e">🔕</div>No reminders yet. You\'ll get one 24 hours before a deadline and again when it arrives.</div>'}
 <div style="text-align:right;margin-top:.8rem"><button class="btn" onclick="dlg().close()">Close</button></div>`;dlg().showModal()}

/* ---- Demo data ---- */
function loadDemo(){
 const ins={id:'demo-i',name:'Ms. Rivera',email:'instructor@demo.com',password:'demo123',role:'instructor'},stu={id:'demo-s',name:'Alex Santos',email:'student@demo.com',password:'demo123',role:'student'},st2={id:'demo-s2',name:'Mia Cruz',email:'mia@demo.com',password:'demo123',role:'student'};
 DB.set('users',[ins,stu,st2]);const h=36e5,n=Date.now();
 DB.set('tasks',[{id:'d1',title:'Cell Structure Quiz',type:'quiz',course:'Biology 101',due:new Date(n+5*h).toISOString(),desc:'Chapters 3 and 4',owner:ins.id},
  {id:'d2',title:'Lab Report: Osmosis',type:'assignment',course:'Biology 101',due:new Date(n+30*h).toISOString(),desc:'Upload as PDF',owner:ins.id},
  {id:'d3',title:'Essay Outline',type:'assignment',course:'English 10',due:new Date(n+72*h).toISOString(),owner:ins.id},
  {id:'d4',title:'Group Presentation Practice',type:'activity',course:'English 10',due:new Date(n+120*h).toISOString(),owner:ins.id},
  {id:'d5',title:'Algebra Midterm',type:'quiz',course:'Math 9',due:new Date(n-3*h).toISOString(),owner:ins.id},
  {id:'p1',title:'Review flashcards',type:'personal',due:new Date(n+20*h).toISOString(),owner:stu.id}]);
 DB.set('subs',{'d5:demo-s':{kind:'done',at:n},'d2:demo-s2':{kind:'submitted',at:n,note:'Done!',file:'osmosis.pdf'}});
 DB.set('session',stu.id);DB.set('fired_demo-s',{});DB.set('notes_demo-s',[]);S.view='dashboard';render();NotificationService.tick(stu)}

render();
setInterval(()=>{const u=UserService.me();if(u)NotificationService.tick(u)},30000);
if(UserService.me())NotificationService.tick(UserService.me());
