// The book: cover, page turns, drag, swipe, tabs, contents and the pencil. tasks.js owns accounts and task data.
const $=selector=>document.querySelector(selector);
const body=document.body,book=$('#book'),cover=$('#cover'),main=$('main'),contents=$('#contents-page'),authPage=$('#auth-page'),toggle=$('#book-toggle'),note=$('#toc-note'),pagerLabel=$('#pager-label');
const allPages=[...document.querySelectorAll('#pages .page')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),narrow=matchMedia('(max-width: 820px)');
const single=()=>narrow.matches;
let pages=[],cur=0,isOpen=false,busy=false,wrote=false;

const list=()=>main.hidden?[contents,authPage]:[...main.querySelectorAll('.page')];
const step=()=>single()?1:2;
const snap=i=>single()?i:i-(i%2);
const shown=i=>single()?[pages[i]]:[pages[i],pages[i+1]];
const isRight=el=>single()||el.classList.contains('right');
// Signed out on a phone, the book opens straight to the sign-in page.
const firstPage=()=>single()&&main.hidden?1:0;

function paint(){
 pages=list();cur=Math.min(snap(cur),snap(pages.length-1));
 for(const el of [...allPages,cover]){el.classList.remove('is-shown');el.style.transform='';el.style.transformOrigin='';el.style.opacity='';el.style.removeProperty('--shade');el.style.removeProperty('--curl');el.inert=true;}
 if(!isOpen){cover.classList.add('is-shown');cover.inert=false;}
 else for(const el of shown(cur))if(el){el.classList.add('is-shown');el.inert=false;}
 const last=cur+step()-1;
 for(const tab of document.querySelectorAll('.tab')){const page=Number(tab.dataset.goto);tab.classList.toggle('is-left',isOpen&&page<=cur&&!single());tab.classList.toggle('is-current',isOpen&&page>=cur&&page<=last);}
 book.classList.toggle('at-start',cur===0);book.classList.toggle('at-end',cur+step()>=pages.length);
 toggle.querySelector('span').textContent=isOpen?'Close the book':'Open the book';
 cover.setAttribute('aria-hidden',String(isOpen));
 pagerLabel.textContent=isOpen?`${pages[cur]?.dataset.short||''} · ${cur+1}/${pages.length}`:'';
 $('[data-turn="-1"]').disabled=!isOpen;$('[data-turn="1"]').disabled=!isOpen||cur+step()>=pages.length;
}

// A turn moves up to four pages: the leaf that lifts, the page it lands as, what it uncovers, and what it covers.
function setup(from,to){
 const dir=to>from?1:-1;
 if(single())return dir>0?{dir,lift:from<0?cover:pages[from],under:pages[to]}:{dir,land:to<0?cover:pages[to],stay:pages[from]};
 const a=from<0?[null,cover]:shown(from),b=to<0?[null,cover]:shown(to);
 return dir>0?{dir,lift:a[1],stay:a[0],land:b[0],under:b[1]}:{dir,lift:a[0],stay:a[1],land:b[1],under:b[0]};
}
function start(turn){
 for(const el of [...allPages,cover]){el.classList.remove('is-shown');el.inert=true;}
 for(const key of ['lift','land','under','stay'])if(turn[key])turn[key].classList.add('is-shown');
 apply(turn,0);
}
function face(el,t,landing){
 const r=isRight(el),swing=landing?1-t:t;
 el.style.transformOrigin=r?'left center':'right center';
 el.style.transform=`translateZ(${el===cover?1:3}px) rotateY(${(r?-180:180)*swing}deg)`;
 el.style.setProperty('--curl',Math.sin(Math.PI*t).toFixed(3));
 // On one-page screens the open cover swings past the spine and fades instead of lying flat off-screen.
 if(el===cover&&single())el.style.opacity=String(swing<.6?1:Math.max(0,1-(swing-.6)/.4));
}
function apply(turn,t){
 if(turn.lift)face(turn.lift,t,false);
 if(turn.land)face(turn.land,t,true);
 if(turn.under)turn.under.style.setProperty('--shade',((1-t)*.45).toFixed(3));
 if(turn.stay)turn.stay.style.setProperty('--shade',(t*.4).toFixed(3));
}
const ease=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
function tween(turn,from,to,ms){
 return new Promise(resolve=>{
  if(reduced.matches||ms<=0){apply(turn,to);return resolve();}
  const t0=performance.now();
  const frame=now=>{const k=Math.min(1,(now-t0)/ms);apply(turn,from+(to-from)*ease(k));k<1?requestAnimationFrame(frame):resolve();};
  requestAnimationFrame(frame);
 });
}
const wait=ms=>new Promise(r=>setTimeout(r,reduced.matches?0:ms));
const toTop=()=>{for(const el of shown(cur))el?.querySelector('.page-inner')?.scrollTo(0,0);};

