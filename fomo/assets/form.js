/* ─────────────────────────────────────────────────────────────
   Where submissions go.

   These two lines are the only ones you need to change to take
   the forms live. ENDPOINT is the /exec URL of the Apps Script
   web app that writes into your Google Sheet — the whole setup
   is nine steps in fomo/setup/README.md.

     const ENDPOINT = 'https://script.google.com/macros/s/AKfy.../exec';

   FORM_KEY is optional. If you set one here it has to match
   SHARED_SECRET in the Apps Script, and random POSTs to the
   endpoint get turned away. It travels in the page source, so
   it stops drive-by junk, not a determined person.

   Until ENDPOINT is set, nothing is silently swallowed: the form
   validates, then hands the applicant their answers and tells
   them plainly that submissions are not connected yet.
   ───────────────────────────────────────────────────────────── */
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbysuC8mMMqFYZ3YRcuwp9Vt6dXE7S8P2n73EpWS8CXyBuCDIC8Dga1TwASFvMDoDq-UIQ/exec';
const FORM_KEY = '';

/* starfield + aurora, same as the campus page */
(function(){
  const c=document.getElementById('stars');if(!c)return;
  const x=c.getContext('2d');let w,h,stars=[];
  function size(){w=c.width=innerWidth;h=c.height=innerHeight;
    stars=Array.from({length:Math.min(150,Math.round(w*h/11000))},()=>({
      x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.15+.2,
      a:Math.random()*.7+.15,s:Math.random()*.02+.004,d:Math.random()*Math.PI*2}));}
  size();addEventListener('resize',size);
  function loop(){x.clearRect(0,0,w,h);
    for(const s of stars){s.d+=s.s;const tw=s.a*(.55+.45*Math.sin(s.d));
      x.fillStyle='rgba(200,190,255,'+tw+')';x.beginPath();x.arc(s.x,s.y,s.r,0,7);x.fill();
      s.y+=.045;if(s.y>h)s.y=0;}
    requestAnimationFrame(loop);}
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)loop();
})();

(function(){
  const rv=document.querySelectorAll('.rv');
  const o=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');o.unobserve(e.target)}}),
    {threshold:0,rootMargin:'0px 0px -80px 0px'});
  rv.forEach(el=>o.observe(el));
  const hdr=document.getElementById('hdr');
  if(hdr)addEventListener('scroll',()=>hdr.classList.toggle('stuck',scrollY>20),{passive:true});
})();

/* live character counters */
document.querySelectorAll('[data-count-for]').forEach(el=>{
  const t=document.getElementById(el.dataset.countFor);
  const max=t.getAttribute('maxlength');
  const upd=()=>el.textContent=t.value.length+(max?'/'+max:'');
  t.addEventListener('input',upd);upd();
});

