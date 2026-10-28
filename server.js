/* STUDY SPACE server
   - accounts: email + password, Google, NVSU uConnect (OAuth2/OIDC)
   - tasks, submissions, photo/video/file uploads
   - data lives in ./data (db.json + uploads/). Back that folder up. */
try{require('dotenv').config()}catch{}
const express=require('express'),multer=require('multer'),crypto=require('crypto'),fs=require('fs'),path=require('path');

const E=process.env,PORT=+E.PORT||3000,BASE_URL=(E.BASE_URL||`http://localhost:${PORT}`).replace(/\/$/,'');
const GOOGLE_CLIENT_ID=E.GOOGLE_CLIENT_ID||'',MAX_MB=+E.MAX_UPLOAD_MB||200;
const INSTRUCTORS=(E.INSTRUCTOR_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
const U={AUTH:E.UCONNECT_AUTH_URL,TOKEN:E.UCONNECT_TOKEN_URL,INFO:E.UCONNECT_USERINFO_URL,ID:E.UCONNECT_CLIENT_ID,SECRET:E.UCONNECT_CLIENT_SECRET,SCOPE:E.UCONNECT_SCOPE||'openid email profile'};
const uOn=!!(U.AUTH&&U.TOKEN&&U.INFO&&U.ID&&U.SECRET);

/* ---------- storage ---------- */
const DATA=path.join(__dirname,'data'),UP=path.join(DATA,'uploads'),DBF=path.join(DATA,'db.json'),SF=path.join(DATA,'secret.key');
fs.mkdirSync(UP,{recursive:true});
let db={users:[],tasks:[],subs:{}};
try{db={...db,...JSON.parse(fs.readFileSync(DBF,'utf8'))}}catch{}
const save=()=>{const t=DBF+'.tmp';fs.writeFileSync(t,JSON.stringify(db));fs.renameSync(t,DBF)};
let SECRET;try{SECRET=fs.readFileSync(SF,'utf8')}catch{SECRET=crypto.randomBytes(32).toString('hex');fs.writeFileSync(SF,SECRET,{mode:0o600})}
const uid=()=>crypto.randomBytes(5).toString('hex');
const rmFiles=l=>(l||[]).forEach(f=>fs.unlink(path.join(UP,f.id),()=>{}));

/* ---------- sessions (signed cookie) ---------- */
const sign=s=>crypto.createHmac('sha256',SECRET).update(s).digest('base64url');
const mkToken=id=>{const p=id+'.'+(Date.now()+30*864e5);return p+'.'+sign(p)};
function readToken(t){const a=(t||'').split('.');if(a.length!==3)return null;const g=Buffer.from(a[2]),s=Buffer.from(sign(a[0]+'.'+a[1]));
 if(g.length!==s.length||!crypto.timingSafeEqual(g,s)||+a[1]<Date.now())return null;return a[0]}
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(c=>{const i=c.indexOf('=');return i<0?[]:[c.slice(0,i).trim(),decodeURIComponent(c.slice(i+1).trim())]}).filter(a=>a[0]));
const login=(res,id)=>res.cookie('sid',mkToken(id),{httpOnly:true,sameSite:'lax',secure:BASE_URL.startsWith('https'),maxAge:30*864e5});

/* ---------- helpers ---------- */
const hashPw=(pw,salt)=>crypto.scryptSync(pw,salt,64);
const roleFor=(email,want)=>want!=='instructor'?'student':(INSTRUCTORS.length&&!INSTRUCTORS.includes(email)?null:'instructor');
const me_=u=>({id:u.id,name:u.name,email:u.email,role:u.role,via:u.via,pet:u.pet||'plant'});
function social(via,name,email,want){let u=db.users.find(x=>x.email===email);
 if(!u){const role=roleFor(email,want);if(!role)return null;u={id:uid(),name:name||email.split('@')[0],email,role,via};db.users.push(u);save()}return u}

/* ---------- uploads ---------- */
const ALLOWED=/\.(jpe?g|png|gif|webp|heic|mp4|webm|mov|m4v|mp3|wav|m4a|pdf|docx?|pptx?|xlsx?|txt|zip)$/i;
const INLINE=/\.(jpe?g|png|gif|webp|mp4|webm|mov|m4v|mp3|wav|m4a|pdf)$/i;
const upload=multer({
 storage:multer.diskStorage({destination:UP,filename:(q,f,cb)=>cb(null,crypto.randomBytes(8).toString('hex')+path.extname(f.originalname).toLowerCase())}),
 limits:{fileSize:MAX_MB*1048576,files:10},
 fileFilter:(q,f,cb)=>ALLOWED.test(f.originalname)?cb(null,true):cb(new Error('That file type is not supported. Use photos, videos, PDFs, Office files, text or zip.'))});
const meta=f=>({id:f.filename,name:Buffer.from(f.originalname,'latin1').toString('utf8'),type:f.mimetype,size:f.size});

