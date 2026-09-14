import {INTRO_DURATION, introCaptionAt} from '/fomo/campuswars/village-intro.js?v=44';

const opening = document.getElementById('opening');
const video = document.getElementById('intro-video');
const page = document.getElementById('page');
const programs = document.getElementById('programs');
const replay = document.getElementById('replay-intro');
const progress = document.getElementById('film-progress');
const caption = document.getElementById('film-caption');
const title = document.getElementById('film-title');
const description = document.getElementById('film-description');
const transition = document.getElementById('intro-transition');
const heroAmount = document.querySelector('.commitment-hero > strong');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const returningFromHistory = document.documentElement.classList.contains('intro-return');
let introComplete = returningFromHistory;
let active = false, usedFallback = false, finishTimer, raf = 0;
let playRetry, playAttempts = 0, stallTimer, playbackRevision = 0;
function cancelStallTimer() { clearTimeout(stallTimer); stallTimer = undefined; }
function watchPlayback() {
  cancelStallTimer();
  if (active && !document.hidden) stallTimer = setTimeout(() => finish(), 8000);
}
let videoFrame = 0, lastPaint = -1, lastStage = -1, lastOutro = -1;

function focusDestination() {
  let target = programs;
  try {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) target = document.getElementById(id) || programs;
  } catch {}
  if (target === programs) window.scrollTo({top: 0, behavior: 'instant'});
  else target.scrollIntoView({behavior: 'instant', block: 'start'});
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({preventScroll: true});
}

function alignTransition() {
  if (transition.hidden) return;
  // Follow the hero's real layout, including its header and responsive spacing.
  const target = heroAmount.getBoundingClientRect();
  transition.style.setProperty('--logo-x', `${target.left + target.width / 2}px`);
  transition.style.setProperty('--logo-y', `${target.top + target.height / 2}px`);
}
window.addEventListener('resize', alignTransition);
document.fonts?.ready.then(alignTransition);

