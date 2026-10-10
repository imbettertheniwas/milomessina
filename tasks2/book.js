// The book: cover, page turns, drag, tabs and the pencil. tasks.js owns accounts and task data.
const $=selector=>document.querySelector(selector);
const body=document.body,book=$('#book'),cover=$('#cover'),main=$('main'),contents=$('#contents-page'),authPage=$('#auth-page'),toggle=$('#book-toggle'),note=$('#toc-note');
const allPages=[...document.querySelectorAll('#pages .page')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),narrow=matchMedia('(max-width: 820px)');
const single=()=>narrow.matches;
let pages=[],cur=0,isOpen=false,busy=false,wrote=false;

const list=()=>main.hidden?[contents,authPage]:[contents,...main.querySelectorAll(':scope > .page')];
const step=()=>single()?1:2;
const snap=i=>single()?i:i-(i%2);
const shown=i=>single()?[pages[i]]:[pages[i],pages[i+1]];
const isRight=el=>single()||el.classList.contains('right');

function paint(){
 pages=list();cur=Math.min(snap(cur),snap(pages.length-1));
 for(const el of [...allPages,cover]){el.classList.remove('is-shown');el.style.transform='';el.style.transformOrigin='';el.style.removeProperty('--shade');el.style.removeProperty('--curl');el.inert=true;}
 if(!isOpen){cover.classList.add('is-shown');cover.inert=false;}
 else for(const el of shown(cur))if(el){el.classList.add('is-shown');el.inert=false;}
 const last=cur+step()-1;
 for(const tab of document.querySelectorAll('.tab')){const page=Number(tab.dataset.goto);tab.classList.toggle('is-left',isOpen&&page<=cur&&!single());tab.classList.toggle('is-current',isOpen&&page>=cur&&page<=last);}
 book.classList.toggle('at-start',cur===0);book.classList.toggle('at-end',cur+step()>=pages.length);
 toggle.querySelector('span').textContent=isOpen?'Close the book':'Open the book';
 cover.setAttribute('aria-hidden',String(isOpen));
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
function apply(turn,t){
 const curl=Math.sin(Math.PI*t);
 if(turn.lift){const r=isRight(turn.lift);turn.lift.style.transformOrigin=r?'left center':'right center';turn.lift.style.transform=`translateZ(3px) rotateY(${(r?-180:180)*t}deg)`;turn.lift.style.setProperty('--curl',curl.toFixed(3));}
 if(turn.land){const r=isRight(turn.land);turn.land.style.transformOrigin=r?'left center':'right center';turn.land.style.transform=`translateZ(3px) rotateY(${(r?-180:180)*(1-t)}deg)`;turn.land.style.setProperty('--curl',curl.toFixed(3));}
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

async function go(target){
 if(!isOpen||busy)return;
 pages=list();target=snap(Math.max(0,Math.min(target,pages.length-1)));
 if(target===cur)return;
 busy=true;const turn=setup(cur,target);start(turn);
 await tween(turn,0,1,Math.abs(target-cur)>step()?1000:850);
 cur=target;busy=false;paint();
 for(const el of shown(cur))el?.querySelector('.page-inner')?.scrollTo(0,0);
}
async function openBook(){
 if(isOpen||busy)return;busy=true;pages=list();cur=0;
 body.classList.add('is-open');
 await wait(420);
 const turn=setup(-1,0);start(turn);await tween(turn,0,1,1150);
 isOpen=true;busy=false;paint();
 if(!wrote)writeStartHere();
}
async function closeBook(){
 if(!isOpen||busy)return;busy=true;
 if(cur!==0){const back=setup(cur,0);start(back);await tween(back,0,1,800);cur=0;}
 const turn=setup(0,-1);start(turn);await tween(turn,0,1,1050);
 isOpen=false;busy=false;paint();body.classList.remove('is-open');
}
toggle.addEventListener('click',()=>isOpen?closeBook():openBook());
cover.addEventListener('click',()=>{if(!dragMoved)openBook();});

// Chapter links: tabs, contents and in-page buttons.
document.addEventListener('click',event=>{
 const close=event.target.closest('[data-close]');if(close){closeBook();return;}
 const link=event.target.closest('[data-goto]');if(!link)return;
 const target=Number(link.dataset.goto);
 if(!isOpen){openBook();return;}
 if(target>=list().length){note.textContent='Sign in on the next page to open this chapter.';authPage.querySelector('input:not([disabled])')?.focus({preventScroll:true});return;}
 note.textContent='';go(target);
});
document.addEventListener('keydown',event=>{
 if(event.target.closest?.('input,textarea,select,[contenteditable],summary,dialog#campus-welcome')||event.metaKey||event.ctrlKey||event.altKey)return;
 if(event.key==='ArrowRight'){if(!isOpen)openBook();else go(cur+step());}
 else if(event.key==='ArrowLeft'&&isOpen){if(cur===0)closeBook();else go(cur-step());}
});

// Drag a page edge to turn it; release past a third to finish the turn.
let dragMoved=false;
for(const grip of document.querySelectorAll('[data-grip]'))grip.addEventListener('pointerdown',event=>{
 const dir=Number(grip.dataset.grip);
 if(busy||!isOpen)return;
 pages=list();const target=cur+dir*step();
 if(target<0||target>=pages.length)return;
 event.preventDefault();try{grip.setPointerCapture(event.pointerId);}catch{}
 const width=book.getBoundingClientRect().width*(single()?1:.5)*1.6,x0=event.clientX;let t=0;dragMoved=false;busy=true;
 const turn=setup(cur,target);start(turn);
 const move=e=>{const dx=(e.clientX-x0)*-dir;if(Math.abs(dx)>4)dragMoved=true;t=Math.max(0,Math.min(1,dx/width));apply(turn,t);};
 const up=async()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',up);grip.removeEventListener('pointercancel',up);
  const done=!dragMoved||t>.33;
  await tween(turn,t,done?1:0,(done?1-t:t)*800+120);
  if(done)cur=target;busy=false;paint();
  if(done)for(const el of shown(cur))el?.querySelector('.page-inner')?.scrollTo(0,0);};
 grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',up);grip.addEventListener('pointercancel',up);
});

// The pencil leaves the notepad and writes "start here" the first time the book opens.
async function writeStartHere(){
 const page=shown(0).find(el=>el?.querySelector('.start-here'));const text=page?.querySelector('.start-here');
 const rest=$('.pencil-rest'),fly=$('#pencil');
 if(!text||reduced.matches){text?.classList.add('is-written');wrote=true;return;}
 wrote=true;
 const tip=rest.querySelector('.tip').getBoundingClientRect(),box=text.getBoundingClientRect();
 const from={x:tip.left,y:tip.top},a={x:box.left+4,y:box.bottom-8},b={x:box.right-2,y:box.bottom-10};
 rest.style.visibility='hidden';fly.classList.add('is-flying');
 const pose=(p,rot)=>`translate(${p.x}px,${p.y}px) rotate(${rot}deg)`;
 await fly.animate([{transform:pose(from,62)},{transform:pose(a,14)}],{duration:700,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'}).finished;
 text.classList.add('is-writing');
 const wiggle=[];for(let i=0;i<=10;i++){const k=i/10;wiggle.push({transform:pose({x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k+(i%2?-5:3)},14),offset:k});}
 await fly.animate(wiggle,{duration:1100,easing:'linear',fill:'forwards'}).finished;
 text.classList.add('is-written');
 const back=rest.querySelector('.tip').getBoundingClientRect();
 await fly.animate([{transform:pose(b,14)},{transform:pose({x:back.left,y:back.top},62)}],{duration:750,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'}).finished;
 fly.classList.remove('is-flying');rest.style.visibility='';
 for(const other of document.querySelectorAll('.start-here'))other.classList.add('is-written');
}

// Sign-in swaps the auth page for the workspace; a saved session opens the book by itself.
let autoOpen=0;
new MutationObserver(()=>{
 const signedIn=!main.hidden;
 if(busy)return; // every turn repaints when it lands
 if(signedIn&&!isOpen){paint();clearTimeout(autoOpen);autoOpen=setTimeout(openBook,350);return;}
 if(!signedIn)cur=0;
 paint();
 if(isOpen)for(const el of shown(cur))el?.animate?.([{opacity:0},{opacity:1}],{duration:reduced.matches?0:450,easing:'ease-out'});
}).observe(main,{attributes:true,attributeFilter:['hidden']});

// Two-tone chapter title for the campus page, whose text tasks.js writes.
const campusTitle=$('#campus-title');
new MutationObserver(()=>{
 if(campusTitle.querySelector('span'))return;
 const m=campusTitle.textContent.match(/^(.+?\.)\s+(.+)$/);if(!m)return;
 campusTitle.textContent=m[1];campusTitle.append(document.createElement('br'),Object.assign(document.createElement('span'),{textContent:m[2]}));
}).observe(campusTitle,{childList:true,characterData:true,subtree:true});

// Mirror each task's status into the contents page.
for(const card of document.querySelectorAll('[data-task]')){
 const status=card.querySelector('[data-status]'),target=document.querySelector(`[data-status-for="${card.dataset.task}"]`);
 if(!status||!target)continue;
 const sync=()=>{const value=status.textContent.trim();target.textContent=value==='Available'?'':value;};
 new MutationObserver(sync).observe(status,{childList:true,characterData:true,subtree:true});sync();
}

narrow.addEventListener('change',()=>{if(!busy)paint();});
paint();