/* ---------- app ---------- */
const app=express();
app.disable('x-powered-by');
app.use((q,r,n)=>{r.setHeader('X-Content-Type-Options','nosniff');r.setHeader('Referrer-Policy','same-origin');n()});
app.use(express.json({limit:'100kb'}));
app.use((req,res,next)=>{req.user=db.users.find(u=>u.id===readToken(cookies(req).sid))||null;next()});
const need=(req,res,next)=>req.user?next():res.status(401).json({error:'Please log in.'});
const config=()=>({google:GOOGLE_CLIENT_ID||null,uconnect:uOn,maxMB:MAX_MB});

app.get('/api/state',(req,res)=>{
 const me=req.user;if(!me)return res.json({me:null,users:[],tasks:[],subs:{},config:config()});
 const tasks=db.tasks.filter(t=>t.type!=='personal'||t.owner===me.id),byId=Object.fromEntries(tasks.map(t=>[t.id,t]));
 const subs={};
 for(const [k,s] of Object.entries(db.subs)){const [tid,sid]=k.split(':'),t=byId[tid];if(!t)continue;
  subs[k]=(sid===me.id||t.owner===me.id)?s:{kind:s.kind,at:s.at}}
 res.json({me:me_(me),users:db.users.map(u=>({id:u.id,name:u.name,role:u.role})),tasks,subs,config:config()})});

/* ---- accounts ---- */
app.post('/api/register',(req,res)=>{
 const b=req.body||{},name=String(b.name||'').trim(),em=String(b.email||'').trim().toLowerCase(),pw=String(b.password||'');
 if(!name||!/^\S+@\S+\.\S+$/.test(em)||pw.length<6)return res.status(400).json({error:'Enter your name, a valid email, and a password of 6+ characters.'});
 if(db.users.some(u=>u.email===em))return res.status(409).json({error:'That email already has an account. Log in instead.'});
 const role=roleFor(em,b.role);if(!role)return res.status(403).json({error:'Instructor accounts are limited to approved emails.'});
 const salt=crypto.randomBytes(16).toString('hex'),u={id:uid(),name,email:em,role,via:'email',salt,hash:hashPw(pw,salt).toString('hex')};
 db.users.push(u);save();login(res,u.id);res.json({ok:true})});

app.post('/api/login',(req,res)=>{
 const b=req.body||{},em=String(b.email||'').trim().toLowerCase(),u=db.users.find(x=>x.email===em);
 if(u&&!u.hash)return res.status(400).json({error:`This account uses ${u.via==='google'?'Google':'NVSU uConnect'}. Use that button to sign in.`});
 const ok=u&&crypto.timingSafeEqual(hashPw(String(b.password||''),u.salt),Buffer.from(u.hash,'hex'));
 if(!ok)return res.status(401).json({error:'Email or password is incorrect.'});
 login(res,u.id);res.json({ok:true})});

app.post('/api/logout',(req,res)=>{res.clearCookie('sid');res.json({ok:true})});

app.post('/api/auth/google',async(req,res)=>{
 if(!GOOGLE_CLIENT_ID)return res.status(501).json({error:'Google sign-in is not set up yet.'});
 try{const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent((req.body||{}).credential||'')),g=await r.json();
  if(!r.ok||g.aud!==GOOGLE_CLIENT_ID||String(g.email_verified)!=='true'||!g.email)throw 0;
  const u=social('google',g.name,g.email.toLowerCase(),(req.body||{}).role);
  if(!u)return res.status(403).json({error:'Instructor accounts are limited to approved emails.'});
  login(res,u.id);res.json({ok:true})}
 catch{res.status(401).json({error:'Google sign-in failed. Try again.'})}});

/* ---- NVSU uConnect (standard OAuth2 / OpenID Connect; fill UCONNECT_* in .env) ---- */
const REDIRECT=BASE_URL+'/auth/uconnect/callback';
app.get('/auth/uconnect',(req,res)=>{
 if(!uOn)return res.redirect('/?err=uconnect');
 const st=crypto.randomBytes(12).toString('hex'),role=req.query.role==='instructor'?'instructor':'student';
 res.cookie('ostate',st+':'+role,{httpOnly:true,sameSite:'lax',maxAge:6e5});
 const q=new URLSearchParams({response_type:'code',client_id:U.ID,redirect_uri:REDIRECT,scope:U.SCOPE,state:st});
 res.redirect(U.AUTH+(U.AUTH.includes('?')?'&':'?')+q)});
app.get('/auth/uconnect/callback',async(req,res)=>{
 try{const [st,role]=(cookies(req).ostate||'').split(':');res.clearCookie('ostate');
  if(!uOn||!st||st!==req.query.state||!req.query.code)throw 0;
  const t=await(await fetch(U.TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({grant_type:'authorization_code',code:req.query.code,redirect_uri:REDIRECT,client_id:U.ID,client_secret:U.SECRET})})).json();
  if(!t.access_token)throw 0;
  const p=await(await fetch(U.INFO,{headers:{Authorization:'Bearer '+t.access_token}})).json(),email=String(p.email||'').toLowerCase();
  if(!email)throw 0;
  const u=social('uconnect',p.name||p.given_name,email,role);
  if(!u)return res.redirect('/?err=role');
  login(res,u.id);res.redirect('/')}
 catch{res.redirect('/?err=uconnect')}});

