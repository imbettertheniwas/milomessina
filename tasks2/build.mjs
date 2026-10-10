import fs from 'node:fs';
// Book edition of /tasks. Same accounts, backend and task logic; every page is one chapter.
const offers=JSON.parse(fs.readFileSync(new URL('./offers.json',import.meta.url),'utf8'));
const companies=JSON.parse(fs.readFileSync(new URL('./companies.json',import.meta.url),'utf8'));
const companyById=new Map(companies.map(company=>[company.id,company]));
for(const offer of offers){if(!companyById.has(offer.companyId))throw Error('Unknown company for '+offer.id);}
const icons=JSON.parse(fs.readFileSync(new URL('./icons.json',import.meta.url),'utf8'));
const e=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const V='20261009-book1';
const roman=n=>['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][n];
// Two-tone headline: first sentence dark, the rest grey.
function split(text){const m=text.match(/^(.+?[.?!])\s+(.+)$/);if(m)return[m[1],m[2]];const w=text.split(' ');const k=Math.min(3,Math.ceil(w.length/2));return[w.slice(0,k).join(' '),w.slice(k).join(' ')];}
const title=(text,cls='')=>{const[a,b]=split(text);return`<h2 class="title ${cls}">${e(a)}<br><span>${e(b)}</span></h2>`;};
const run=(text,side)=>`<span class="run run-${side}">${e(text)}</span>`;
const folio=n=>`<span class="folio" aria-hidden="true">${n}</span>`;
const mark=`<span class="mark" aria-hidden="true"><i></i></span>`;

// Pages after sign-in, in reading order. Index 0 is the contents page, shared with the signed-out book.
const tones={dinner:'dark',calendar:''};
const chapters=[
 {page:1,id:'campus',label:'Your campus'},
 ...offers.map((o,i)=>({page:i+2,id:o.id,label:o.title})),
 {page:offers.length+2,id:'bonus',label:'The $100 bonus'},
 {page:offers.length+3,id:'referral',label:'Bring another chapter'},
 {page:offers.length+4,id:'begin',label:'Begin'}
];
const tabs=[['Start',1,'blue'],['Tasks',2,'yellow'],['Bonus',offers.length+2,'white'],['Begin',offers.length+4,'linen']];

const calendarPanel=`<section class="calendar-panel" aria-labelledby="calendar-editor-title"><h3 id="calendar-editor-title">Add your social calendar</h3><div id="calendar-drop" class="file-drop"><label for="calendar-file">Drop a file here or <span>choose a file</span></label><input id="calendar-file" type="file" accept=".pdf,.csv,.xlsx,.xls,.ics,.doc,.docx,.png,.jpg,.jpeg,.webp"><p>PDF, spreadsheet, calendar, document, or image · up to 10 MB</p></div><div id="calendar-attachment" hidden><strong id="calendar-file-name"></strong><div><button type="button" id="download-calendar" class="quiet-button">Download file</button><button type="button" id="remove-calendar" class="quiet-button">Remove file</button></div></div><p class="calendar-divider">or enter your event dates</p><div id="calendar-events"></div><button type="button" id="add-event" class="quiet-button">Add an event</button><p id="calendar-status" role="status" aria-live="polite"></p><p class="calendar-help">Your calendar saves privately with fomo. Submit this task when your file or event dates are ready for review.</p></section>`;

const cards=offers.map((o,i)=>{const page=i+2,side=page%2?'right':'left',company=companyById.get(o.companyId);return`<article class="page ${side} task-card ${tones[o.id]||''}" data-page="${page}" data-task="${e(o.id)}" data-company="${e(o.companyId)}" aria-label="Chapter ${roman(page)}: ${e(o.title)}"><div class="page-inner">
${run(side==='left'?'Campus tasks':o.title,side)}
<p class="kicker">Chapter ${roman(page)}</p>${title(o.perk.title)}
<div class="card-top"><span class="task-context"><span class="company-tag">${company.badgeLogo?`<img src="${e(company.badgeLogo)}" alt="${e(company.name)}" width="22" height="14">`:e(company.name)}</span>${e(o.title)}</span><span class="status" data-status>Available</span></div>
<p class="review-feedback" role="status" hidden></p>
<p class="description">${e(o.perk.description)}</p>
<ul class="perks">${o.perk.highlights.map(p=>`<li>${icons.check}${e(p)}</li>`).join('')}</ul>
<div class="pitch"><span>What you get to tell them</span><blockquote>“${e(o.perk.pitch)}”</blockquote></div>
<h3 class="section-label">What to do</h3><div class="checklist">${o.tasks.map((t,j)=>`<section class="task-step"><label class="check-item"><input type="checkbox" data-check="${j}" ${o.id==='calendar'?'disabled':''}><span><strong>${e(t.title)}</strong><span>${e(t.detail)}</span><span class="task-win">${icons.gift}${e(o.perk.taskWins[j])}</span></span></label>${o.id==='calendar'?calendarPanel:''}<div class="step-editor" data-step-editor data-task-id="${e(o.id)}" data-step="${j}"><div class="step-editor-top"><span>Step ${j+1}</span><span data-step-status>Not submitted</span></div><label for="step-${e(o.id)}-${j}">Your update for this step</label><textarea id="step-${e(o.id)}-${j}" data-step-notes rows="3" maxlength="6000" placeholder="${e(t.input||'Add details, names, or links for this step…')}"></textarea><label class="step-upload">Add files<input type="file" data-step-upload multiple accept=".pdf,.csv,.xlsx,.xls,.ics,.doc,.docx,.png,.jpg,.jpeg,.webp,.mp4,.mov"></label><p class="step-help">Up to 5 files, 10 MB each. For longer videos, paste a link above.</p><div data-step-files></div><p class="review-feedback" data-step-feedback hidden></p><button type="button" data-step-submit>Send step for review</button><p data-step-message role="status" aria-live="polite"></p></div></section>`).join('')}</div>
<form class="update-form"><label for="chapter-${e(o.id)}">Your chapter &amp; school</label><input id="chapter-${e(o.id)}" data-chapter type="text" maxlength="160" placeholder="e.g. Sigma Chi · University of Miami"><label for="notes-${e(o.id)}">Extra task notes (optional)</label><textarea id="notes-${e(o.id)}" data-notes rows="3" maxlength="6000" placeholder="Names, links, and a quick update…"></textarea><p class="handoff">Drafts save automatically. Each step has its own review.</p><div class="task-bottom"><span data-count>0 of ${o.tasks.length} checklist items complete</span></div><p class="copy-status" role="status" aria-live="polite"></p></form>
</div>${folio(page)}</article>`;}).join('\n');

const toc=chapters.map(c=>`<li><button type="button" data-goto="${c.page}"><span class="toc-n">${c.page}</span><span class="toc-label">${e(c.label)}</span><span class="toc-status" data-status-for="${e(c.id)}"></span><span class="toc-dots" aria-hidden="true"></span><span class="toc-p">p. ${c.page}</span></button></li>`).join('');

// Deterministic leaf shadows: a few bamboo-like sprigs from the top corners.
function leaves(){let seed=7;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;const out=[];
 const sprigs=[[-60,-40,38,26],[260,-80,62,22],[980,-60,118,20],[1380,-40,146,24],[1640,160,170,18],[-80,620,-8,16]];
 for(const[x0,y0,dir,n]of sprigs){let x=x0,y=y0,a=dir*Math.PI/180;const pts=[[x,y]];
  for(let i=0;i<n;i++){a+=(r()-.5)*.22;x+=Math.cos(a)*34;y+=Math.sin(a)*34;pts.push([x,y]);
   if(i>2&&r()>.25){const side=r()>.5?1:-1,len=70+r()*90,ang=a+side*(.5+r()*.6),cx=x+Math.cos(ang)*len*.5,cy=y+Math.sin(ang)*len*.5;out.push(`<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(len/2).toFixed(0)}" ry="${(7+r()*7).toFixed(0)}" transform="rotate(${(ang*180/Math.PI).toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`);}}
  out.push(`<polyline fill="none" stroke-width="5" points="${pts.map(p=>p.map(v=>v.toFixed(0)).join(',')).join(' ')}"/>`);}
 return`<svg class="leaves" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="#2c261d" stroke="#2c261d">${out.join('')}</g></svg>`;}

const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campus Tasks</title><meta name="description" content="Choose campus tasks, build your team, and lead your campus with fomo."><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/tasks/assets/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500&display=swap"><link rel="stylesheet" href="/tasks2/book.css?v=${V}"><script type="module" src="/tasks2/book.js?v=${V}"></script><script type="module" src="/tasks2/tasks.js?v=${V}"></script></head><body><noscript><p class="notice">Enable JavaScript to open Campus Tasks.</p></noscript>
<div class="scene" aria-hidden="false">
<div class="desk" aria-hidden="true"></div>
<div class="props" aria-hidden="true"><div class="pad"></div><div class="mug"><i></i></div><div class="stones"><i></i><i></i><i></i><i></i></div><div class="notepad"><div class="pencil pencil-rest"><i class="tip"></i></div></div></div>
<section class="hero" aria-labelledby="hero-title"><h1 id="hero-title">Campus tasks<br><span>you can read</span></h1><p>Nine chapters bound in one book. Open the cover and turn the pages to choose your work.</p></section>
<div class="corner corner-l" aria-hidden="true"><small>Edition</small>Vol. 01, twelve pages</div><div class="corner corner-r" aria-hidden="true"><small>Begin</small>Click the cover</div>
<div class="book-wrap"><div class="book" id="book">
<div class="board board-l" aria-hidden="true"></div><div class="board board-r" aria-hidden="true"></div><div class="stack stack-l" aria-hidden="true"></div><div class="stack stack-r" aria-hidden="true"></div>
<div class="ribbon" aria-hidden="true"></div>
<nav class="tabs" aria-label="Chapters">${tabs.map(([label,page,color],i)=>`<button type="button" class="tab tab-${color}" data-goto="${page}" style="--i:${i}">${label}</button>`).join('')}</nav>
<div class="leaves3d" id="pages">
<button type="button" class="cover right" id="cover" aria-label="Open the book"><span class="cover-mark"><i></i></span><span class="cover-title">campus tasks</span><span class="cover-vol">Vol. 01</span></button>
<section class="page left" id="contents-page" data-page="0" aria-label="Contents"><div class="page-inner">
<p class="kicker">A campus workspace in nine chapters</p><div class="brand-big">${mark}<span>campus tasks</span></div>
<ol class="toc">${toc}</ol>
<p class="toc-foot">Turn each page the way you would in any book.<br>Every page is one part of your workspace.</p><p class="toc-note" id="toc-note" role="status" aria-live="polite"></p>
</div>${folio('')}</section>
<section class="page right" id="auth-page" data-page="1" aria-label="Chapter I: Sign in"><div class="page-inner">
${run('Start here','right')}<span class="start-here" aria-hidden="true">start here</span>
<dialog id="welcome" aria-labelledby="welcome-title"><form id="welcome-form"><p class="kicker">Chapter I</p><h2 id="welcome-title" class="title">Your campus.<br><span>Your call.</span></h2><p id="auth-context" class="lede">Create an account to choose campus tasks and track your work.</p><div class="auth-tabs" role="group" aria-label="Account access"><button type="button" id="auth-create" aria-pressed="true">Create account</button><button type="button" id="auth-signin" aria-pressed="false">Sign in</button></div><div id="signup-fields"><label for="member-name">Your name</label><input id="member-name" name="name" autocomplete="name" maxlength="100" required placeholder="First and last name"><label for="member-school">Your school</label><div class="school-picker"><input id="member-school" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="school-options" aria-describedby="school-search-status" autocomplete="off" spellcheck="false" required disabled placeholder="Loading schools…"><ul id="school-options" role="listbox" aria-label="Matching schools" hidden></ul></div><p id="school-search-status" class="field-help" role="status" aria-live="polite">Type your school name or abbreviation.</p></div><label for="member-email">Email address</label><input id="member-email" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@school.edu"><label for="member-password" id="password-label">Create a password</label><input id="member-password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required aria-describedby="password-help"><p id="password-help" class="field-help">At least 12 characters. Use a password you don’t use elsewhere.</p><div id="password-confirm-field"><label for="member-password-confirm">Confirm password</label><input id="member-password-confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div><p id="welcome-error" role="alert"></p><button id="auth-new-profile" type="button" class="quiet-button" hidden>Keep drafts &amp; create a new profile</button><button id="retry-schools" type="button" class="quiet-button" hidden>Retry loading schools</button><div class="welcome-actions"><button id="welcome-continue" type="submit" class="primary" disabled>Enter my workspace</button><button id="welcome-cancel" type="button" class="quiet-button" hidden>Cancel</button></div></form></dialog>
</div>${folio(1)}</section>
<main hidden>
<section class="page right campus-page" data-page="1" aria-labelledby="campus-title"><div class="page-inner">
${run('Your campus','right')}<span class="start-here" aria-hidden="true">start here</span>
<p class="kicker">Chapter I</p><h1 id="campus-title" class="title">Their capital.<br><span>Your campus. Your call.</span></h1>
<div class="campus-identity"><div class="school-logo-wrap" hidden><img id="school-logo" alt="" width="40" height="40"></div><div><p id="member-greeting">Your campus workspace</p><p id="pass-school">Personally selected.</p></div></div>
<p class="lede campus-authority">You’re the one person on your campus in charge. Every task is optional. Pick any, skip any, work in any order.</p>
<div class="actions"><button type="button" class="primary" data-goto="2">Choose your first task</button><button type="button" class="quiet-button" data-goto="${offers.length+2}">See the bonus</button></div>
<div class="career-preview"><div class="window-dots" aria-hidden="true"><i></i><i></i><i></i><span>LinkedIn preview</span></div><div class="linkedin-card" aria-label="LinkedIn experience preview"><div class="linkedin-heading"><h3>Experience</h3></div><div class="linkedin-role"><img class="linkedin-company-icon" src="/tasks/assets/fomo-linkedin.svg" alt="fomo" width="48" height="48"><div class="linkedin-role-details"><h3>Campus Lead Intern</h3><p class="linkedin-company">fomo · Internship</p><p class="linkedin-meta linkedin-dates">Start date – Present</p><p class="linkedin-meta" id="experience-school">Your campus</p></div><span class="margin-note">unlocks after<br>five approvals</span></div></div><div class="experience-unlock" hidden><button id="copy-experience" type="button" disabled hidden>Unlocks after 5 approved tasks</button><p id="experience-message" role="status"></p><textarea id="experience-copy-fallback" readonly aria-label="Your LinkedIn experience text" hidden></textarea></div></div>
<div class="board-caption"><strong id="completion-summary">Pick a task. See what you get.</strong><span id="save-status" role="status">Checklists save in this browser.</span></div>
</div>${folio(1)}</section>
${cards}
<section class="page right accent bonus-page" data-page="${offers.length+2}" aria-label="Chapter ${roman(offers.length+2)}: Bonus"><div class="page-inner">
${run('Bonus','right')}<p class="kicker">Chapter ${roman(offers.length+2)}</p><h2 class="title">Want to do<br><span>all five?</span></h2><p class="lede">Every task stands on its own. Finish all five and get them approved for an extra $100.</p>
<div class="plans"><div class="plan"><p>Any task</p><p class="plan-price">Your call</p><ul><li>Pick any task</li><li>Skip any task</li><li>Work in any order</li></ul><button type="button" class="ink" data-goto="2">Start a task</button></div>
<section class="plan dark completion-bonus" aria-label="Five-task completion bonus"><p>All five</p><p class="plan-price completion-amount">$100 <small>bonus</small></p><ul><li>Five approved tasks</li><li>Paid by fomo</li><li>On top of every perk</li></ul><p id="bonus-progress">0 of 5 tasks completed</p><p id="bonus-next">Your choice. All five only if you want the bonus.</p></section></div>
</div>${folio(offers.length+2)}</section>
<section class="page left referral-page" data-page="${offers.length+3}" aria-label="Chapter ${roman(offers.length+3)}: Referral"><div class="page-inner">
${run('Campus tasks','left')}<p class="kicker">Chapter ${roman(offers.length+3)}</p><h2 class="title">Bring another<br><span>chapter</span></h2>
<aside class="referral" aria-label="Optional referral bonus"><details class="faq" open><summary>How much is it?</summary><p>$50 to $100, depending on the chapter’s size. Extra money, anytime, and optional like every other task.</p></details><details class="faq"><summary>How does it work?</summary><ol><li>Refer another chapter.</li><li>They finish onboarding.</li><li>You earn the bonus.</li></ol></details><details class="faq"><summary>Who should I refer?</summary><p>Anyone in another chapter you think fomo should meet. Tell us the chapter, school, and a contact.</p></details><details class="faq referral-form"><summary>Submit a chapter referral</summary><form id="chapter-referral"><label for="referral-notes">Chapter, school, and contact</label><textarea id="referral-notes" rows="4" maxlength="6000" placeholder="Who should fomo connect with?"></textarea><button type="submit" class="primary">Submit referral</button><p id="referral-status" role="status"></p></form></details></aside>
</div>${folio(offers.length+3)}</section>
<section class="page right dark begin-page" id="the-circle" data-page="${offers.length+4}" aria-labelledby="circle-title"><div class="page-inner">
${run('Begin','right')}<div class="begin"><p class="kicker">Chapter ${roman(offers.length+4)}</p><h2 class="title center" id="circle-title">The title didn’t get you here.<br>The way you <em>move</em> did.</h2><p class="lede">One point person on each selected campus, with company capital and opportunities to put behind their people. Work with the companies you like. Pass on anything you don’t.</p><button type="button" class="primary" data-goto="2">Choose your first task</button><p class="small">The access is yours. What you do with it is up to you.</p>
<div class="begin-notes"><section class="trust-card" aria-labelledby="trust-title"><h3 id="trust-title">Grow your role.</h3><p>Strong work unlocks bigger tasks, larger budgets, and more freedom.</p></section><section class="experience-card" aria-labelledby="experience-title"><h3 id="experience-title">Build your team.</h3><p>Hire camera operators and content leads. They get paid work and internship experience alongside you.</p></section></div></div>
</div>${folio(offers.length+4)}</section>
<section class="page left colophon-page" data-page="${offers.length+5}" aria-label="Colophon"><div class="page-inner">
${run('Campus tasks','left')}<div class="colophon">${mark}<p class="kicker plain">Colophon</p><p>This workspace was set in Aeonik, bound in dark linen and printed nowhere, so it can be read on any campus.</p>
<div class="company-strip" aria-label="Companies in your workspace">${companies.filter(c=>c.status==='active').map(c=>`<div class="active-company"><img src="${e(c.logo)}" alt="${e(c.name)}" width="63" height="20"><div><strong>${e(c.description)}</strong><span>${offers.filter(o=>o.companyId===c.id).length} opportunities · Active company</span></div></div>`).join('')}<small>More companies, same circle. New partners will appear here when they launch.</small></div>
<div class="shared-controls"><button id="reload-progress" class="quiet-button" type="button" hidden>Load saved progress</button><p id="shared-message" role="status" aria-live="polite"></p></div></div>
<div class="unused" hidden><div class="workspace-toolbar"><div class="task-filters" role="group" aria-label="Filter opportunities"><button type="button" data-filter="all" aria-pressed="true">All <span data-filter-count="all">5</span></button><button type="button" data-filter="active" aria-pressed="false">In progress <span data-filter-count="active">0</span></button><button type="button" data-filter="review" aria-pressed="false">In review <span data-filter-count="review">0</span></button><button type="button" data-filter="approved" aria-pressed="false">Approved <span data-filter-count="approved">0</span></button></div></div><div id="empty-opportunities" class="empty-opportunities" role="status" hidden><h3 id="empty-title">Your next move is waiting.</h3><p id="empty-description">Choose an opportunity and start with any step.</p><button type="button" id="show-all-tasks" class="quiet-button">Browse all opportunities</button></div></div>
</div>${folio(offers.length+5)}</section>
<section class="page right end-page" data-page="${offers.length+6}" aria-label="The end"><div class="page-inner"><div class="the-end"><h2>The end</h2><nav aria-label="Jump to"><button type="button" data-goto="2">Tasks</button><button type="button" data-goto="${offers.length+2}">Bonus</button><button type="button" data-goto="${offers.length+3}">Referral</button><button type="button" data-close>Close the book</button></nav></div><div class="end-foot">${mark}<span>© 2026 fomo</span></div></div></section>
</main>
</div>
<div class="grip grip-l" data-grip="-1" aria-hidden="true"></div><div class="grip grip-r" data-grip="1" aria-hidden="true"></div>
</div></div>
${leaves()}
</div>
<div class="pencil pencil-fly" id="pencil" aria-hidden="true"><i class="tip"></i></div>
<header class="deskbar"><a href="/tasks2" class="brand" aria-label="Campus Tasks home">${mark}<span>campus tasks</span></a><span class="bound">Campus tasks, bound</span><div class="deskbar-actions"><span class="topbar" hidden><button id="change-profile" class="pill" type="button" hidden>Sign out</button></span><button type="button" class="pill" id="book-toggle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v16H6.5A1.5 1.5 0 0 0 5 20.5v-16Zm0 16A1.5 1.5 0 0 0 6.5 22H19"/></svg><span>Open the book</span></button></div></header>
<p class="hint" aria-hidden="true">Drag a page to turn it, or use the arrow keys</p>
<dialog id="campus-welcome" aria-labelledby="arrival-title" aria-describedby="arrival-description">
<div class="arrival-grid" aria-hidden="true"></div><div class="arrival-halo" aria-hidden="true"></div>
<div class="arrival-top"><span>campus tasks.</span></div>
<div class="arrival-content"><div class="arrival-eyes" aria-hidden="true"></div><p class="arrival-kicker">WELCOME TO CAMPUS TASKS</p><h2 id="arrival-title" data-arrival-name>You’re in.</h2><div class="arrival-campus"><span class="arrival-school-mark"><img data-arrival-logo alt="" width="32" height="32"></span><span data-arrival-school>Your campus</span><span class="arrival-verified" aria-label="Confirmed">✓</span></div><p id="arrival-description">Your campus. Your call.</p><p class="arrival-detail">Build your team.<br>Make something happen.</p></div>
<div class="arrival-bottom"><span>ONE CAMPUS. YOUR LEAD.</span><button type="button" data-arrival-enter autofocus>Enter my campus <span aria-hidden="true">↗</span></button></div><div class="arrival-progress" aria-hidden="true"></div>
</dialog>
</body></html>`;
fs.writeFileSync(new URL('./index.html',import.meta.url),html+'\n');
console.log('Built the book edition of campus tasks.');
