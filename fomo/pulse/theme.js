(() => {
  const root = document.documentElement;
  let theme = 'light';
  try { if (localStorage.getItem('fomo:pulse:theme') === 'dark') theme = 'dark'; } catch {}
  function apply() {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f5f3fc' : '#080810';
    const button = document.getElementById('theme');
    if (button) { button.textContent = theme === 'light' ? 'Dark mode' : 'Light mode'; button.setAttribute('aria-label', 'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' mode'); }
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme').addEventListener('click', () => {
      theme = theme === 'light' ? 'dark' : 'light'; apply();
      try { localStorage.setItem('fomo:pulse:theme', theme); } catch {}
    });
  });
})();