app.post('/api/me/pet',need,(req,res)=>{const p=(req.body||{}).pet;if(!['plant','pet'].includes(p))return res.sendStatus(400);req.user.pet=p;save();res.json({ok:true})});

/* ---- tasks ---- */
app.post('/api/tasks',need,upload.array('files',10),(req,res)=>{
 const b=req.body||{},me=req.user,files=req.files||[],drop=()=>files.forEach(f=>fs.unlink(f.path,()=>{}));
 const title=String(b.title||'').trim(),due=new Date(b.due);
 if(!title||isNaN(due)){drop();return res.status(400).json({error:'Add a title and a deadline.'})}
 let t=b.id?db.tasks.find(x=>x.id===b.id):null;
 if(b.id&&(!t||t.owner!==me.id)){drop();return res.status(403).json({error:'You can only edit your own tasks.'})}
 const stu=me.role==='student',type=stu?'personal':(['quiz','assignment','activity'].includes(b.type)?b.type:'assignment');
 if(!t){t={id:uid(),owner:me.id,files:[]};db.tasks.push(t)}
 const gone=[].concat(b.remove||[]);rmFiles(t.files.filter(f=>gone.includes(f.id)));
 Object.assign(t,{title:title.slice(0,200),due:due.toISOString(),desc:String(b.desc||'').trim().slice(0,2000),type,course:stu?'':String(b.course||'').trim().slice(0,80),
  files:[...t.files.filter(f=>!gone.includes(f.id)),...files.map(meta)]});
 save();res.json({ok:true})});

app.delete('/api/tasks/:id',need,(req,res)=>{
 const t=db.tasks.find(x=>x.id===req.params.id);if(!t||t.owner!==req.user.id)return res.status(404).json({error:'Task not found.'});
 rmFiles(t.files);for(const k of Object.keys(db.subs))if(k.startsWith(t.id+':')){rmFiles(db.subs[k].files);delete db.subs[k]}
 db.tasks=db.tasks.filter(x=>x!==t);save();res.json({ok:true})});

/* ---- submissions ---- */
app.post('/api/subs',need,upload.array('files',10),(req,res)=>{
 const b=req.body||{},me=req.user,files=req.files||[],bad=(c,m)=>{files.forEach(f=>fs.unlink(f.path,()=>{}));return res.status(c).json({error:m})};
 if(me.role!=='student')return bad(403,'Only students can complete tasks.');
 const t=db.tasks.find(x=>x.id===b.taskId);if(!t||(t.type==='personal'&&t.owner!==me.id))return bad(404,'Task not found.');
 const k=t.id+':'+me.id;rmFiles((db.subs[k]||{}).files);
 db.subs[k]={kind:(files.length||b.kind==='submitted')?'submitted':'done',at:Date.now(),note:String(b.note||'').trim().slice(0,1000),files:files.map(meta)};
 save();res.json({ok:true})});

app.delete('/api/subs/:taskId',need,(req,res)=>{
 const k=req.params.taskId+':'+req.user.id;if(db.subs[k]){rmFiles(db.subs[k].files);delete db.subs[k];save()}res.json({ok:true})});

/* ---- files (only people allowed to see the task/submission) ---- */
app.get('/files/:id',need,(req,res)=>{
 const id=req.params.id,me=req.user;if(!/^[a-f0-9]{16}\.[a-z0-9]+$/i.test(id))return res.sendStatus(404);
 let f=null;
 for(const t of db.tasks){const x=(t.files||[]).find(q=>q.id===id);if(x&&(t.type!=='personal'||t.owner===me.id)){f=x;break}}
 if(!f)for(const [k,s] of Object.entries(db.subs)){const x=(s.files||[]).find(q=>q.id===id);
  if(x){const [tid,sid]=k.split(':'),t=db.tasks.find(q=>q.id===tid);if(sid===me.id||(t&&t.owner===me.id)){f=x;break}}}
 if(!f)return res.sendStatus(404);
 res.setHeader('Content-Disposition',(INLINE.test(id)&&!req.query.dl?'inline':'attachment')+`; filename*=UTF-8''${encodeURIComponent(f.name)}`);
 res.sendFile(path.join(UP,id))});

app.use(express.static(path.join(__dirname,'public')));
app.use('/api',(q,r)=>r.status(404).json({error:'Not found.'}));
app.use((err,req,res,next)=>res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?`Each file must be under ${MAX_MB} MB.`:(err.message||'Upload failed.')}));

app.listen(PORT,()=>console.log(`Study Space running at ${BASE_URL}  |  Google: ${GOOGLE_CLIENT_ID?'on':'off'}  |  uConnect: ${uOn?'on':'off'}`));
