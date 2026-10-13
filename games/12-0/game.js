(() => {
  'use strict';
  const E = window.TwelveZero;
  const $ = id => document.getElementById(id);
  const view = $('gameView');
  const PREFIX = 'twelve-zero:v1:';
  const memory = new Map();
  let storageFailed = false;
  let data, cards, game = null, challenge = null, mode = 'daily', selectedSlot = null;
  const rosterMedia = matchMedia('(min-width: 960px)');
  let rosterOpen = rosterMedia.matches;
  let bests = { daily: null, practice: null };
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const formatDate = date => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const country = code => { try { return countryNames.of(code) || 'World golfer'; } catch { return 'World golfer'; } };
  const flag = code => /^[A-Z]{2}$/.test(code) ? [...code].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('') : '◈';
  const initials = name => name.split(/\s+/).filter(Boolean).map(n => n[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('');
  function storageWarning() {
    storageFailed = true;
    $('storageNotice').hidden = false;
    $('storageNotice').textContent = 'Progress can’t be saved in this browser. You can still play, but keep this page open to finish your session.';
  }
  function read(key) {
    if (memory.has(key)) return memory.get(key);
    if (storageFailed) return null;
    try { return localStorage.getItem(key); } catch { storageWarning(); return null; }
  }
  function write(key, value) {
    memory.set(key, value);
    if (storageFailed) return;
    try { localStorage.setItem(key, value); } catch { storageWarning(); }
  }
  function announce(message) { $('gameAnnouncement').textContent = message; }
  function notice(message = '') { $('actionNotice').textContent = message; $('actionNotice').hidden = !message; }
  function readGame(key) {
    const saved = read(key);
    if (!saved) return null;
    try {
      const restored = E.restoreGame(data, JSON.parse(saved));
      if (E.storageKey(restored) !== key) throw new Error('Wrong save slot.');
      return restored;
    } catch {
      notice('This saved session couldn’t be restored. Start a new draft to play.');
      return null;
    }
  }
  function persist() {
    if (!game) return;
    const key = E.storageKey(game);
    write(key, JSON.stringify(game));
    write(`${PREFIX}last-game`, key);
    if (game.revealed === 12) {
      const points = E.score(game.results);
      if (bests[mode] === null || points > bests[mode]) {
        bests[mode] = points;
        write(`${PREFIX}bests`, JSON.stringify(bests));
      }
    }
  }
  function selectGame(saved, nextMode) {
    mode = nextMode;
    game = saved;
    challenge = game ? E.createChallenge(data, game) : null;
    selectedSlot = null;
    if (game) persist();
    render();
  }
  function switchMode(nextMode) {
    if (!data) return;
    notice();
    const key = `${PREFIX}${nextMode}:${nextMode === 'daily' ? E.utcDate() : 'current'}`;
    selectGame(readGame(key), nextMode);
    announce(nextMode === 'daily' ? 'Daily challenge selected.' : 'Practice selected.');
  }
  function newGame() {
    notice();
    if (mode === 'daily') {
      const previous = readGame(`${PREFIX}daily:${E.utcDate()}`);
      if (previous) { selectGame(previous, 'daily'); return; }
    }
    const practiceId = mode === 'practice' ? [...crypto.getRandomValues(new Uint32Array(4))].map(n => n.toString(16).padStart(8, '0')).join('') : '';
    notice();
    selectGame(E.createGame(data, { mode, practiceId }), mode);
    focusHeading(true);
  }
  const stage = () => !game ? 'intro' : game.results ? game.revealed === 12 ? 'complete' : 'reveal' : game.lineup.length === 12 ? 'lineup' : 'draft';
  function focusHeading(scroll = false) {
    const heading = view.querySelector('[data-stage-heading]');
    heading?.focus({ preventScroll: true });
    if (scroll) view.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function dispatch(action) {
    const oldStage = stage();
    try {
      game = E.transition(data, game, action, challenge);
      persist();
      render();
      const newStage = stage();
      if (newStage !== oldStage) focusHeading(true);
      else if (action.type === 'pick') focusHeading();
      else if (action.type === 'reroll') {
        const reroll = view.querySelector('[data-action="reroll"]');
        if (reroll?.disabled) view.querySelector('.g-offer')?.focus({ preventScroll: true });
        else reroll?.focus({ preventScroll: true });
      }
      else if (action.type === 'reveal') {
        view.querySelector('[data-action="reveal"]')?.focus({ preventScroll: true });
        view.querySelector(`.g-result-list li:nth-child(${game.revealed})`)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
      if (action.type === 'pick') announce(`${cards.get(action.cardId).name} drafted. ${game.lineup.length === 12 ? 'Your team is complete. Arrange your lineup.' : `Pick ${E.draftState(challenge, game.actions).picks.length + 1} of 12.`}`);
      if (action.type === 'reroll') announce('Three new golfers. ' + (2 - E.draftState(challenge, game.actions).rerolls) + ' rerolls remaining.');
      if (action.type.startsWith('reveal')) {
        const points = E.score(game.results, game.revealed);
        const last = game.results[game.revealed - 1];
        announce(`${action.type === 'reveal' ? `${cards.get(last.cardId).name}: ${last.result === 'half' ? 'match halved' : last.result === 'win' ? 'match won' : 'match lost'}. ` : ''}${game.revealed} matches revealed. Your score ${E.formatPoints(points)} to ${E.formatPoints(game.revealed - points)}.`);
      }
    } catch (error) { notice(error.message); }
  }
  function renderHeader() {
    $('dailyMode').setAttribute('aria-pressed', String(mode === 'daily'));
    $('practiceMode').setAttribute('aria-pressed', String(mode === 'practice'));
    $('gameDate').textContent = mode === 'daily' ? formatDate(game?.date || E.utcDate()) : 'A fresh challenge, every time';
    const oldDay = game?.mode === 'daily' && game.date !== E.utcDate();
    $('dateNotice').hidden = !oldDay;
    $('dateNotice').textContent = oldDay ? `This is the ${formatDate(game.date)} challenge. You can finish it here, or select Daily challenge for today’s game.` : '';
  }
  const bestLabel = () => bests[mode] === null ? 'Your first scorecard is waiting.' : `${mode === 'daily' ? 'Daily' : 'Practice'} best: ${E.formatPoints(bests[mode])}–${E.formatPoints(12 - bests[mode])}`;
  function intro() {
    return `<section class="g-intro"><div class="g-intro-copy"><p class="g-kicker">You’re the captain now</p><h2 data-stage-heading tabindex="-1">Pick your legends.<br>Make your calls.</h2><p>Build a team of twelve golf greats, set your singles lineup and chase the perfect session.</p><button class="g-button g-button--large" data-action="start">${mode === 'daily' ? 'Play today’s challenge' : 'Start a practice draft'} <span aria-hidden="true">↗</span></button><p class="g-small">${mode === 'daily' ? 'One daily attempt · Same challenge for everyone' : 'Unlimited games · Your daily score stays separate'}</p></div><div class="g-trophy-board" aria-hidden="true"><div class="g-board-top"><span>THE PERFECT SESSION</span><span>EST. 2026</span></div><div class="g-board-score">12<span>–</span>0</div><div class="g-board-rule"></div><div class="g-board-slots">${Array.from({ length: 12 }, (_, i) => `<span>${String(i + 1).padStart(2, '0')}</span>`).join('')}</div><p>TWELVE GOLFERS. ALL TO PLAY FOR.</p><svg class="g-flag" viewBox="0 0 60 80" fill="none"><path d="M16 68h30M30 68V10l26 10-26 12" stroke="currentColor" stroke-width="2"/><ellipse cx="30" cy="69" rx="22" ry="6" stroke="currentColor"/></svg></div></section><div class="g-intro-bottom"><ol class="g-steps"><li><span>01</span><div><strong>Draft twelve</strong><p>Three choices. Trust your golf knowledge.</p></div></li><li><span>02</span><div><strong>Set the lineup</strong><p>Ratings revealed. Matchups in your hands.</p></div></li><li><span>03</span><div><strong>Chase the sweep</strong><p>Win the session. Dream of twelve.</p></div></li></ol><p class="g-personal-best">${bestLabel()}</p></div>`;
  }
  function roster(picks) {
    return `<details class="g-roster" ${rosterOpen ? 'open' : ''}><summary>Your team <span>${picks.length} / 12</span></summary><ol>${Array.from({ length: 12 }, (_, i) => {
      const c = cards.get(picks[i]);
      return `<li class="${c ? 'is-picked' : ''}"><span class="g-slot-number">${String(i + 1).padStart(2, '0')}</span>${c ? `<span><strong>${escape(c.name)}</strong><small>${c.year} <span aria-hidden="true">${flag(c.country)}</span></small></span>` : '<span class="g-empty-slot">Your next great pick</span>'}</li>`;
    }).join('')}</ol></details>`;
  }
  function offer(c) {
    return `<button class="g-offer ${c.group === 'legend' ? 'g-offer--legend' : ''}" data-action="pick" data-card="${escape(c.id)}"><span class="g-offer-top"><span>${c.year}</span><span aria-hidden="true">${flag(c.country)}</span></span><span class="g-monogram" aria-hidden="true">${escape(initials(c.name))}</span><span class="g-offer-info"><strong>${escape(c.name)}</strong><span>${escape(country(c.country))} · ${c.year}</span></span><span class="g-offer-bottom"><span>Draft golfer</span><span aria-hidden="true">↗</span></span></button>`;
  }
  function draft() {
    const d = E.draftState(challenge, game.actions);
    return `<div class="g-progress" aria-label="${d.picks.length} of 12 golfers drafted">${Array.from({ length: 12 }, (_, i) => `<span class="${i < d.picks.length ? 'is-filled' : i === d.picks.length ? 'is-current' : ''}"></span>`).join('')}</div><div class="g-draft-layout"><section class="g-draft-main"><div class="g-section-heading"><div><p class="g-kicker">Pick ${String(d.picks.length + 1).padStart(2, '0')} of 12</p><h2 tabindex="-1" data-stage-heading>Who gets the call?</h2></div><button class="g-button g-button--light g-reroll" data-action="reroll" ${d.rerolls === 2 ? 'disabled' : ''}><span aria-hidden="true">↻</span> Reroll · ${2 - d.rerolls} left</button></div><div class="g-offers">${d.offers.map(offer).join('')}</div><p class="g-draft-hint"><span aria-hidden="true">◈</span> Go with your instinct. Ratings are revealed when your team is complete.</p><p class="g-small">Each card uses that year’s singles matchplay rating. Picks are permanent.</p>${mode === 'practice' ? '<button class="g-text-button" data-action="restart">Start new practice</button>' : ''}</section>${roster(d.picks)}</div>`;
  }
  function playerInfo(c, opposing = false) {
    return `<span class="g-lineup-name"><strong>${escape(c.name)}</strong><small><span aria-hidden="true">${flag(c.country)}</span> ${c.year}<span class="g-lineup-rating">Rating ${Math.round(c.rating)}</span></small></span>${opposing ? '' : '<span class="g-swap-icon" aria-hidden="true">⇅</span>'}`;
  }
  function lineup() {
    return `<div class="g-section-heading"><div><p class="g-kicker">The captain’s call</p><h2 tabindex="-1" data-stage-heading>Put your twelve to the test.</h2><p id="lineupHelp">${selectedSlot === null ? 'Tap two of your golfers to swap their matchups. The opposition is fixed.' : `Match ${selectedSlot + 1} selected. Tap another golfer to swap, or tap again to cancel.`}</p></div><span class="g-pill">12 golfers drafted</span></div><div class="g-lineup-head"><span>Your team <span aria-hidden="true">⇅</span></span><span>The opposition</span></div><ol class="g-lineup">${game.lineup.map((id, i) => {
      const c = cards.get(id);
      return `<li><span class="g-match-number">${String(i + 1).padStart(2, '0')}</span><button class="g-lineup-player ${selectedSlot === i ? 'is-selected' : ''}" data-action="swap" data-slot="${i}" aria-pressed="${selectedSlot === i}" aria-describedby="lineupHelp" aria-label="Match ${i + 1}: ${escape(c.name)}, ${c.year}, rating ${Math.round(c.rating)}. Select to swap.">${playerInfo(c)}</button><span class="g-vs" aria-hidden="true">v</span><div class="g-opponent">${playerInfo(challenge.opponents[i], true)}</div></li>`;
    }).join('')}</ol><div class="g-action-bar"><p>Happy with your matchups?<small>Once locked, your session is set.</small></p><button class="g-button" data-action="lock">Lock lineup & play <span aria-hidden="true">↗</span></button></div>`;
  }
  function results() {
    const done = game.revealed === 12;
    const points = E.score(game.results, game.revealed);
    const opposition = game.revealed - points;
    const perfect = done && points === 12;
    const title = !done ? 'Let the session unfold.' : perfect ? 'The perfect twelve.' : points > 6 ? 'A captain’s performance.' : points === 6 ? 'Honours even.' : 'There’s always the next twelve.';
    const verdict = !done ? `${game.revealed} of 12 matches revealed` : perfect ? 'Twelve matches. Twelve wins. A clean sweep.' : points > 6 ? 'Your team wins the session.' : points === 6 ? 'A halved session. Nothing between the teams.' : 'The opposition wins this session.';
    return `<section class="g-scoreboard ${perfect ? 'g-scoreboard--perfect' : ''}"><div class="g-scoreboard-copy"><p class="g-kicker">${done ? perfect ? '✦ The clean sweep club' : 'Your final scorecard' : 'Singles session'}</p><h2 data-stage-heading tabindex="-1">${title}</h2><p>${verdict}</p></div><div class="g-score"><div><span>You</span><strong>${E.formatPoints(points)}</strong></div><span class="g-score-dash">–</span><div><span>Opposition</span><strong>${E.formatPoints(opposition)}</strong></div></div></section>${done ? `<div class="g-completed-actions"><button class="g-button" data-action="share">Share scorecard <span aria-hidden="true">↗</span></button><button class="g-button g-button--light" data-action="playAgain">${mode === 'daily' ? 'Play a practice round' : 'Draft another team'}</button><p class="g-personal-best">${bestLabel()}</p></div>` : ''}<ol class="g-result-list">${game.results.map((r, i) => {
      const shown = i < game.revealed;
      const c = cards.get(r.cardId);
      const o = cards.get(r.opponentId);
      const label = !shown ? 'To come' : { win: 'Won', half: 'Halved', loss: 'Lost' }[r.result];
      return `<li class="${shown ? `g-result--${r.result}` : 'g-result--pending'}"><span class="g-match-number">${String(i + 1).padStart(2, '0')}</span><div class="g-result-golfer"><strong>${escape(c.name)}</strong><small>${c.year} · Rating ${Math.round(c.rating)}</small></div><span class="g-result-badge">${label}</span><div class="g-result-golfer g-result-opponent"><strong>${escape(o.name)}</strong><small>${o.year} · Rating ${Math.round(o.rating)}</small></div></li>`;
    }).join('')}</ol>${done ? `<p class="g-end-note">${mode === 'daily' ? 'Today’s score is saved. Come back for a fresh challenge at midnight UTC.' : 'A fresh draft is only twelve picks away.'} All results are simulated.</p>` : `<div class="g-action-bar"><p>Every point counts.<small>Favourites can fall. Legends can deliver.</small></p><div class="g-actions"><button class="g-button g-button--light" data-action="revealAll">Show all</button><button class="g-button" data-action="reveal">Reveal match ${game.revealed + 1} <span aria-hidden="true">→</span></button></div></div>`}`;
  }
  function render() {
    renderHeader();
    view.setAttribute('aria-busy', 'false');
    view.dataset.stage = stage();
    view.innerHTML = !game ? intro() : game.results ? results() : game.lineup.length === 12 ? lineup() : draft();
  }
  function share() {
    const text = E.shareText(game);
    $('shareContent').value = text;
    $('copyStatus').textContent = '';
    $('nativeShare').hidden = !navigator.share;
    $('shareDialog').showModal();
  }
  view.addEventListener('toggle', event => { if (event.target.classList.contains('g-roster')) rosterOpen = event.target.open; }, true);
  rosterMedia.addEventListener?.('change', event => {
    rosterOpen = event.matches;
    if (data && stage() === 'draft') render();
  });
  view.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    notice();
    if (action === 'start') newGame();
    else if (action === 'pick') dispatch({ type: action, cardId: button.dataset.card });
    else if (['reroll', 'lock', 'reveal', 'revealAll'].includes(action)) { selectedSlot = null; dispatch({ type: action }); }
    else if (action === 'swap') {
      const index = Number(button.dataset.slot);
      if (selectedSlot === null) { selectedSlot = index; render(); announce(`Match ${index + 1} selected. Select another of your golfers to swap.`); }
      else if (selectedSlot === index) { selectedSlot = null; render(); announce('Swap cancelled.'); }
      else { const first = selectedSlot; selectedSlot = null; dispatch({ type: 'swap', a: first, b: index }); announce(`Golfers in matches ${first + 1} and ${index + 1} swapped.`); }
      view.querySelector(`[data-slot="${index}"]`)?.focus({ preventScroll: true });
    } else if (action === 'restart') $('restartDialog').showModal();
    else if (action === 'playAgain') {
      if (mode === 'daily') { switchMode('practice'); if (!game) newGame(); else focusHeading(true); }
      else newGame();
    } else if (action === 'share') share();
    else if (action === 'retry') load();
  });
  $('dailyMode').addEventListener('click', () => switchMode('daily'));
  $('practiceMode').addEventListener('click', () => switchMode('practice'));
  $('howToPlay').addEventListener('click', () => $('rulesDialog').showModal());
  $('confirmRestart').addEventListener('click', () => { $('restartDialog').close(); newGame(); });
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $('copyScorecard').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('shareContent').value); $('copyStatus').textContent = 'Copied. Your scorecard is ready to share.'; }
    catch { $('shareContent').focus(); $('shareContent').select(); $('copyStatus').textContent = 'Select and copy the text above to share your scorecard.'; }
  });
  $('nativeShare').addEventListener('click', async () => {
    try { await navigator.share({ title: '12–0: The Captain’s Challenge', text: $('shareContent').value }); }
    catch (error) { if (error.name !== 'AbortError') $('copyStatus').textContent = 'Sharing isn’t available here. Use Copy scorecard instead.'; }
  });
  // Other tabs can finish or advance the same daily attempt. Adopt the saved state
  // before another choice is made, rather than permitting a second attempt.
  window.addEventListener('storage', event => {
    if (!game || event.key !== E.storageKey(game) || !event.newValue) return;
    try {
      const incoming = E.restoreGame(data, JSON.parse(event.newValue));
      memory.set(event.key, event.newValue);
      game = incoming; challenge = E.createChallenge(data, game); selectedSlot = null;
      render(); announce('Your progress was updated in another tab.');
    } catch { /* Ignore an incomplete or incompatible external save. */ }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && data) renderHeader(); });
  async function load() {
    $('dailyMode').disabled = true; $('practiceMode').disabled = true;
    view.setAttribute('aria-busy', 'true');
    try {
      if (!E) throw new Error('The game engine could not load.');
      const response = await fetch(new URL('cards-v1.json', document.currentScript?.src || new URL('game.js', location.href)), { cache: 'default' });
      if (!response.ok) throw new Error('The card collection could not load.');
      data = E.validateData(await response.json());
      cards = new Map(data.cards.map(c => [c.id, c]));
      $('sourceDate').textContent = formatDate(data.sourceDate);
      try {
        const stored = JSON.parse(read(`${PREFIX}bests`));
        for (const key of ['daily', 'practice']) if (Number.isFinite(stored?.[key]) && stored[key] >= 0 && stored[key] <= 12) bests[key] = stored[key];
      } catch { /* Personal bests can be rebuilt from later completed games. */ }
      const lastKey = read(`${PREFIX}last-game`);
      const last = lastKey?.startsWith(PREFIX) ? readGame(lastKey) : null;
      if (last && (last.mode === 'practice' || last.date === E.utcDate() || last.revealed < 12)) selectGame(last, last.mode);
      else selectGame(readGame(`${PREFIX}daily:${E.utcDate()}`), 'daily');
      $('dailyMode').disabled = false; $('practiceMode').disabled = false;
    } catch {
      view.setAttribute('aria-busy', 'false');
      view.innerHTML = '<section class="g-loading"><h2 tabindex="-1" data-stage-heading>The clubhouse couldn’t open.</h2><p>Check your connection, then try loading the golfers again.</p><button class="g-button" data-action="retry">Try again</button></section>';
    }
  }
  load();
})();
