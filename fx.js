/* STUDY SPACE effects: drifting network background, count-up numbers, confetti.
   All of it switches off for people who prefer reduced motion. */
const REDUCED=matchMedia('(prefers-reduced-motion:reduce)').matches;

/* Live background: soft drifting dots that link up when they pass close to each other */
(()=>{const c=document.getElementById('fx');if(REDUCED){c.remove();return}
 const x=c.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2);let w,h,P=[],on=true,rgb='23,32,46';
 const readColor=()=>{const v=getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
  const m=v.match(/^#([0-9a-f]{6})$/i);if(m){const n=parseInt(m[1],16);rgb=[n>>16,n>>8&255,n&255].join(',')}};
 const rs=()=>{w=innerWidth;h=innerHeight;c.width=w*dpr;c.height=h*dpr;x.setTransform(dpr,0,0,dpr,0,0);
  P=Array.from({length:Math.min(55,Math.round(w*h/26000))},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.28,vy:(Math.random()-.5)*.28,r:Math.random()*1.6+1}))};
 addEventListener('resize',rs);matchMedia('(prefers-color-scheme:dark)').addEventListener('change',readColor);readColor();rs();
 document.addEventListener('visibilitychange',()=>{on=!document.hidden;if(on)loop()});
 function loop(){if(!on)return;x.clearRect(0,0,w,h);
  for(let i=0;i<P.length;i++){const p=P[i];p.x+=p.vx;p.y+=p.vy;if(p.x<-10)p.x=w+10;if(p.x>w+10)p.x=-10;if(p.y<-10)p.y=h+10;if(p.y>h+10)p.y=-10;
   x.fillStyle=`rgba(${rgb},.28)`;x.beginPath();x.arc(p.x,p.y,p.r,0,6.283);x.fill();
   for(let j=i+1;j<P.length;j++){const q=P[j],d=Math.hypot(p.x-q.x,p.y-q.y);
    if(d<130){x.strokeStyle=`rgba(${rgb},${.14*(1-d/130)})`;x.lineWidth=1;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke()}}}
  requestAnimationFrame(loop)}
 loop()})();

/* Numbers on stat cards count up when a screen opens */
function countUp(){if(REDUCED)return;
 document.querySelectorAll('.stat b').forEach(b=>{const m=b.textContent.match(/^(\d+)(%?)$/);if(!m)return;
  const n=+m[1],t0=performance.now();b.textContent='0'+m[2];
  const step=t=>{const p=Math.min(1,(t-t0)/700),e=1-Math.pow(1-p,3);b.textContent=Math.round(n*e)+m[2];if(p<1)requestAnimationFrame(step)};
  requestAnimationFrame(step)})}

/* Confetti burst for level-ups */
function confetti(n=80){if(REDUCED)return;
 const c=document.getElementById('confetti'),x=c.getContext('2d'),cols=['#f0b429','#3fcfae','#8b5cf6','#2b8bd9','#ff6b84'];
 c.width=innerWidth;c.height=innerHeight;
 const P=Array.from({length:n},()=>({x:innerWidth/2+(Math.random()-.5)*140,y:innerHeight*.4,vx:(Math.random()-.5)*11,vy:-Math.random()*11-3,s:Math.random()*7+4,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[Math.random()*5|0]}));
 let f=0;(function loop(){x.clearRect(0,0,c.width,c.height);
  P.forEach(p=>{p.vy+=.35;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()});
  if(++f<120)requestAnimationFrame(loop);else x.clearRect(0,0,c.width,c.height)})()}
