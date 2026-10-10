import fs from 'node:fs';
// Book edition of /tasks. Same accounts, backend and task logic. Each task is a spread: the task on the left, its submission on the right.
const offers=JSON.parse(fs.readFileSync(new URL('./offers.json',import.meta.url),'utf8'));
const companies=JSON.parse(fs.readFileSync(new URL('./companies.json',import.meta.url),'utf8'));
const companyById=new Map(companies.map(company=>[company.id,company]));
for(const offer of offers){if(!companyById.has(offer.companyId))throw Error('Unknown company for '+offer.id);}
const icons=JSON.parse(fs.readFileSync(new URL('./icons.json',import.meta.url),'utf8'));
const e=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const V='20261009-book3';
// Two-tone headline: first sentence dark, the rest grey.
function split(text){const m=text.match(/^(.+?[.?!])\s+(.+)$/);if(m)return[m[1],m[2]];const w=text.split(' ');const k=Math.min(3,Math.ceil(w.length/2));return[w.slice(0,k).join(' '),w.slice(k).join(' ')];}
const title=text=>{const[a,b]=split(text);return`<h2 class="title">${e(a)}<br><span>${e(b)}</span></h2>`;};
const folio=n=>`<span class="folio" aria-hidden="true">${n}</span>`;
const mark=`<span class="mark" aria-hidden="true"><i></i></span>`;

// Signed-in pages: 0 contents, 1 bonus, then one spread per task (task page even, submit page odd).
const shortName={dinner:'Dinner',filmer:'Filmer',host:'Host',travel:'Travel',calendar:'Calendar'};
const taskPage=i=>2+i*2,referralPage=taskPage(offers.length);
const chapters=[...offers.map((o,i)=>({n:i+1,page:taskPage(i),id:o.id,label:o.title,tab:shortName[o.id]||o.title})),{n:offers.length+1,page:referralPage,id:'referral',label:'Refer another chapter',tab:'Refer'},{n:'+',page:1,id:'bonus',label:'Bonus & LinkedIn'}];
const tabColors=['blue','yellow','white','linen','lilac','mint'];

// Contents rows expand to show what each task gives you, with a link to its page.
const firstSentence=t=>(t.match(/^.+?[.!?](?=\s|$)/)||[t])[0];
const details={referral:{perk:'Bring another chapter.',text:'Refer a chapter at another school. When they finish onboarding, you get $50 to $100.',highlights:['$50–$100 per chapter','Paid after onboarding']},bonus:{perk:'Finish all five. Get $100.',text:'Get all five tasks approved for an extra $100 and a LinkedIn experience you can copy.',highlights:['$100 bonus','LinkedIn experience']}};
for(const o of offers)details[o.id]={perk:o.perk.title,text:firstSentence(o.perk.description),highlights:o.perk.highlights};
const toc=(prefix,cta)=>chapters.map(c=>{const d=details[c.id],id=prefix+'-'+c.id;return`<li class="toc-item"><button type="button" class="toc-row" aria-expanded="false" aria-controls="${id}"><span class="toc-n">${c.n}</span><span class="toc-label">${e(c.label)}</span><span class="toc-status" data-status-for="${e(c.id)}"></span><span class="toc-dots" aria-hidden="true"></span><span class="toc-p">p. ${c.page}</span><span class="toc-chev" aria-hidden="true"></span></button><div class="toc-detail" id="${id}" inert><div><p class="toc-perk">${e(d.perk)}</p><p>${e(d.text)}</p><ul>${d.highlights.map(h=>`<li>${e(h)}</li>`).join('')}</ul><button type="button" class="primary" data-goto="${c.page}">${cta}</button></div></div></li>`;}).join('');