async function go(target){
 if(!isOpen||busy)return;
 pages=list();target=snap(Math.max(0,Math.min(target,pages.length-1)));
 if(target===cur)return;
 busy=true;const turn=setup(cur,target);start(turn);
 await tween(turn,0,1,single()?650:(Math.abs(target-cur)>step()?1000:850));
 cur=target;busy=false;paint();toTop();
}
async function openBook(){
 if(isOpen||busy)return;busy=true;pages=list();cur=firstPage();
 body.classList.add('is-open');
 await wait(single()?260:420);
 const turn=setup(-1,cur);start(turn);await tween(turn,0,1,single()?900:1150);
 isOpen=true;busy=false;paint();
 if(!wrote)writeStartHere();
}
async function closeBook(){
 if(!isOpen||busy)return;busy=true;
 if(!single()&&cur!==0){const back=setup(cur,0);start(back);await tween(back,0,1,800);cur=0;}
 const turn=setup(cur,-1);start(turn);await tween(turn,0,1,single()?800:1050);
 isOpen=false;cur=0;busy=false;paint();body.classList.remove('is-open');
}
toggle.addEventListener('click',()=>isOpen?closeBook():openBook());
cover.addEventListener('click',()=>openBook());
for(const button of document.querySelectorAll('[data-turn]'))button.addEventListener('click',()=>go(cur+Number(button.dataset.turn)*step()));

// Contents rows open one at a time to show the task, with a button to its page.
function expand(row){
 const open=row.getAttribute('aria-expanded')!=='true';
 for(const other of row.closest('.toc').querySelectorAll('.toc-row[aria-expanded="true"]')){other.setAttribute('aria-expanded','false');$('#'+other.getAttribute('aria-controls')).inert=true;}
 row.setAttribute('aria-expanded',String(open));
 const detail=$('#'+row.getAttribute('aria-controls'));detail.inert=!open;
 if(open)setTimeout(()=>detail.scrollIntoView({block:'nearest',behavior:reduced.matches?'auto':'smooth'}),220);
}

// Clicking empty space on a page turns it: the left page goes back, the right page goes forward.
// On one-page screens the left and right halves of the page do the same.
const controls='input,textarea,select,button,label,a,summary,details,[contenteditable],[data-step-editor],form,.career-preview,.toc-detail,.calendar-panel';
function pageTurnClick(event){
 if(!isOpen||busy||event.defaultPrevented||event.target.closest(controls))return false;
 const page=event.target.closest('.page.is-shown');if(!page)return false;
 if(String(getSelection())!=='')return false;
 const r=page.getBoundingClientRect(),forward=single()?event.clientX>r.left+r.width/2:page.classList.contains('right');
 const target=cur+(forward?1:-1)*step();
 if(target<0||target>=pages.length)return false;
 go(target);return true;
}

// Chapter links: tabs, contents and in-page buttons.
document.addEventListener('click',event=>{
 if(pageTurnClick(event))return;
 if(event.target.closest('[data-close]')){closeBook();return;}
 const row=event.target.closest('.toc-row');if(row){if(isOpen)expand(row);else openBook();return;}
 const link=event.target.closest('[data-goto]');if(!link)return;
 if(!isOpen){openBook();return;}
 if(main.hidden){note.textContent='Sign in first to open this task.';if(single())go(1);else authPage.querySelector('input:not([disabled])')?.focus({preventScroll:true});return;}
 note.textContent='';go(Number(link.dataset.goto));
});
document.addEventListener('keydown',event=>{
 if(event.target.closest?.('input,textarea,select,[contenteditable],summary,dialog#campus-welcome')||event.metaKey||event.ctrlKey||event.altKey)return;
 if(event.key==='ArrowRight'){if(!isOpen)openBook();else go(cur+step());}
 else if(event.key==='ArrowLeft'&&isOpen){if(cur===0)closeBook();else go(cur-step());}
});

