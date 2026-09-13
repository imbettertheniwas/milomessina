'use strict';
(() => {
  const savedSnapshot=JSON.parse(document.getElementById('chapters-data').textContent);
  let {chapters}=savedSnapshot;
  let chapterFeed,rankChapters;
  const byId = new Map(chapters.map(chapter => [chapter.id, chapter]));
  const neighborhood = document.getElementById('neighborhood');
  let cards = [...document.querySelectorAll('.house-card')];
  const cardTemplate = cards[0].cloneNode(true);
  const panel = document.getElementById('chapter-panel');
  const panelShare = document.getElementById('panel-share');
  const panelClaim = document.getElementById('panel-claim');
  const canonicalUrl = 'https://milomessina.com/fomo/campuswars/';
  const drawer = document.getElementById('village-drawer');
  const drawerToggle = document.getElementById('village-chapters');
  function setDrawer(open) {
    drawer.hidden = !open;
    drawerToggle.setAttribute('aria-expanded', String(open));
    // The phone sheet shares the bottom edge with the controls, so they take turns.
    villageShell.classList.toggle('drawer-open', open);
    if(open){setMoreControls(false);chapterFeed?.refresh();}
  }
  drawerToggle.addEventListener('click', () => setDrawer(drawer.hidden));
  document.getElementById('drawer-close').addEventListener('click', () => {setDrawer(false);drawerToggle.focus();});
  const moreButton=document.getElementById('village-more');
  const extraControls=document.getElementById('village-extra-controls');
  const villageShell=document.getElementById('village');
  function setMoreControls(open){
    villageShell.classList.toggle('controls-open',open);
    moreButton.setAttribute('aria-expanded',String(open));
    moreButton.textContent=open?'Close ×':'More ···';
  }
  moreButton.addEventListener('click',()=>setMoreControls(moreButton.getAttribute('aria-expanded')!=='true'));
  document.addEventListener('pointerdown',event=>{
    if(!extraControls.contains(event.target)&&!moreButton.contains(event.target))setMoreControls(false);
  });
  extraControls.addEventListener('click',event=>{
    if(event.target.closest('#village-leaderboard,#village-overview,#village-expand')){setMoreControls(false);if(matchMedia('(max-width: 700px), (pointer: coarse)').matches)moreButton.focus();}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&moreButton.getAttribute('aria-expanded')==='true'){setMoreControls(false);moreButton.focus();}
  });
  document.addEventListener('village:introstart',()=>setMoreControls(false));
  const about = document.getElementById('about-dialog');
  document.getElementById('village-about').addEventListener('click', () => about.showModal());
  document.getElementById('about-close').addEventListener('click', () => about.close());
  document.getElementById('intro-replay').addEventListener('click', () => {about.close();setDrawer(false);document.dispatchEvent(new CustomEvent('village:replay'));});
  document.addEventListener('keydown', event => {if(event.key === 'Escape' && !drawer.hidden){setDrawer(false);drawerToggle.focus();}});
  document.addEventListener('village:introstart', () => setDrawer(false));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let selectedId = 'sigma-chi-sdsu';
  const text = (id, value) => { document.getElementById(id).textContent = value; };

  const partyToggle = document.getElementById('party-toggle');
  let partyPaused = reducedMotion;
  partyToggle.hidden = reducedMotion;
  partyToggle.addEventListener('click', () => {
    partyPaused = !partyPaused;
    partyToggle.textContent = partyPaused ? 'Resume activity' : 'Pause activity';
    partyToggle.setAttribute('aria-pressed', String(partyPaused));
    document.dispatchEvent(new CustomEvent('party:pause', {detail: {paused: partyPaused}}));
  });

  function selectChapter(id, { writeHash = true, scroll = false, emit = true } = {}) {
    const chapter = byId.get(id);
    if (id !== 'empty' && !chapter) return;
    selectedId = id;
    cards.forEach(card => {
      const selected = card.dataset.chapter === id;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
      if (selected && scroll) {
        neighborhood.scrollTo({
          left: Math.max(0, neighborhood.scrollLeft + card.getBoundingClientRect().left - neighborhood.getBoundingClientRect().left - (neighborhood.clientWidth - card.offsetWidth) / 2),
          behavior: reducedMotion ? 'instant' : 'smooth'
        });
      }
    });
    panelShare.hidden = !chapter;
    panelClaim.hidden = Boolean(chapter);
    panel.classList.toggle('claim-mode', !chapter);
    if (chapter) {
      const target = Math.ceil(chapter.active * 0.8);
      const remaining = Math.max(0, target - chapter.joined);
      text('panel-letters', chapter.letters);
      text('panel-school', chapter.school.toUpperCase());
      text('panel-name', chapter.name);
      text('panel-target', chapter.joined<15 ? `${15-chapter.joined} more to build your house.` : remaining ? `${remaining} more to qualify.` : 'Your house reached 80%.');
      text('panel-detail', `${chapter.joined} / ${target} joined · 80% qualification target`);
      panelShare.setAttribute('aria-label', `Share ${chapter.name}’s Greek Wars progress`);
    } else {
      text('panel-letters', '+');
      text('panel-school', 'YOUR HOUSE BELONGS HERE');
      text('panel-name', 'Your house starts here.');
      text('panel-target', 'Claim your place on the row.');
      text('panel-detail', 'Get your invite link. Bring your people. Build your house.');
    }
    if (writeHash) history.replaceState(null, '', `${location.pathname}${location.search}#chapter=${encodeURIComponent(id)}`);
    if (emit) document.dispatchEvent(new CustomEvent('chapter:select', {detail: {id, focus: true}}));
  }

  document.addEventListener('village:select', event => {
    selectChapter(event.detail.id, {emit: false});
    if (event.detail.interactive) setDrawer(true);
  });
  let drag = null;
  let dragged = false;
  neighborhood.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, left: neighborhood.scrollLeft, pointer: event.pointerId };
    dragged = false;
  });
  neighborhood.addEventListener('pointermove', event => {
    if (!drag) return;
    const delta = event.clientX - drag.x;
    if (Math.abs(delta) > 6) {
      dragged = true;
      neighborhood.classList.add('dragging');
      if (!neighborhood.hasPointerCapture(drag.pointer)) neighborhood.setPointerCapture(drag.pointer);
      neighborhood.scrollLeft = drag.left - delta;
      event.preventDefault();
    }
  });
  function finishDrag() {
    if (drag && neighborhood.hasPointerCapture(drag.pointer)) neighborhood.releasePointerCapture(drag.pointer);
    drag = null;
    neighborhood.classList.remove('dragging');
  }
  neighborhood.addEventListener('pointerup', finishDrag);
  neighborhood.addEventListener('pointercancel', finishDrag);
  neighborhood.addEventListener('lostpointercapture', () => {drag = null; neighborhood.classList.remove('dragging');});
  neighborhood.addEventListener('click', event => {
    if (dragged) {event.preventDefault();event.stopImmediatePropagation();dragged = false;}
  }, true);
  function bindCard(card) {
    card.addEventListener('click', () => selectChapter(card.dataset.chapter));
    card.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const visible = cards.filter(item => !item.hidden);
      const index = visible.indexOf(card);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : Math.min(visible.length - 1, Math.max(0, index + (event.key === 'ArrowRight' ? 1 : -1)));
      visible[next].focus({preventScroll: true});
      selectChapter(visible[next].dataset.chapter, {scroll: true});
    });
  }
  cards.forEach(bindCard);

  const toast = document.querySelector('.toast');
  let toastTimer;
  function notify(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4500);
  }
  async function share(chapter) {
    const target = chapter ? Math.ceil(chapter.active * 0.8) : 0;
    const url = chapter ? `${canonicalUrl}#chapter=${encodeURIComponent(chapter.id)}` : canonicalUrl;
    const data = {
      title: chapter ? `${chapter.letters} — fomo Greek Wars` : 'Get your chapter paid — fomo Greek Wars',
      text: chapter ? `${chapter.name}: ${chapter.joined} in, ${Math.max(0, target - chapter.joined)} more to hit 80%. Let’s get the house on fomo.` : 'There’s an empty lot for our chapter in the Greek village. $500,000 committed. Who’s getting our house on the map?',
      url
    };
    if (navigator.share) {
      try { await navigator.share(data); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copied. Send it to the group chat.');
    } catch (_) {
      const fallback = document.querySelector('.copy-fallback');
      fallback.hidden = false;
      const input = fallback.querySelector('input');
      input.value = url;
      input.focus();
      input.select();
      input.scrollIntoView({block:'center',behavior:reducedMotion?'instant':'smooth'});
      notify('Select and copy the link below.');
    }
  }
  panelShare.addEventListener('click', () => share(byId.get(selectedId)));
  document.querySelectorAll('[data-share]').forEach(button => button.addEventListener('click', () => share()));
  function readHash() {
    const id = new URLSearchParams(location.hash.slice(1)).get('chapter');
    if (id && (id === 'empty' || byId.has(id))) {
      selectChapter(id, {writeHash: false, scroll: true});
    }
  }
  addEventListener('hashchange', readHash);
  selectChapter(selectedId, {writeHash: false, emit: false});
  readHash();
  import('./village.js?v=77').catch(error => {
    console.error('Unable to load Greek village:', error);
    document.getElementById('village-loading').textContent = 'The village couldn’t load. Open Chapters to browse progress or join Greek Wars.';
    document.getElementById('village').classList.remove('intro-playing');
    document.getElementById('village-intro').hidden = true;
    document.getElementById('village').classList.add('village-unavailable');
  });
  let lastUpdated=savedSnapshot.updatedAt;
  function updateChapters(snapshot) {
    const focusedChapter = document.activeElement?.closest('.house-card')?.dataset.chapter;
    // Match the displayed house ranks, including identical progress ties.
    chapters = rankChapters(snapshot.chapters);
    byId.clear();chapters.forEach(c => byId.set(c.id,c));
    const track = document.getElementById('house-track'), empty = cards.find(c => c.dataset.chapter === 'empty');
    const existing = new Map(cards.map(c => [c.dataset.chapter,c]));
    for (const card of cards) if (card !== empty && !byId.has(card.dataset.chapter)) card.remove();
    for (const chapter of chapters) {
      let card = existing.get(chapter.id);
      if (!card) {card = cardTemplate.cloneNode(true);card.dataset.chapter = chapter.id;bindCard(card);}
      card.querySelector('.house-label strong').textContent = chapter.letters;
      card.querySelector('.house-rank').textContent = `#${chapter.rank}`;
      card.querySelector('.house-label span').textContent = chapter.shortSchool;
      const progress = chapter.joined / chapter.active * 100,target = Math.ceil(chapter.active*.8);
      const line = card.querySelector('.house-progress > span');
      const count = document.createElement('b');count.textContent = chapter.joined;
      const percent = document.createElement('em');percent.textContent = `${Math.round(progress)}% of roster`;
      line.replaceChildren(count,document.createTextNode(` / ${target} target `),percent);
      card.querySelector('.progress-track i').style.width = `${Math.min(100,progress)}%`;
      card.setAttribute('aria-label',`Rank ${chapter.rank}: ${chapter.name}, ${chapter.school}: ${chapter.joined} of ${target} members toward the 80% target`);
      track.insertBefore(card,empty);
    }
    cards = [...track.querySelectorAll('.house-card')];
    const current = {...snapshot,chapters};
    const requestedChapter = new URLSearchParams(location.hash.slice(1)).get('chapter');
    if (requestedChapter === 'empty' || byId.has(requestedChapter)) selectedId = requestedChapter;
    if (selectedId !== 'empty' && !byId.has(selectedId)) selectedId = chapters[0]?.id || 'empty';
    document.getElementById('chapters-data').textContent = JSON.stringify(current);
    document.dispatchEvent(new CustomEvent('chapters:update',{detail:{...current,selectedId}}));
    selectChapter(selectedId,{writeHash:false,emit:false});
    if (focusedChapter) cards.find(card => card.dataset.chapter === focusedChapter)?.focus({preventScroll:true});
  }
  Promise.all([import('./chapter-feed.js?v=76'),import('./village-competition.js?v=56')]).then(([{startChapterFeed},{houseStandings}]) => {
    rankChapters=houseStandings;
    updateChapters(savedSnapshot);
    chapterFeed=startChapterFeed({
    initialSnapshot:savedSnapshot,
    onUpdate:updateChapters,
    onStatus(status) {
      if (status.updatedAt) lastUpdated = status.updatedAt;
      const time = lastUpdated ? new Date(lastUpdated).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) : '';
      document.getElementById('chapter-sync').textContent = status.live ? `Live onboarding · Updated ${time} · Refreshes every 30 seconds` : lastUpdated ? `Updates reconnecting · Showing data from ${time}` : 'Connecting to live onboarding · Showing saved registrations';
    }
    });
  }).catch(() => {document.getElementById('chapter-sync').textContent = 'Live updates unavailable · Showing saved registrations';});
})();
