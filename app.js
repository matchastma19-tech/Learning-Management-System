function render(){
 const u=UserService.me();
 if(!u){S.last=null;$('#root').innerHTML=loginView();return}
 const nav=u.role==='student'?[['dashboard','🏠','Home'],['tasks','📋','Tasks'],['garden','🌱','Garden'],['ranks','🏆','Ranks']]:[['dashboard','🏠','Home'],['tasks','📋','Tasks'],['monitor','📊','Progress'],['ranks','🏆','Ranks']];
 if(!nav.some(n=>n[0]===S.view))S.view='dashboard';
 const v={dashboard:u.role==='student'?studentHome:instructorHome,tasks:tasksView,garden:gardenView,monitor:monitorView,ranks:ranksView}[S.view](u);
 const enter=S.last!==S.view;S.last=S.view;
 const stu=u.role==='student',n=RewardService.done(u.id),me=stu&&RewardService.rankOf(u.id);
 const chips=stu?`<span class="chip2">⭐ Lv ${RewardService.level(n)}</span><span class="chip2">✅ ${n}</span>${badge(me?me.rank:'Warrior')}<button class="bell" onclick="showNotes()" aria-label="Reminders">🔔<em>${NotificationService.log(u.id).length}</em></button>`
  :`<span class="chip2">👩‍🏫 Instructor</span><span class="chip2">📝 ${TaskService.forUser(u).length} tasks</span>`;
 $('#root').innerHTML=`<div class="app"><aside><div class="brand">📚 Study Space</div>
  ${nav.map(x=>`<button class="nav ${S.view===x[0]?'on':''}" onclick="go('${x[0]}')">${x[1]} ${x[2]}</button>`).join('')}
  <div class="who"><b>${esc(u.name)}</b><br>${stu?'Student':'Instructor'}<br><button class="btn ghost sm" style="margin-top:.6rem" onclick="logout()">Log out</button></div></aside>
  <div class="col"><header class="topbar"><div class="tt">${nav.find(x=>x[0]===S.view)[2]}</div><div class="chips">${chips}</div></header>
  <main class="${enter?'enter':''}">${barHTML(u)}${v}</main></div></div>`}
const bellBtn=u=>'';
