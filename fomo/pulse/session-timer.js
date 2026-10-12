// Halogen-inspired session clock. Elapsed time belongs to this document only.
(() => {
  const timer = document.getElementById('session-timer');
  if (!timer) return;
  const display = timer.querySelector('time');
  const matrix = timer.querySelector('.session-timer-dots');
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const dot = document.createElement('i');
      const corner = (row === 0 || row === 4) && (col === 0 || col === 4);
      dot.style.visibility = corner ? 'hidden' : 'visible';
      dot.style.setProperty('--delay', `${-(col * .28 + row * .1)}s`);
      matrix.append(dot);
    }
  }

  let timeout;
  function update() {
    clearTimeout(timeout);
    // Read the navigation clock instead of counting ticks: background throttling
    // cannot slow the timer. Refreshing the document starts a new session.
    const elapsed = performance.now();
    const seconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds / 60) % 60;
    const pad = value => String(value).padStart(2, '0');
    display.textContent = hours
      ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}`
      : `${minutes}:${pad(seconds % 60)}`;
    display.dateTime = `PT${seconds}S`;
    timer.setAttribute('aria-label', `Time on page: ${hours} hours, ${minutes} minutes, ${seconds % 60} seconds`);
    if (!document.hidden) timeout = setTimeout(update, 1000 - elapsed % 1000);
  }
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pageshow', update);
  window.addEventListener('pagehide', () => clearTimeout(timeout));
  update();
})();