const calendarPanel=`<section class="calendar-panel" aria-label="Your social calendar"><div id="calendar-drop" class="file-drop"><label for="calendar-file">Drop a file or <span>choose one</span></label><input id="calendar-file" type="file" accept=".pdf,.csv,.xlsx,.xls,.ics,.doc,.docx,.png,.jpg,.jpeg,.webp"><p>PDF, spreadsheet, calendar, doc or image · 10 MB</p></div><div id="calendar-attachment" hidden><strong id="calendar-file-name"></strong><div><button type="button" id="download-calendar" class="quiet-button">Download</button><button type="button" id="remove-calendar" class="quiet-button">Remove</button></div></div><p class="calendar-divider">or enter dates</p><div id="calendar-events"></div><button type="button" id="add-event" class="quiet-button">+ Add an event</button><p id="calendar-status" role="status" aria-live="polite"></p></section>`;

const cards=offers.map((o,i)=>{const n=i+1,page=taskPage(i),name=shortName[o.id]||o.title;return`<article class="task-card spread" data-task="${e(o.id)}" data-company="${e(o.companyId)}" aria-label="Task ${n}: ${e(o.title)}">
<section class="page left${o.id==='dinner'?' dark':''}" data-page="${page}" data-short="${e(name)}" aria-label="Task ${n}: ${e(o.title)}"><div class="page-inner">
<div class="task-head"><p class="kicker">Task ${n} · ${e(o.title)}</p><span class="status" data-status>Available</span></div>${title(o.perk.title)}
<p class="review-feedback" role="status" hidden></p>
<p class="description">${e(o.perk.description)}</p>
<ul class="perks">${o.perk.highlights.map(p=>`<li>${icons.check}${e(p)}</li>`).join('')}</ul>
<blockquote class="pitch">“${e(o.perk.pitch)}”</blockquote>
<div class="section-row"><h3 class="section-label">What to do</h3><span data-count>0 of ${o.tasks.length} checklist items complete</span></div>
<div class="checklist">${o.tasks.map((t,j)=>`<label class="check-item"><input type="checkbox" data-check="${j}" ${o.id==='calendar'?'disabled':''}><span><strong>${e(t.title)}</strong><span>${e(t.detail)}</span><span class="task-win">${icons.gift}${e(o.perk.taskWins[j])}</span></span></label>`).join('')}</div>
</div>${folio(page)}</section>
<section class="page right submit-page" data-page="${page+1}" data-short="${e(name)} · Submit" aria-label="Submit task ${n}"><div class="page-inner">
<p class="kicker">Submit · Task ${n}</p><h2 class="title">Send your work<br><span>for review.</span></h2>
<div class="steps">${o.tasks.map((t,j)=>`<div class="step-editor" data-step-editor data-task-id="${e(o.id)}" data-step="${j}"><div class="step-editor-top"><strong><span>${j+1}</span>${e(t.title)}</strong><span data-step-status>Not submitted</span></div>${o.id==='calendar'?calendarPanel:''}<textarea id="step-${e(o.id)}-${j}" data-step-notes rows="2" maxlength="6000" aria-label="Your update for step ${j+1}" placeholder="${e(t.input||'Details, names or links…')}"></textarea><div data-step-files></div><p class="review-feedback" data-step-feedback hidden></p><div class="step-actions"><label class="step-upload" title="Up to 5 files, 10 MB each">Add files<input type="file" data-step-upload multiple accept=".pdf,.csv,.xlsx,.xls,.ics,.doc,.docx,.png,.jpg,.jpeg,.webp,.mp4,.mov"></label><button type="button" data-step-submit>Send for review</button></div><p data-step-message role="status" aria-live="polite"></p></div>`).join('')}</div>
<p class="files-note">Up to 5 files per step, 10 MB each. Paste a link for longer videos.</p>
<details class="more"><summary>Notes for fomo</summary><form class="update-form"><input id="chapter-${e(o.id)}" data-chapter type="text" maxlength="160" aria-label="Your chapter and school" placeholder="Chapter · school"><textarea id="notes-${e(o.id)}" data-notes rows="3" maxlength="6000" aria-label="Extra task notes" placeholder="Anything else fomo should know"></textarea><p class="copy-status" role="status" aria-live="polite"></p></form></details>
</div>${folio(page+1)}</section>
</article>`;}).join('\n');