// Drag a page edge to turn it; release past a third to finish the turn.
for(const grip of document.querySelectorAll('[data-grip]'))grip.addEventListener('pointerdown',event=>{
 const dir=Number(grip.dataset.grip);
 if(busy||!isOpen)return;
 pages=list();const target=cur+dir*step();
 if(target<0||target>=pages.length)return;
 event.preventDefault();try{grip.setPointerCapture(event.pointerId);}catch{}
 const width=book.getBoundingClientRect().width*(single()?1:.5)*1.6,x0=event.clientX;let t=0,moved=false;busy=true;
 const turn=setup(cur,target);start(turn);
 const move=e=>{const dx=(e.clientX-x0)*-dir;if(Math.abs(dx)>4)moved=true;t=Math.max(0,Math.min(1,dx/width));apply(turn,t);};
 const up=async()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',up);grip.removeEventListener('pointercancel',up);
  const done=!moved||t>.33;
  await tween(turn,t,done?1:0,(done?1-t:t)*800+120);
  if(done)cur=target;busy=false;paint();if(done)toTop();};
 grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',up);grip.addEventListener('pointercancel',up);
});

// Swipe anywhere on a page with a finger; vertical movement still scrolls the page.
let swipe=null;
$('#pages').addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'&&isOpen&&!event.target.closest('input,textarea,select,label'))swipe={x:event.clientX,y:event.clientY,at:performance.now()};});
$('#pages').addEventListener('pointercancel',()=>{swipe=null;});
document.addEventListener('pointerup',event=>{
 if(!swipe)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y,fast=performance.now()-swipe.at<700;swipe=null;
 if(fast&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.6)go(cur+(dx<0?1:-1)*step());
});

