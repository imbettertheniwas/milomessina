// Keep first visits ready without sending a burst to the shared sheet.
// These responses live only in this signed-in page, and are consumed once.
const bridge = window.FOMO_SHEET;
if (bridge?.tabData) {
  const tabs = bridge.tabData, read = bridge.read;
  const opened = new Set();
  const views = {beta:'beta', visits:'visits', schedules:'schedules', posts:'posts', applicants:'campus', campus:'campus', referrals:'refer'};
  let epoch = 0, running = false, timer = null, ready = !!bridge.ledgerReady;
  bridge.read = async (...args) => {
    const revision = epoch;
    const out = await read(...args);
    if (revision !== epoch) throw Object.assign(new Error('Your session changed. Open the tab again.'), {code:'STALE'});
    if (out?.ok === true || args[0] === 'visits' && Array.isArray(out?.requests)) opened.add(args[0]);
    return out;
  };
  function allowed(api) {
    return !!bridge.session() && (api !== 'beta' && api !== 'refer' || bridge.operator());
  }
  async function prepare() {
    if (!ready || running || document.hidden || !bridge.session()) return;
    running = true;
    const revision = epoch;
    try {
      // Only the common work views are warmed automatically. Referrals and
      // administrative tables begin when someone points to their navigation.
      for (const api of ['beta','visits','schedules','posts','campus']) {
        if (revision !== epoch || document.hidden) break;
        if (!opened.has(api) && allowed(api)) await tabs.warm(api);
      }
    } finally {
      if (revision === epoch) running = false;
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (ready && bridge.session() && !document.hidden) timer = setTimeout(prepare, 1200);
  }
  function intent(event) {
    if (document.hidden) return;
    const target = event.target.closest?.('[data-go]');
    const api = views[target?.dataset.go];
    if (api && allowed(api) && !opened.has(api)) tabs.warm(api);
  }
  document.getElementById('nav')?.addEventListener('pointerover', intent);
  document.getElementById('nav')?.addEventListener('focusin', intent);
  window.addEventListener('fomo:ledger-ready', () => { ready = true; schedule(); });
  window.addEventListener('fomo:identity', () => {
    epoch++; tabs.clear(); opened.clear(); running = false;
    ready = !!bridge.ledgerReady; schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  schedule();
}