const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Campus Tasks</title><meta name="description" content="Choose campus tasks, build your team, and lead your campus with fomo."><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/tasks/assets/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500&display=swap"><link rel="stylesheet" href="/tasks2/book.css?v=${V}"><script type="module" src="/tasks2/book.js?v=${V}"></script><script type="module" src="/tasks2/tasks.js?v=${V}"></script></head><body><noscript><p class="notice">Enable JavaScript to open Campus Tasks.</p></noscript>
<div class="scene">
<div class="desk" aria-hidden="true"></div>
<div class="props" aria-hidden="true"><div class="pad" data-prop="pad"></div><div class="mug" data-prop="mug"><i></i></div><div class="notepad" data-prop="notepad"><div class="pencil pencil-rest"><i class="tip"></i></div></div></div>
<section class="hero" aria-labelledby="hero-title"><h1 id="hero-title">Campus tasks<br><span>you can read</span></h1><p>Six tasks bound in one book. Open the cover and turn the pages.</p></section>
<div class="corner corner-l" aria-hidden="true"><small>Edition</small>Vol. 01, fourteen pages</div><div class="corner corner-r" aria-hidden="true">Open the cover</div>
<div class="book-wrap"><div class="book" id="book">
<div class="board board-l" aria-hidden="true"></div><div class="board board-r" aria-hidden="true"></div><div class="stack stack-l" aria-hidden="true"></div><div class="stack stack-r" aria-hidden="true"></div>
<div class="ribbon" aria-hidden="true"></div>
<nav class="tabs" aria-label="Tasks">${chapters.filter(c=>c.tab).map((c,i)=>`<button type="button" class="tab tab-${tabColors[i]}" data-goto="${c.page}" style="--i:${i}">${e(c.tab)}</button>`).join('')}</nav>
<div class="leaves3d" id="pages">
<button type="button" class="cover right" id="cover" aria-label="Open the book"><span class="cover-face cover-front"><span class="cover-mark"><i></i></span><span class="cover-title">campus tasks</span><span class="cover-vol">Vol. 01</span></span><span class="cover-face cover-back" aria-hidden="true"></span></button>
<section class="page left" id="contents-page" data-page="0" data-short="Contents" aria-label="Contents"><div class="page-inner">
<p class="kicker">Six tasks, one book</p><div class="brand-big">${mark}<span>campus tasks</span></div>
<ol class="toc">${toc("pre","Sign in to start")}</ol><p class="toc-note" id="toc-note" role="status" aria-live="polite"></p>
</div>${folio('')}</section>
<section class="page right" id="auth-page" data-page="1" data-short="Sign in" aria-label="Sign in"><div class="page-inner">
<span class="start-here" aria-hidden="true">start here</span>
<dialog id="welcome" aria-labelledby="welcome-title"><form id="welcome-form"><h2 id="welcome-title" class="title">Your campus.<br><span>Your call.</span></h2><p id="auth-context" class="lede">Create an account to choose campus tasks and track your work.</p><div class="auth-tabs" role="group" aria-label="Account access"><button type="button" id="auth-create" aria-pressed="true">Create account</button><button type="button" id="auth-signin" aria-pressed="false">Sign in</button></div><div id="signup-fields"><label for="member-name">Your name</label><input id="member-name" name="name" autocomplete="name" maxlength="100" required placeholder="First and last name"><label for="member-school">Your school</label><div class="school-picker"><input id="member-school" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="school-options" aria-describedby="school-search-status" autocomplete="off" spellcheck="false" required disabled placeholder="Loading schools…"><ul id="school-options" role="listbox" aria-label="Matching schools" hidden></ul></div><p id="school-search-status" class="field-help" role="status" aria-live="polite">Type your school name or abbreviation.</p></div><label for="member-email">Email address</label><input id="member-email" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@school.edu"><label for="member-password" id="password-label">Create a password</label><input id="member-password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required aria-describedby="password-help"><p id="password-help" class="field-help">At least 12 characters. Use a password you don’t use elsewhere.</p><div id="password-confirm-field"><label for="member-password-confirm">Confirm password</label><input id="member-password-confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div><p id="welcome-error" role="alert"></p><button id="auth-new-profile" type="button" class="quiet-button" hidden>Keep drafts &amp; create a new profile</button><button id="retry-schools" type="button" class="quiet-button" hidden>Retry loading schools</button><div class="welcome-actions"><button id="welcome-continue" type="submit" class="primary" disabled>Enter my workspace</button><button id="welcome-cancel" type="button" class="quiet-button" hidden>Cancel</button></div></form></dialog>
</div>${folio(1)}</section>
<main hidden>
<section class="page left contents-post" data-page="0" data-short="Contents" aria-labelledby="campus-title"><div class="page-inner">
<div class="campus-identity"><div class="school-logo-wrap" hidden><img id="school-logo" alt="" width="40" height="40"></div><div><p id="member-greeting">Your campus workspace</p><p id="pass-school">Personally selected.</p></div></div>
<h1 id="campus-title" class="title">Their capital.<br><span>Your campus. Your call.</span></h1>
<p class="lede campus-authority">Every task is optional. Pick any, skip any, in any order.</p>
<ol class="toc">${toc("post","Open this task →")}</ol>
<div class="board-caption"><strong id="completion-summary">Pick a task. See what you get.</strong><span id="save-status" role="status">Checklists save in this browser.</span></div>
</div>${folio('')}</section>
<section class="page right accent end-page" data-page="1" data-short="Bonus" aria-label="Bonus and LinkedIn"><div class="page-inner">
<p class="kicker">Your bonus</p><h2 class="title">Finish all five.<br><span>Get $100.</span></h2>
<section class="plan dark completion-bonus" aria-label="Five-task completion bonus"><p class="plan-price completion-amount">$100 <small>bonus</small></p><p id="bonus-progress">0 of 5 tasks completed</p><p id="bonus-next">Your choice. All five only if you want the bonus.</p></section>
<div class="career-preview"><div class="linkedin-card" aria-label="LinkedIn experience preview"><div class="linkedin-role"><img class="linkedin-company-icon" src="/tasks/assets/fomo-linkedin.svg" alt="fomo" width="48" height="48"><div class="linkedin-role-details"><h3>Campus Lead Intern</h3><p class="linkedin-company">fomo · Internship</p><p class="linkedin-meta" id="experience-school">Your campus</p></div><span class="margin-note">LinkedIn ·<br>after 5 approvals</span></div></div><div class="experience-unlock" hidden><button id="copy-experience" type="button" disabled hidden>Unlocks after 5 approved tasks</button><p id="experience-message" role="status"></p><textarea id="experience-copy-fallback" readonly aria-label="Your LinkedIn experience text" hidden></textarea></div></div>
<div class="end-links"><button type="button" data-goto="2">Start task 1</button><button id="reload-progress" type="button" hidden>Load saved progress</button></div><p id="shared-message" role="status" aria-live="polite"></p>
<div class="unused" hidden><div class="task-filters" role="group" aria-label="Filter opportunities"><button type="button" data-filter="all" aria-pressed="true">All <span data-filter-count="all">5</span></button><button type="button" data-filter="active" aria-pressed="false">In progress <span data-filter-count="active">0</span></button><button type="button" data-filter="review" aria-pressed="false">In review <span data-filter-count="review">0</span></button><button type="button" data-filter="approved" aria-pressed="false">Approved <span data-filter-count="approved">0</span></button></div><div id="empty-opportunities" role="status" hidden><h3 id="empty-title">Your next move is waiting.</h3><p id="empty-description">Choose an opportunity and start with any step.</p><button type="button" id="show-all-tasks">Browse all opportunities</button></div></div>
</div>${folio(1)}</section>
${cards}
<article class="spread" aria-label="Task ${offers.length+1}: Refer another chapter">
<section class="page left referral-page" data-page="${referralPage}" data-short="Refer" aria-label="Task ${offers.length+1}: Refer another chapter"><div class="page-inner">
<div class="task-head"><p class="kicker">Task ${offers.length+1} · Refer another chapter</p><span class="status">$50–$100</span></div><h2 class="title">Bring another<br><span>chapter.</span></h2>
<p class="description">Refer a chapter at another school. When they finish onboarding with fomo, you get $50 to $100, depending on the chapter’s size.</p>
<ol class="referral-steps"><li>Refer another chapter.</li><li>They finish onboarding.</li><li>You earn the bonus.</li></ol>
</div>${folio(referralPage)}</section>
<section class="page right submit-page" data-page="${referralPage+1}" data-short="Refer · Submit" aria-label="Submit a referral"><div class="page-inner">
<p class="kicker">Submit · Task ${offers.length+1}</p><h2 class="title">Who should<br><span>fomo meet?</span></h2>
<form id="chapter-referral"><textarea id="referral-notes" rows="6" maxlength="6000" aria-label="Chapter, school and contact" placeholder="Chapter, school and a contact"></textarea><button type="submit" class="primary">Submit referral</button><p id="referral-status" role="status"></p></form>
<div class="end-links ink-links"><button type="button" data-close>Close the book</button></div>
</div>${folio(referralPage+1)}</section>
</article>
</main>
</div>
<div class="grip grip-l" data-grip="-1" aria-hidden="true"></div><div class="grip grip-r" data-grip="1" aria-hidden="true"></div>
<button type="button" class="resize-handle" id="resize-handle" aria-label="Resize the book. Drag, or use the arrow keys; double-click to reset"><i></i></button>
</div></div>
</div>
<div class="pencil pencil-fly" id="pencil" aria-hidden="true"><i class="tip"></i></div>
<header class="deskbar"><a href="/tasks2" class="brand" aria-label="Campus Tasks home">${mark}<span>campus tasks</span></a><span class="bound">Campus tasks, bound</span><div class="deskbar-actions"><span class="zoom" role="group" aria-label="Book size"><button type="button" data-zoom="-1" aria-label="Smaller book">−</button><button type="button" data-zoom="1" aria-label="Bigger book">+</button></span><span class="topbar" hidden><button id="change-profile" class="pill" type="button" hidden>Sign out</button></span><button type="button" class="pill" id="book-toggle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v16H6.5A1.5 1.5 0 0 0 5 20.5v-16Zm0 16A1.5 1.5 0 0 0 6.5 22H19"/></svg><span>Open the book</span></button></div></header>
<p class="hint" aria-hidden="true">Drag a page to turn it, or use the arrow keys</p>
<nav class="pager" aria-label="Pages"><button type="button" data-turn="-1" aria-label="Previous page">‹</button><span id="pager-label" aria-live="polite"></span><button type="button" data-turn="1" aria-label="Next page">›</button></nav>
<dialog id="campus-welcome" aria-labelledby="arrival-title" aria-describedby="arrival-description">
<div class="arrival-grid" aria-hidden="true"></div><div class="arrival-halo" aria-hidden="true"></div>
<div class="arrival-top"><span>campus tasks.</span></div>
<div class="arrival-content"><div class="arrival-eyes" aria-hidden="true"></div><p class="arrival-kicker">WELCOME TO CAMPUS TASKS</p><h2 id="arrival-title" data-arrival-name>You’re in.</h2><div class="arrival-campus"><span class="arrival-school-mark"><img data-arrival-logo alt="" width="32" height="32"></span><span data-arrival-school>Your campus</span><span class="arrival-verified" aria-label="Confirmed">✓</span></div><p id="arrival-description">Your campus. Your call.</p><p class="arrival-detail">Build your team.<br>Make something happen.</p></div>
<div class="arrival-bottom"><span>ONE CAMPUS. YOUR LEAD.</span><button type="button" data-arrival-enter autofocus>Enter my campus <span aria-hidden="true">↗</span></button></div><div class="arrival-progress" aria-hidden="true"></div>
</dialog>
</body></html>`;
fs.writeFileSync(new URL('./index.html',import.meta.url),html+'\n');
console.log('Built the book edition of campus tasks.');
