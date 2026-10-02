(() => {
  const members = document.getElementById('members');
  const amount = cents => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2
  }).format(cents / 100);
  const update = () => {
    const count = Math.max(0, Math.min(400, Math.round(Number(members.value) || 0)));
    document.getElementById('members-count').textContent = count;
    document.getElementById('your-payout').textContent = amount(count * 625);
    document.getElementById('calculation').textContent = `${count} ${count === 1 ? 'member' : 'members'} × $6.25`;
    members.style.setProperty('--fill', `${count / 4}%`);
    members.setAttribute('aria-valuetext', `${count} ${count === 1 ? 'brother' : 'brothers'} onboarded`);
  };
  members.addEventListener('input', update);
  update();
  const selectGuide = (role) => {
    if (!['organizer','member'].includes(role)) return;
    document.getElementById('organizer-guide').hidden = role !== 'organizer';
    document.getElementById('member-guide').hidden = role !== 'member';
    document.querySelectorAll('[data-guide-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.guideChoice === role)));
    document.getElementById('guide-announcement').textContent = role === 'organizer' ? 'Showing the guide for setting up your chapter.' : 'Showing the guide for joining your chapter.';
  };
  document.querySelectorAll('[data-guide-choice]').forEach(button => button.addEventListener('click', () => selectGuide(button.dataset.guideChoice)));
  document.querySelectorAll('[data-guide]').forEach(link => link.addEventListener('click', () => selectGuide(link.dataset.guide)));
  const screens = [
    {file:'IMG_6502.PNG', title:'profile → Rewards.', instruction:'Open your profile using the bottom-right icon. Tap Rewards.', tip:'This is your personal fomo referral link.', alt:'fomo profile with Rewards button at the upper right', highlight:[69,17,28,5]},
    {file:'IMG_6503.PNG', title:'tap the share icon.', instruction:'Tap the share icon beside your fomo.family/r/ link.', tip:'Use your own Rewards link. This example belongs to the person in the screenshot.', alt:'Rewards screen showing the personal fomo.family/r/ link and share icon', highlight:[4,35,93,6.5]},
    {file:'IMG_6504.PNG', title:'put it in a text.', instruction:'Add your Rewards link to a message for your chapter’s group chat, like this.', tip:'Members who join use this link. You can start with a batch.', alt:'Text message draft containing a fomo Rewards referral link preview', highlight:[20,35.5,62,23]},
    {file:'IMG_6505.PNG', title:'send both links.', instruction:'Put your tracker link and your Rewards link in the same chat. Tell members who want to join: fill out the tracker, then join fomo through my Rewards link.', tip:'We match both, add members to your clan, and pay you $6.25 per matched member.', alt:'Text message draft with both the fomo Rewards link and chapter tracker link', highlight:[20,25,62,34]}
  ];
  let screenIndex = 0;
  const screenImage = document.getElementById('guide-screen');
  const modal = document.getElementById('screenshot-dialog');
  const showScreen = (index) => {
    screenIndex = Math.max(0, Math.min(screens.length - 1, index));
    const screen = screens[screenIndex];
    screenImage.src = '/greek/assets/screens/' + screen.file;
    screenImage.alt = screen.alt;
    document.getElementById('screen-count').textContent = `screen ${screenIndex+1} of ${screens.length} · ${screenIndex<2?'get your Rewards link':'send both links'}`;
    document.getElementById('screen-title').textContent = screen.title;
    document.getElementById('screen-instruction').textContent = screen.instruction;
    document.getElementById('screen-tip').textContent = screen.tip;
    const box = document.getElementById('screen-highlight');
    ['left','top','width','height'].forEach((key,i) => box.style[key] = screen.highlight[i] + '%');
    document.getElementById('screen-prev').disabled = screenIndex === 0;
    document.getElementById('screen-next').disabled = screenIndex === screens.length - 1;
    document.querySelectorAll('[data-screen]').forEach(button => {
      if (Number(button.dataset.screen) === screenIndex) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    });
    document.getElementById('guide-announcement').textContent = `Screen ${screenIndex+1} of ${screens.length}. ${screen.title} ${screen.instruction}`;
  };
  document.getElementById('screen-prev').addEventListener('click',()=>showScreen(screenIndex-1));
  document.getElementById('screen-next').addEventListener('click',()=>showScreen(screenIndex+1));
  document.querySelectorAll('[data-screen]').forEach(button=>button.addEventListener('click',()=>showScreen(Number(button.dataset.screen))));
  document.getElementById('screen-enlarge').addEventListener('click',()=>{
    const full = document.getElementById('full-screenshot');
    full.src = screenImage.src;
    full.alt = screenImage.alt;
    document.getElementById('screenshot-dialog-title').textContent = screens[screenIndex].title;
    modal.showModal();
  });
  document.getElementById('screenshot-close').addEventListener('click',()=>modal.close());
  modal.addEventListener('click',event=>{ if(event.target===modal) modal.close(); });
})();
