// Mobile keyboards can shrink the visual viewport without changing CSS vh/dvh.
// Keep the account dialog inside the visible area and its focused field reachable.
const viewport=window.visualViewport;
let frame;
function updateViewport(){
 cancelAnimationFrame(frame);
 frame=requestAnimationFrame(()=>{
  document.documentElement.style.setProperty('--mobile-viewport-height',`${viewport?.height||window.innerHeight}px`);
  document.documentElement.style.setProperty('--mobile-viewport-top',`${viewport?.offsetTop||0}px`);
 });
}
function resize(){
 updateViewport();
 if(window.matchMedia('(max-width:600px), (max-height:500px) and (max-width:900px)').matches){
  requestAnimationFrame(()=>{
   const field=document.activeElement;
   if(field?.matches('input,textarea')&&field.closest('dialog[open]'))field.scrollIntoView({block:'nearest',inline:'nearest'});
  });
 }
}
viewport?.addEventListener('resize',resize);
viewport?.addEventListener('scroll',updateViewport);
window.addEventListener('resize',resize);
updateViewport();
