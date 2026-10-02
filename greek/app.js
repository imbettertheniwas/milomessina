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
    {file:'IMG_6490.PNG', title:'open the leaderboard.', instruction:'Tap the people icon → Leaderboard → View all next to Clans.', tip:'You’re setting up one clan for your chapter.', alt:'fomo Leaderboard showing Clans and View all', highlight:[77,14,20,3.5]},
    {file:'IMG_6491.PNG', title:'tap “Create a clan.”', instruction:'It’s at the bottom of the Clans screen.', tip:'Create your chapter’s own clan.', alt:'Clans list with Create a clan at the bottom', highlight:[35,93.5,31,4]},
    {file:'IMG_6499.PNG', title:'name it. invite four.', instruction:'Use your school and chapter name. Tap Invite members and add 4 people by their fomo usernames.', tip:'Those four need fomo accounts so you can find their usernames.', alt:'Clan name and description fields with Invite members showing zero and the four-member requirement', highlight:[3,65,94,7]},
    {file:'IMG_6500.PNG', title:'tap “Create a clan.”', instruction:'Once Invite members shows 4, tap the blue Create a clan button.', tip:'Your clan is set up. Next, get your Rewards link.', alt:'Invite members shows four and the Create a clan button is enabled', highlight:[3,90,94,7]},
    {file:'IMG_6502.PNG', title:'profile → Rewards.', instruction:'Open your profile using the bottom-right icon. Tap Rewards.', tip:'Your personal Rewards link is here.', alt:'fomo profile with Rewards button at the upper right', highlight:[69,17,28,5]},
    {file:'IMG_6503.PNG', title:'share your Rewards link.', instruction:'Tap the share icon beside your fomo.family/r/ link. Send that link AND your chapter tracker to the group chat.', tip:'Rewards link + tracker link. Not the clan invite.', alt:'Rewards screen showing the personal fomo.family/r/ link and share icon', highlight:[4,35,93,6.5]}
  ];
  let screenIndex = 0;
  const screenImage = document.getElementById('guide-screen');
  const modal = document.getElementById('screenshot-dialog');
  const showScreen = (index) => {
    screenIndex = Math.max(0, Math.min(screens.length - 1, index));
    const screen = screens[screenIndex];
    screenImage.src = '/greek/assets/screens/' + screen.file;
    screenImage.alt = screen.alt;
    document.getElementById('screen-count').textContent = `screen ${screenIndex+1} of ${screens.length} · ${screenIndex<4?'make your clan':'get your Rewards link'}`;
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