/* ── validation + submit ── */
function wireForm(form,opts){
  opts=opts||{};
  const banner=form.querySelector('.banner');
  const done=document.querySelector('.done');
  const submitBtn=form.querySelector('[type=submit]');

  const showErr=(el,msg)=>{
    el.setAttribute('aria-invalid','true');
    const e=el.closest('.f,.chk')?.querySelector('.err')||el.parentElement.querySelector('.err');
    if(e){e.textContent=msg;e.classList.add('on')}
  };
  const clearErr=el=>{
    el.removeAttribute('aria-invalid');
    const e=el.closest('.f,.chk')?.querySelector('.err')||el.parentElement.querySelector('.err');
    if(e)e.classList.remove('on');
  };
  form.addEventListener('input',e=>{if(e.target.hasAttribute('aria-invalid'))clearErr(e.target)});

  function validate(){
    let bad=null;
    /* the optional link and email fields are checked too when they're filled in,
       so a half-typed handle never lands in the sheet as data we can't use */
    form.querySelectorAll('[required],input[type=url],input[type=email],input[type=tel]').forEach(el=>{
      const v=(el.type==='checkbox')?el.checked:el.value.trim();
      if(!v){
        if(!el.hasAttribute('required')){clearErr(el);return}
        showErr(el,el.type==='checkbox'?'You need to confirm this to submit.'
          :el.type==='file'?'Pick a file to upload.':'This one is required.');bad=bad||el;return}
      if(el.type==='file'&&el.files[0]&&el.files[0].size>10*1024*1024){
        showErr(el,'That file is over 10MB. Export it smaller, or send it to the campus team directly.');bad=bad||el;return}
      if(el.type==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(el.value.trim())){
        showErr(el,"That doesn't look like an email address.");bad=bad||el;return}
      /* people type numbers as (313) 555-0142, +44 7700 900 123, 313.555.0142.
         we only care that there are enough digits to actually dial. */
      if(el.type==='tel'){
        const digits=el.value.replace(/\D/g,'');
        if(digits.length<10||digits.length>15){
          showErr(el,'That needs to be a full phone number, area code included.');bad=bad||el;return}
      }
      if(el.type==='url'){
        let u=el.value.trim();
        if(!/^https?:\/\//i.test(u)){u='https://'+u;el.value=u}
        try{new URL(u)}catch(_){showErr(el,'Paste the full link to the post.');bad=bad||el;return}
      }
      clearErr(el);
    });
    if(opts.extra){const m=opts.extra(showErr);if(m)bad=bad||m}
    return bad;
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    banner.className='banner';
    const bad=validate();
    if(bad){
      banner.className='banner bad on';
      banner.textContent='Some answers still need fixing — the fields are marked below.';
      bad.focus();bad.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    /* Apps Script wants a plain string body: that keeps this a "simple"
       CORS request, so the browser never fires a preflight Google
       cannot answer. Files ride along as base64 in the same payload. */
    const fileInput=form.querySelector('input[type=file]');
    const data=Object.fromEntries([...new FormData(form).entries()]
      .map(([k,v])=>[k,v instanceof File?v.name:v]));
    data._page=location.pathname;
    data._submitted=new Date().toISOString();

    if(!ENDPOINT){
      /* not wired up yet — never pretend it sent */
      form.style.display='none';
      done.classList.add('on');
      done.querySelector('.tick').textContent='!';
      done.querySelector('.tick').style.cssText='background:rgba(255,164,107,.16);border-color:rgba(255,164,107,.45);color:#FFC46B';
      done.querySelector('h2').textContent='not sent — no inbox connected yet';
      done.querySelector('.msg').innerHTML='This form is built and working, but it has nowhere to deliver to yet. '+
        '<b>Nothing was submitted.</b> Copy your answers below and send them to the campus team directly, '+
        'or come back once the form is connected.';
      const dump=done.querySelector('.dump');
      dump.textContent=Object.entries(data).filter(([k])=>!k.startsWith('_'))
        .map(([k,v])=>k.replace(/_/g,' ')+': '+v).join('\n');
      if(fileInput&&fileInput.files[0])
        done.querySelector('.msg').innerHTML+=' <b>Your file was not uploaded either</b> — send '+
          fileInput.files[0].name+' across manually.';
      dump.style.display='block';
      done.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }

    submitBtn.disabled=true;
    const label=submitBtn.textContent;
    submitBtn.textContent='sending…';
    try{
      if(FORM_KEY)data._key=FORM_KEY;
      if(fileInput&&fileInput.files[0]){
        submitBtn.textContent='uploading…';
        data._file=await readFile(fileInput.files[0]);
      }
      const res=await fetch(ENDPOINT,{method:'POST',body:JSON.stringify(data)});
      if(!res.ok)throw new Error('the sheet answered HTTP '+res.status);
      let out=null;
      try{out=JSON.parse(await res.text())}catch(_){}
      if(!out)throw new Error('the endpoint answered, but not with a confirmation. '+
        'Its deployment access is probably not set to "Anyone"');
      if(out.ok!==true)throw new Error(out.error||'the sheet turned it away');
      form.style.display='none';
      done.classList.add('on');
      done.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(err){
      submitBtn.disabled=false;submitBtn.textContent=label;
      banner.className='banner bad on';
      banner.textContent="That didn't send — "+err.message+'. Check your connection and try again; nothing was lost.';
      banner.scrollIntoView({behavior:'smooth',block:'center'});
    }
  });
}

/* a file has to become text to travel inside the JSON payload */
function readFile(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res({name:file.name,type:file.type||'application/octet-stream',
      size:file.size,data:String(r.result).split(',')[1]});
    r.onerror=()=>rej(new Error('that file could not be read off your disk'));
    r.readAsDataURL(file);
  });
}
