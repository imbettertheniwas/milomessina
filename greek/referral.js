(() => {
  const clean = value => {
    const name = (value || '').trim().replace(/^@/, '');
    return /^[A-Za-z0-9_.-]{1,64}$/.test(name) ? name : '';
  };
  const incoming = clean(new URLSearchParams(location.search).get('ref'));
  if (incoming) {
    document.querySelectorAll('[data-onboard]').forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('ref', incoming);
      link.href = url.href;
    });
    document.querySelectorAll('[data-referral-name]').forEach(label => label.textContent = '@' + incoming);
    document.querySelectorAll('[data-referral-banner]').forEach(banner => banner.hidden = false);
    document.querySelectorAll('[data-referral-nav]').forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('ref', incoming);
      link.href = url.href;
    });
  }
  const form = document.getElementById('referral-form');
  if (!form) return;
  const username = document.getElementById('referral-username');
  const result = document.getElementById('referral-result');
  const output = document.getElementById('referral-link');
  const status = document.getElementById('copy-status');
  const copy = document.getElementById('copy-referral');
  username.addEventListener('input', () => {
    username.setCustomValidity('');
    result.hidden = true;
    status.textContent = '';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = clean(username.value);
    if (!name) {
      username.setCustomValidity('Enter your fomo username using letters, numbers, dots, dashes or underscores.');
      username.reportValidity();
      return;
    }
    username.setCustomValidity('');
    const url = new URL('https://milomessina.com/greek');
    url.searchParams.set('ref', name);
    output.value = url.href;
    result.hidden = false;
    status.textContent = 'Your link is ready. Copy it and send it to another frat’s organizer.';
    copy.textContent = 'Copy link';
    copy.focus();
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      copy.textContent = 'Copied ✓';
      status.textContent = 'Copied. Send it to the brother who will register their frat.';
    } catch {
      output.focus();
      output.select();
      status.textContent = 'Select and copy the link above.';
    }
  });
})();
