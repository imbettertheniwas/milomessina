'use strict';
const tiers=[
 {name:'Wonder',members:10,image:'box-silver.png',glow:'#748bca'},
 {name:'Everyday',members:20,image:'box-gold.png',glow:'#b68633'},
 {name:'Runway',members:50,image:'box-ruby.png',glow:'#ae315f'},
 {name:'Dream',members:150,image:'box-icy.png',glow:'#94caff'}
];
// Public IcyBox catalog only. No box prize pools have been verified.
const bags=[{brand:'HERMÈS',name:'Kelly 28',image:'hermes.png'},{brand:'CHANEL',name:'Small Classic',image:'chanel.png'},{brand:'DIOR',name:'Himalayan Mini Lady Dior',image:'dior.png'},{brand:'CHANEL',name:'Mini 25 · Butter Yellow',image:'chanel-yellow.png'},{brand:'LOUIS VUITTON',name:'Cherry Blossom Capucines Mini',image:'louis-vuitton.png'},{brand:'HERMÈS',name:'Birkin 30 · Rouge Casaque',image:'birkin-red.png'}];
const $=id=>document.getElementById(id);const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches;let selected=0;let spinAnimation=null;
const behavior=()=>paused||reduced.matches?'instant':'smooth';
function motion(){if(paused&&spinAnimation)spinAnimation.finish();document.body.classList.toggle('motion-paused',paused);$('motion-toggle').textContent=paused?'Play animations ↗':'Pause animations Ⅱ';$('motion-toggle').setAttribute('aria-pressed',String(paused))}motion();$('motion-toggle').addEventListener('click',()=>{paused=!paused;motion()});reduced.addEventListener('change',e=>{paused=e.matches;motion()});
const menu=document.querySelector('.menu-toggle');menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));document.querySelector('.nav-links').classList.toggle('open',open)});document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');document.querySelector('.nav-links').classList.remove('open')}));
function animate(el){if(paused||reduced.matches)return;el.classList.remove('swap-in');void el.offsetWidth;el.classList.add('swap-in');el.addEventListener('animationend',()=>el.classList.remove('swap-in'),{once:true})}
function selectTier(index){selected=index;const t=tiers[index];document.querySelectorAll('[data-tier]').forEach(b=>{const active=Number(b.dataset.tier)===index;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))});$('showcase-word').textContent=t.name.toUpperCase();$('showcase-title').textContent=t.name+' Box';$('showcase-count').textContent=t.members;$('showcase-page').textContent='0'+(index+1)+' / 04';$('showcase-box').src='/icybox/assets/'+t.image;$('showcase-box').alt=t.name+' Box illustration';$('reward-showcase').style.setProperty('--glow',t.glow);$('showcase-inside').textContent='What’s inside '+t.name+' Box?';$('contents-description').textContent='Open '+t.name+' Box in the IcyBox app for current bags and odds. Prize lists aren’t verified on this page.';animate($('showcase-box'))}
document.querySelectorAll('[data-tier]').forEach(b=>b.addEventListener('click',()=>selectTier(Number(b.dataset.tier))));
// This reel is a visual demo of the public catalog, never a box-specific draw.
const reel=$('reel-track'),reelWindow=$('reel-window'),spinButton=$('reveal-button');
let revealedIndex=0;let spinning=false;
for(let i=0;i<36;i++){const b=bags[i%bags.length],card=document.createElement('div');card.className='reel-card';const img=document.createElement('img');img.src='/icybox/assets/'+b.image;img.alt='';img.width=220;img.height=180;const brand=document.createElement('span');brand.className='mono';brand.textContent=b.brand;const name=document.createElement('strong');name.textContent=b.name;card.append(img,brand,name);reel.append(card)}
function reelPosition(index){const card=reel.children[index];return reelWindow.clientWidth/2-card.offsetLeft-card.offsetWidth/2}
function positionReel(){reel.style.transform='translateX('+reelPosition(revealedIndex)+'px)'}
spinButton.addEventListener('click',()=>{
 if(spinning)return;spinning=true;spinButton.disabled=true;$('demo-spin').classList.remove('revealed');$('demo-brand').textContent='DEMO SPIN';$('demo-result').textContent='A little bag magic…';$('demo-caption').textContent='Watch your wishlist roll by.';
 const target=24+Math.floor(Math.random()*bags.length);revealedIndex%=bags.length;positionReel();
 const finish=()=>{revealedIndex=target;const b=bags[target%bags.length];positionReel();if(spinAnimation){spinAnimation.cancel();spinAnimation=null}spinning=false;spinButton.disabled=false;spinButton.textContent='Spin again ↻';$('demo-spin').classList.add('revealed');$('demo-brand').textContent=b.brand+' / DEMO REVEAL';$('demo-result').textContent=b.name;$('demo-caption').textContent='Next up: find your chapter’s box.'};
 if(paused||reduced.matches){finish();return}
 spinAnimation=reel.animate([{transform:'translateX('+reelPosition(revealedIndex)+'px)'},{transform:'translateX('+reelPosition(target)+'px)'}],{duration:3800,easing:'cubic-bezier(.12,.65,.12,1)',fill:'forwards'});spinAnimation.onfinish=finish;
});
new ResizeObserver(()=>{if(spinAnimation)spinAnimation.finish();else positionReel()}).observe(reelWindow);
positionReel();
const navLinks=[...document.querySelectorAll('[data-mobile-section]')];const sections=navLinks.map(a=>$(a.dataset.mobileSection));const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;navLinks.forEach(a=>{if(a.dataset.mobileSection===visible.target.id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')})},{rootMargin:'-10% 0px -45% 0px',threshold:[0,.1,.3]});sections.forEach(s=>{if(s)observer.observe(s)});
selectTier(0);
let swipeStart=null;const visual=document.querySelector('.showcase-visual');visual.addEventListener('touchstart',e=>{if(e.touches.length===1)swipeStart={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});visual.addEventListener('touchend',e=>{if(!swipeStart)return;const dx=e.changedTouches[0].clientX-swipeStart.x,dy=e.changedTouches[0].clientY-swipeStart.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)selectTier((selected+(dx<0?1:3))%4);swipeStart=null},{passive:true});
function openReferralFromHash(){if(location.hash==='#refer'){const referral=$('refer');referral.open=true;requestAnimationFrame(()=>referral.scrollIntoView({block:'start',behavior:behavior()}))}}window.addEventListener('hashchange',openReferralFromHash);openReferralFromHash();