function paint(mediaTime = video.currentTime || 0) {
  const seconds = Math.min(INTRO_DURATION, mediaTime);
  lastPaint = seconds;
  const copy = introCaptionAt(seconds);
  if (copy.index !== lastStage) {
    title.textContent = copy.index === 1 ? "IF YOU'RE IN A CHAPTER." : copy.title;
    description.textContent = copy.description;
    lastStage = copy.index;
  }
  caption.style.opacity = video.paused ? '1' : String(copy.copyOpacity * copy.opacity);
  caption.style.transform = `translateY(${video.paused ? 0 : copy.lift}px) scale(${video.paused ? 1 : copy.scale})`;
  progress.style.transform = `scaleX(${Math.min(1, seconds / INTRO_DURATION)})`;
  const outro = Math.max(0, Math.min(1, (seconds - (INTRO_DURATION - 1.4)) / 1.4));
  if (outro !== lastOutro) {
    transition.style.setProperty('--outro', String(outro));
    lastOutro = outro;
  }
}
function cancelPaint() {
  cancelAnimationFrame(raf);
  if (videoFrame) video.cancelVideoFrameCallback(videoFrame);
  raf = videoFrame = 0;
}
function schedulePaint() {
  if (!active || video.paused) return;
  if (typeof video.requestVideoFrameCallback === 'function') {
    videoFrame = video.requestVideoFrameCallback((_, metadata) => {
      videoFrame = 0;
      paint(metadata.mediaTime);
      schedulePaint();
    });
  } else {
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (Math.abs(video.currentTime - lastPaint) >= 1 / 30) paint();
      schedulePaint();
    });
  }
}
function syncPlayback() {
  cancelPaint();
  if (video.readyState >= 2) {
    video.classList.add('has-frame');
    opening.classList.add('has-video-frame');
  }
  if (active) { paint(); schedulePaint(); }
}
function cancelPlayRetry() {
  clearTimeout(playRetry);
  playRetry = undefined;
}
function play() {
  if (!active || document.hidden) return;
  cancelPlayRetry();
  video.defaultMuted = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.controls = false;
  const revision = playbackRevision;
  const pending = video.play();
  if (pending) pending.catch(() => {
    if (!active || document.hidden || revision !== playbackRevision) return;
    syncPlayback();
    // Retry startup races after visibility/layout settles, without a click.
    // A browser's explicit autoplay restriction still takes precedence.
    if (playAttempts < 4) {
      playRetry = setTimeout(play, 250 * 2 ** playAttempts++);
    } else finish();
  });
}
function rememberVisit() {
  try {
    history.replaceState({...history.state, campusLanding: {introDone: introComplete, scrollY: window.scrollY}}, '');
  } catch {}
}
function restorePage() {
  clearTimeout(finishTimer);
  active = false;
  playbackRevision++;
  cancelStallTimer();
  cancelPlayRetry();
  cancelPaint();
  video.pause();
  opening.hidden = true;
  opening.inert = true;
  transition.hidden = true;
  document.documentElement.classList.remove('intro-initial', 'intro-return');
  document.body.classList.remove('intro-active');
  page.classList.remove('hero-arriving');
  page.inert = false;
  let scrollY = 0;
  try { scrollY = history.state?.campusLanding?.scrollY || 0; } catch {}
  window.scrollTo({top: scrollY, behavior: 'instant'});
}
function finish({scroll = true, cinematic = false} = {}) {
  if (!active) return;
  active = false;
  playbackRevision++;
  cancelStallTimer();
  introComplete = true;
  cancelPlayRetry();
  rememberVisit();
  cancelPaint();
  video.pause();
  opening.inert = true;
  const revealPage = () => {
    opening.hidden = true;
    document.documentElement.classList.remove('intro-initial');
    document.body.classList.remove('intro-active');
    page.inert = false;
    if (scroll) {
      focusDestination();
    }
    if (cinematic && !reduced.matches) {
      alignTransition();
      page.classList.add('hero-arriving');
      transition.classList.add('is-leaving');
      finishTimer = setTimeout(() => {
        transition.hidden = true;
        page.classList.remove('hero-arriving');
      }, 900);
    } else transition.hidden = true;
  };
  if (cinematic && !reduced.matches) {
    transition.style.setProperty('--outro', '1');
    finishTimer = setTimeout(revealPage, 320);
  } else revealPage();
}
function start({replay: replaying = false} = {}) {
  clearTimeout(finishTimer);
  active = true; usedFallback = false;
  playbackRevision++;
  watchPlayback();
  cancelPlayRetry(); playAttempts = 0;
  lastPaint = lastStage = lastOutro = -1;
  transition.hidden = false;
  transition.classList.remove('is-leaving');
  transition.style.setProperty('--outro', '0');
  page.classList.remove('hero-arriving');
  document.body.classList.add('intro-active');
  opening.hidden = false; opening.inert = false; page.inert = true;
  if (replaying) video.currentTime = 0;
  if (!video.getAttribute('src')) {
    video.src = matchMedia('(max-width:700px)').matches ? '/landingpage/assets/intro-mobile.mp4' : matchMedia('(pointer:coarse)').matches ? '/landingpage/assets/intro-desktop.mp4' : '/landingpage/assets/intro-desktop-smooth.mp4';
  }
  window.scrollTo({top: 0, behavior: 'instant'});
  alignTransition();
  paint();
  if (video.error) recoverVideo(); else play();
  syncPlayback();
}
video.addEventListener('playing', () => { cancelPlayRetry(); playAttempts = 0; syncPlayback(); });
video.addEventListener('pause', syncPlayback);
video.addEventListener('loadeddata', syncPlayback);
video.addEventListener('timeupdate', () => { if (active) watchPlayback(); });
video.addEventListener('waiting', watchPlayback);
video.addEventListener('stalled', watchPlayback);
video.addEventListener('ended', () => finish({cinematic: true}));
function recoverVideo() {
  if (!active) return;
  if (usedFallback || video.src.endsWith('/intro-mobile.mp4')) { finish(); return; }
  usedFallback = true;
  video.classList.remove('has-frame');
  opening.classList.remove('has-video-frame');
  video.src = matchMedia('(max-width:700px)').matches ? '/landingpage/assets/intro-mobile.mp4' : '/landingpage/assets/intro-desktop.mp4';
  play();
}
video.addEventListener('error', recoverVideo);
video.addEventListener('canplay', () => { if (active && video.paused) play(); });
video.addEventListener('loadedmetadata', () => { if (active && video.paused) play(); });
document.getElementById('skip-intro').addEventListener('click', () => finish());
document.querySelector('.skip-link').addEventListener('click', () => finish({scroll: false}));
document.addEventListener('keydown', event => { if (event.key === 'Escape') finish(); else if (active && video.paused) play(); });
document.addEventListener('pointerdown', () => { if (active && video.paused) play(); });
document.addEventListener('visibilitychange', () => {
  if (!active) return;
  if (document.hidden) { cancelPlayRetry(); cancelStallTimer(); video.pause(); }
  else { watchPlayback(); play(); }
});
replay.hidden = false;
replay.addEventListener('click', () => { start({replay: true}); document.getElementById('skip-intro').focus({preventScroll: true}); });
window.addEventListener('pagehide', () => { rememberVisit(); cancelPlayRetry(); cancelStallTimer(); cancelPaint(); video.pause(); });
window.addEventListener('pageshow', event => {
  if (returningFromHistory || (event.persisted && introComplete)) restorePage();
  else if (event.persisted && active) { watchPlayback(); play(); }
});
if (returningFromHistory) restorePage();
else if (reduced.matches) {
  introComplete = true;
  restorePage();
  focusDestination();
  rememberVisit();
}
else { rememberVisit(); start(); }

reduced.addEventListener('change', event => { if (event.matches && active) finish(); });

if ('IntersectionObserver' in window && !reduced.matches) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('reveal');
      reveal.unobserve(entry.target);
    }
  }, {threshold: .08});
  document.querySelectorAll('.program-copy,.role-card,.creator-rate,.greek-steps').forEach(node => reveal.observe(node));
}
