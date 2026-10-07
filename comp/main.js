const examples = {
  returns: { a: '+20%', b: '+10%', aTag: 'WINNER', bTag: 'RUNNER-UP', first: 'A smaller balance can win.', second: 'The higher percentage return takes it.' },
  losses: { a: '−2%', b: '−12%', aTag: 'WINNER', bTag: 'RUNNER-UP', first: 'If every chapter loses money…', second: 'The smallest percentage loss wins.' },
  tie: { a: '+10%', b: '+10%', aTag: '$50,000 SHARE', bTag: '$50,000 SHARE', first: 'Same top score? Split the prize.', second: 'These two tied chapters get $50,000 each.' }
};
const buttons = document.querySelectorAll('[data-scenario]');
buttons.forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.scenario;
  const example = examples[key];
  if (!example) return;
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.getElementById('return-a').textContent = example.a;
  document.getElementById('return-b').textContent = example.b;
  document.getElementById('tag-a').textContent = example.aTag;
  document.getElementById('tag-b').textContent = example.bTag;
  document.getElementById('chapter-b').classList.toggle('winner', key === 'tie');
  const takeaway = document.getElementById('takeaway');
  const emphasis = document.createElement('strong');
  emphasis.textContent = example.second;
  takeaway.replaceChildren(document.createTextNode(example.first), document.createElement('br'), emphasis);
  const results = document.querySelector('.score-results');
  results.classList.remove('changing');
  void results.offsetWidth;
  results.classList.add('changing');
}));
