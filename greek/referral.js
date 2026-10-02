(() => {
  const clean = value => {
    const name = (value || '').trim().replace(/^@/, '').replace(/\s+/g, ' ');
    return name.length <= 100 && /^[\p{L}\p{M}\p{N} ._'’\-]+$/u.test(name) ? name : '';
  };
  const incoming = clean(new URLSearchParams(location.search).get('ref'));
  if (incoming) {
    document.querySelectorAll('[data-onboard]').forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('ref', incoming);
      link.href = url.href;
    });
    document.querySelectorAll('[data-referral-name]').forEach(label => label.textContent = incoming);
    document.querySelectorAll('[data-referral-banner]').forEach(banner => banner.hidden = false);
    document.querySelectorAll('[data-referral-nav]').forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('ref', incoming);
      link.href = url.href;
    });
  }
  const form = document.getElementById('referral-form');
  if (!form) return;
  const referrerName = document.getElementById('referral-name');
  const result = document.getElementById('referral-result');
  const output = document.getElementById('referral-link');
  const status = document.getElementById('copy-status');
  const copy = document.getElementById('copy-referral');
  referrerName.addEventListener('input', () => {
    referrerName.setCustomValidity('');
    result.hidden = true;
    status.textContent = '';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = clean(referrerName.value);
    if (!name) {
      referrerName.setCustomValidity('Enter your name (up to 100 characters).');
      referrerName.reportValidity();
      return;
    }
    referrerName.setCustomValidity('');
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