// The pencil leaves the notepad and writes "start here" the first time the book opens.
async function writeStartHere(){
 const text=shown(cur).find(el=>el?.querySelector('.start-here'))?.querySelector('.start-here');
 if(!text)return;
 wrote=true;
 const rest=$('.pencil-rest'),fly=$('#pencil'),tip=rest.querySelector('.tip').getBoundingClientRect(),box=text.getBoundingClientRect();
 if(reduced.matches||tip.left>innerWidth||tip.top>innerHeight){text.classList.add('is-written');return;}
 const from={x:tip.left,y:tip.top},a={x:box.left+4,y:box.bottom-8},b={x:box.left+Math.min(box.width,150)-2,y:box.bottom-10};
 rest.style.visibility='hidden';fly.classList.add('is-flying');
 const pose=(p,rot)=>`translate(${p.x}px,${p.y}px) rotate(${rot}deg)`;
 await fly.animate([{transform:pose(from,62)},{transform:pose(a,14)}],{duration:650,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'}).finished;
 text.classList.add('is-writing');
 const wiggle=[];for(let i=0;i<=10;i++){const k=i/10;wiggle.push({transform:pose({x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k+(i%2?-5:3)},14),offset:k});}
 await fly.animate(wiggle,{duration:1100,easing:'linear',fill:'forwards'}).finished;
 text.classList.add('is-written');
 const back=rest.querySelector('.tip').getBoundingClientRect();
 await fly.animate([{transform:pose(b,14)},{transform:pose({x:back.left,y:back.top},62)}],{duration:700,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'}).finished;
 fly.classList.remove('is-flying');rest.style.visibility='';
}

// Sign-in swaps in the workspace pages; a saved session opens the book by itself.
let autoOpen=0;
new MutationObserver(()=>{
 if(busy)return; // every turn repaints when it lands
 if(!main.hidden&&!isOpen){paint();clearTimeout(autoOpen);autoOpen=setTimeout(openBook,350);return;}
 cur=main.hidden?firstPage():0;
 paint();
 if(isOpen)for(const el of shown(cur))el?.animate?.([{opacity:0},{opacity:1}],{duration:reduced.matches?0:450,easing:'ease-out'});
}).observe(main,{attributes:true,attributeFilter:['hidden']});

// Two-tone title for the contents page, whose text tasks.js writes.
const campusTitle=$('#campus-title');
new MutationObserver(()=>{
 if(campusTitle.querySelector('span'))return;
 const m=campusTitle.textContent.match(/^(.+?\.)\s+(.+)$/);if(!m)return;
 campusTitle.textContent=m[1];campusTitle.append(document.createElement('br'),Object.assign(document.createElement('span'),{textContent:m[2]}));
}).observe(campusTitle,{childList:true,characterData:true,subtree:true});

// Mirror each task's status into both contents pages.
for(const card of document.querySelectorAll('[data-task]')){
 const status=card.querySelector('[data-status]'),targets=document.querySelectorAll(`[data-status-for="${card.dataset.task}"]`);
 if(!status)continue;
 const sync=()=>{const value=status.textContent.trim();for(const target of targets)target.textContent=value==='Available'?'':value;};
 new MutationObserver(sync).observe(status,{childList:true,characterData:true,subtree:true});sync();
}

// Per-device preferences: book size and where things sit on the desk.
const remember=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const recall=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};

// Resize the book: drag the corner handle, use its arrow keys, or the − / + buttons. Double-click resets.
const ZOOM_KEY='tasks2-book-zoom',handle=$('#resize-handle');
let zoom=Number(recall(ZOOM_KEY))||1;
function setZoom(value,save=true){
 zoom=Math.round(Math.max(.65,Math.min(1.15,value))*100)/100;
 document.documentElement.style.setProperty('--zoom',zoom);
 for(const b of document.querySelectorAll('[data-zoom]'))b.disabled=Number(b.dataset.zoom)<0?zoom<=.65:zoom>=1.15;
 if(save)remember(ZOOM_KEY,zoom);
}
setZoom(zoom,false);
for(const b of document.querySelectorAll('[data-zoom]'))b.addEventListener('click',()=>setZoom(zoom+Number(b.dataset.zoom)*.1));
handle.addEventListener('dblclick',()=>setZoom(1));
handle.addEventListener('keydown',event=>{const d={ArrowUp:.05,ArrowRight:.05,ArrowDown:-.05,ArrowLeft:-.05}[event.key];if(d){event.preventDefault();event.stopPropagation();setZoom(zoom+d);}});
handle.addEventListener('pointerdown',event=>{
 event.preventDefault();event.stopPropagation();try{handle.setPointerCapture(event.pointerId);}catch{}
 const r=book.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dist=e=>Math.hypot(e.clientX-cx,e.clientY-cy)||1,d0=dist(event),z0=zoom;
 body.classList.add('is-resizing');
 const move=e=>setZoom(z0*dist(e)/d0,false);
 const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);body.classList.remove('is-resizing');setZoom(zoom);};
 handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);
});
document.addEventListener('keydown',event=>{if(!isOpen||event.target.closest?.('input,textarea,select,[contenteditable]'))return;if(event.key==='-'||event.key==='_')setZoom(zoom-.1);else if(event.key==='='||event.key==='+')setZoom(zoom+.1);});

// Desk objects can be picked up and moved. Double-click one to put it back.
const PLACES_KEY='tasks2-desk-v1',places=recall(PLACES_KEY)||{};
const propsScale=()=>{const m=new DOMMatrix(getComputedStyle($('.props')).transform);return Math.hypot(m.a,m.b)||1;};
for(const el of document.querySelectorAll('[data-prop]')){
 const key=el.dataset.prop,place=p=>{el.style.translate=p?`${p.x}px ${p.y}px`:'';};
 place(places[key]);
 el.addEventListener('dblclick',()=>{delete places[key];place(null);remember(PLACES_KEY,places);});
 el.addEventListener('pointerdown',event=>{
  if(event.button>0)return;event.preventDefault();try{el.setPointerCapture(event.pointerId);}catch{}
  const start=places[key]||{x:0,y:0},x0=event.clientX,y0=event.clientY,k=propsScale();
  el.classList.add('is-held');
  const move=e=>{places[key]={x:Math.round(start.x+(e.clientX-x0)/k),y:Math.round(start.y+(e.clientY-y0)/k)};place(places[key]);};
  const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.classList.remove('is-held');remember(PLACES_KEY,places);};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
 });
}

narrow.addEventListener('change',()=>{if(!busy)paint();});
paint();
