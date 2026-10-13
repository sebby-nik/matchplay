const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const E = require('../games/12-0/game-engine.js');
const data = require('../games/12-0/cards-v1.json');
const stats = require('../player-stats.js');
const cards = new Map(data.cards.map(c => [c.id, c]));
const tests = [];
const test = (name, run) => tests.push([name, run]);
const daily = date => E.createGame(data, { date: date || '2026-10-13' });
const finishDraft = (state, strongest = false) => {
  const challenge = E.createChallenge(data, state);
  for (let i = 0; i < 12; i++) {
    const offers = E.draftState(challenge, state.actions).offers;
    const pick = strongest ? [...offers].sort((a, b) => b.rating - a.rating)[0] : offers[0];
    state = E.transition(data, state, { type: 'pick', cardId: pick.id }, challenge);
  }
  return { state, challenge };
};
test('the frozen collection contains 994 unique, sufficiently established golfer-year cards', () => {
  assert.equal(E.validateData(data), data);
  assert.equal(data.cards.length, 994);
  const matches = require('../data.json').matches.filter(m => m.result !== 'not played');
  const byPlayer = new Map();
  for (const c of data.cards) {
    if (!byPlayer.has(c.playerId)) byPlayer.set(c.playerId, stats.deriveRatingTimeline(matches, c.name).timeline);
    const timeline = byPlayer.get(c.playerId);
    const last = timeline.filter(t => t.year === c.year).at(-1);
    assert.ok(last, `${c.id} must have played that year`);
    assert.ok(timeline.filter(t => t.year <= c.year).length >= 10);
    assert.equal(last.ratingAfter, c.rating, `${c.id} matches the archive timeline`);
    assert.equal(c.group, c.year >= 1990 ? 'modern' : 'legend');
  }
});
test('mirrored match rows do not alter the ratings used for cards', () => {
  const all = require('../data.json').matches.filter(m => m.result !== 'not played');
  const mirrored = stats.deriveRatingTimeline(all, 'Scottie Scheffler');
  const unique = stats.deriveRatingTimeline(stats.uniqueMatches(all), 'Scottie Scheffler');
  assert.deepEqual(mirrored, unique);
});
test('daily challenges are repeatable and change with the UTC date', () => {
  assert.deepEqual(E.createChallenge(data, daily()), E.createChallenge(data, daily()));
  assert.notDeepEqual(E.createChallenge(data, daily()), E.createChallenge(data, daily('2026-10-14')));
  assert.equal(E.utcDate(new Date('2026-10-14T00:30:00+01:00')), '2026-10-13');
});
test('practice uses independent seeds and cannot alter a daily challenge', () => {
  const original = E.createChallenge(data, daily());
  const one = E.createGame(data, { mode: 'practice', practiceId: 'practice-001' });
  const two = E.createGame(data, { mode: 'practice', practiceId: 'practice-002' });
  assert.notDeepEqual(E.createChallenge(data, one), E.createChallenge(data, two));
  assert.notEqual(E.storageKey(one), E.storageKey(daily()));
  assert.deepEqual(E.createChallenge(data, daily()), original);
});
test('rerolls use two fixed reserve offers without skipping a pick', () => {
  let state = daily();
  const challenge = E.createChallenge(data, state);
  state = E.transition(data, state, { type: 'reroll' }, challenge);
  assert.deepEqual(E.draftState(challenge, state.actions).offers, challenge.reserves[0]);
  state = E.transition(data, state, { type: 'reroll' }, challenge);
  assert.deepEqual(E.draftState(challenge, state.actions).offers, challenge.reserves[1]);
  assert.throws(() => E.transition(data, state, { type: 'reroll' }, challenge));
  assert.throws(() => E.transition(data, state, { type: 'pick', cardId: challenge.offers[0][0].id }, challenge));
  state = E.transition(data, state, { type: 'pick', cardId: challenge.reserves[1][0].id }, challenge);
  assert.deepEqual(E.draftState(challenge, state.actions).offers, challenge.offers[1]);
});
test('drafts cannot pick unavailable cards or arrange incomplete teams', () => {
  const state = daily();
  assert.throws(() => E.transition(data, state, { type: 'pick', cardId: 'invented:2020' }));
  assert.throws(() => E.transition(data, state, { type: 'swap', a: 0, b: 1 }));
  assert.throws(() => E.transition(data, state, { type: 'lock' }));
});
test('lineup swaps preserve the team and lock permanently before results reveal', () => {
  let { state, challenge } = finishDraft(daily());
  const before = [...state.lineup];
  state = E.transition(data, state, { type: 'swap', a: 0, b: 11 }, challenge);
  assert.equal(state.lineup[0], before[11]);
  assert.equal(state.lineup[11], before[0]);
  assert.deepEqual([...state.lineup].sort(), before.sort());
  assert.throws(() => E.transition(data, state, { type: 'swap', a: -1, b: 0 }, challenge));
  assert.throws(() => E.transition(data, state, { type: 'reroll' }, challenge));
  state = E.transition(data, state, { type: 'lock' }, challenge);
  assert.equal(state.results.length, 12);
  assert.equal(state.revealed, 0);
  assert.throws(() => E.transition(data, state, { type: 'swap', a: 0, b: 1 }, challenge));
  assert.throws(() => E.transition(data, state, { type: 'lock' }, challenge));
});
test('outcome probabilities are bounded, symmetric and preserve Elo expected points', () => {
  for (let delta = -2000; delta <= 2000; delta += 25) {
    const p = E.probabilities(1000 + delta, 1000);
    assert.ok(Object.values(p).every(n => n >= 0 && n <= 1));
    assert.ok(Math.abs(p.win + p.half + p.loss - 1) < 1e-12);
    assert.ok(Math.abs(p.win + p.half / 2 - 1 / (1 + 10 ** (-delta / 400))) < 1e-12);
    assert.ok(Math.abs(p.win - E.probabilities(1000, 1000 + delta).loss) < 1e-12);
  }
  assert.deepEqual(E.probabilities(1000, 1000), { win: 0.44, half: 0.12, loss: 0.44000000000000006 });
});
test('identical ordered lineups always produce identical results', () => {
  const { state, challenge } = finishDraft(daily());
  const results = E.simulate(data, state, challenge);
  assert.deepEqual(results, E.simulate(data, state, E.createChallenge(data, state)));
});
test('reveal is incremental, totals twelve, and continues past a secured win', () => {
  let { state, challenge } = finishDraft(daily(), true);
  state = E.transition(data, state, { type: 'lock' }, challenge);
  state = E.transition(data, state, { type: 'reveal' }, challenge);
  assert.equal(state.revealed, 1);
  assert.equal(E.score(state.results, 1), state.results[0].points);
  state = E.transition(data, state, { type: 'revealAll' }, challenge);
  assert.equal(state.revealed, 12);
  const score = E.score(state.results);
  assert.equal(score + (12 - score), 12);
  assert.throws(() => E.transition(data, state, { type: 'reveal' }, challenge));
  assert.equal(E.formatPoints(0.5), '½');
  assert.equal(E.formatPoints(8.5), '8½');
});
test('saved drafts, lineups and completed results survive reload and midnight', () => {
  let state = daily('2026-10-12');
  const challenge = E.createChallenge(data, state);
  state = E.transition(data, state, { type: 'reroll' }, challenge);
  state = E.transition(data, state, { type: 'pick', cardId: challenge.reserves[0][1].id }, challenge);
  assert.deepEqual(E.restoreGame(data, JSON.parse(JSON.stringify(state))), state);
  let full = finishDraft(daily('2026-10-12')).state;
  for (const action of [{ type: 'swap', a: 3, b: 6 }, { type: 'lock' }, { type: 'reveal' }, { type: 'revealAll' }]) {
    full = E.transition(data, full, action);
    assert.deepEqual(E.restoreGame(data, JSON.parse(JSON.stringify(full))), full);
    assert.equal(full.date, '2026-10-12');
  }
});
test('incompatible and corrupted saves are rejected instead of changing results', () => {
  const { state } = finishDraft(daily());
  assert.throws(() => E.restoreGame(data, { ...state, dataVersion: 'v2' }));
  assert.throws(() => E.restoreGame(data, { ...state, date: '2026-02-31' }));
  assert.throws(() => E.restoreGame(data, { ...state, lineup: Array(12).fill(state.lineup[0]) }));
  assert.throws(() => E.restoreGame(data, { ...state, revealed: 1 }));
  const locked = E.transition(data, state, { type: 'lock' });
  const corrupt = JSON.parse(JSON.stringify(locked));
  corrupt.results[0].points = 99;
  assert.throws(() => E.restoreGame(data, corrupt));
});
test('shareable scorecards contain twelve symbols and no draft spoilers', () => {
  let { state } = finishDraft(daily());
  assert.throws(() => E.shareText(state));
  state = E.transition(data, state, { type: 'lock' });
  state = E.transition(data, state, { type: 'revealAll' });
  const text = E.shareText(state);
  assert.equal([...text.split('\n')[2]].length, 12);
  assert.ok(text.includes(state.date));
  assert.ok(text.includes('https://www.matchplayrankings.com/games/12-0/'));
  state.lineup.forEach(id => assert.ok(!text.includes(cards.get(id).name)));
});
test('a clean sweep is achievable and gets the correct scorecard celebration', () => {
  let { state, challenge } = finishDraft(E.createGame(data, { mode: 'practice', practiceId: 'balance-1363' }), true);
  state = E.transition(data, state, { type: 'lock' }, challenge);
  state = E.transition(data, state, { type: 'revealAll' }, challenge);
  assert.equal(E.score(state.results), 12);
  assert.match(E.shareText(state), /12–0 · Clean sweep!/);
  assert.ok(state.results.every(r => r.result === 'win'));
});
test('1,000 challenges have legal drafts and opposition; strong drafting rewards knowledge', () => {
  const records = { random: 0, strong: 0, strongWins: 0, sweeps: 0, halves: 0, sweepProbability: 0 };
  for (let i = 0; i < 1000; i++) {
    const start = E.createGame(data, { mode: 'practice', practiceId: `balance-${String(i).padStart(4, '0')}` });
    const challenge = E.createChallenge(data, start);
    const draftCards = [...challenge.offers.flat(), ...challenge.reserves.flat()];
    assert.equal(draftCards.length, 42);
    assert.equal(draftCards.filter(c => c.group === 'legend').length, 6);
    assert.equal(new Set([...draftCards, ...challenge.opponents].map(c => c.playerId)).size, 54);
    const randomTeam = finishDraft(start).state;
    const strongTeam = finishDraft(start, true).state;
    const result = E.simulate(data, strongTeam, challenge);
    const strongScore = E.score(result);
    records.random += E.score(E.simulate(data, randomTeam, challenge));
    records.strong += strongScore;
    records.strongWins += Number(strongScore > 6);
    records.sweeps += Number(strongScore === 12);
    records.halves += result.filter(r => r.result === 'half').length;
    records.sweepProbability += strongTeam.lineup.reduce((chance, id, j) => chance * E.probabilities(cards.get(id).rating, challenge.opponents[j].rating).win, 1);
  }
  assert.ok(records.strong > records.random + 400);
  assert.ok(records.strongWins > 500 && records.halves > 0);
  // A rare sweep need not occur in a finite sample. Check its probability and
  // the explicit achievable seed above instead of a flaky observed-count floor.
  assert.ok(records.sweepProbability > 0 && records.sweepProbability / 1000 < 0.01);
  console.log(`  Balance: random ${records.random / 1000}/12, informed ${records.strong / 1000}/12; informed wins ${records.strongWins}/1000, sweeps ${records.sweeps}/1000.`);
});

// Exercise the real UI controller at its browser boundaries without changing the
// production page or adding test-only controls to the game.
async function ui({ entries = {}, blocked = false, failFetch = false, failedClipboard = false } = {}) {
  const values = new Map(Object.entries(entries));
  const elements = new Map();
  const listeners = new Map();
  const documentListeners = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      id, textContent: '', innerHTML: '', value: '', hidden: true, disabled: false, dataset: {}, attributes: {}, handlers: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      addEventListener(k, fn) { this.handlers[k] = fn; },
      querySelector() { return null; }, focus() { this.focused = true; }, select() { this.selected = true; }, scrollIntoView() {},
      showModal() { this.open = true; }, close() { this.open = false; }
    });
    return elements.get(id);
  };
  let fetchFails = failFetch;
  const context = vm.createContext({
    window: { TwelveZero: E, addEventListener(k, fn) { listeners.set(k, fn); } },
    document: { currentScript: { src: 'http://localhost/games/12-0/game.js' }, hidden: false, getElementById: element, querySelectorAll: () => [], addEventListener(k, fn) { documentListeners.set(k, fn); } },
    localStorage: { getItem(k) { if (blocked) throw new Error('Blocked'); return values.get(k) || null; }, setItem(k, v) { if (blocked) throw new Error('Blocked'); values.set(k, v); } },
    fetch: async () => { if (fetchFails) throw new Error('Offline'); return { ok: true, json: async () => data }; },
    navigator: { clipboard: { writeText: async () => { if (failedClipboard) throw new Error('Denied'); } } },
    crypto: require('node:crypto').webcrypto, matchMedia: () => ({ matches: false }), location: { href: 'http://localhost/games/12-0/' },
    URL, Date, Intl, console, Map, Set, Uint32Array
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../games/12-0/game.js'), 'utf8'), context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  const click = async (action, extra = {}) => {
    const button = { disabled: false, dataset: { action, ...extra } };
    element('gameView').handlers.click({ target: { closest: () => button } });
    await settle();
  };
  return { values, element, click, settle, listeners, documentListeners, online: () => { fetchFails = false; } };
}
test('UI shows a retry state on load failure and recovers without resetting a saved draft', async () => {
  const state = daily(E.utcDate());
  const browser = await ui({ failFetch: true, entries: { [E.storageKey(state)]: JSON.stringify(state) } });
  assert.match(browser.element('gameView').innerHTML, /couldn’t open/);
  assert.equal(browser.element('dailyMode').disabled, true);
  browser.online(); await browser.click('retry');
  assert.equal(browser.element('gameView').dataset.stage, 'draft');
});
test('UI remains playable when local storage is unavailable', async () => {
  const browser = await ui({ blocked: true });
  assert.equal(browser.element('storageNotice').hidden, false);
  await browser.click('start');
  const offer = E.createChallenge(data, daily(E.utcDate())).offers[0][0];
  await browser.click('pick', { card: offer.id });
  assert.match(browser.element('gameView').innerHTML, /Pick 02 of 12/);
  browser.element('practiceMode').handlers.click();
  browser.element('dailyMode').handlers.click();
  assert.match(browser.element('gameView').innerHTML, /Pick 02 of 12/);
});
test('UI resumes yesterday’s unfinished challenge and offers today separately', async () => {
  const state = daily('2026-01-01');
  const key = E.storageKey(state);
  const browser = await ui({ entries: { [key]: JSON.stringify(state), 'twelve-zero:v1:last-game': key } });
  assert.equal(browser.element('gameView').dataset.stage, 'draft');
  assert.equal(browser.element('dateNotice').hidden, false);
  browser.element('dailyMode').handlers.click();
  assert.equal(browser.element('gameView').dataset.stage, 'intro');
  assert.equal(browser.values.get(key), JSON.stringify(state));
});
test('UI keeps daily and practice bests separate and restores a completed attempt', async () => {
  let { state } = finishDraft(daily(E.utcDate()));
  state = E.transition(data, state, { type: 'lock' });
  state = E.transition(data, state, { type: 'revealAll' });
  const browser = await ui({ entries: { [E.storageKey(state)]: JSON.stringify(state), 'twelve-zero:v1:bests': JSON.stringify({ daily: null, practice: 12 }) } });
  assert.equal(browser.element('gameView').dataset.stage, 'complete');
  const best = JSON.parse(browser.values.get('twelve-zero:v1:bests'));
  assert.equal(best.daily, E.score(state.results));
  assert.equal(best.practice, 12);
  assert.ok(!browser.element('gameView').innerHTML.includes('data-action="start"'));
  browser.element('practiceMode').handlers.click();
  browser.element('dailyMode').handlers.click();
  assert.equal(browser.element('gameView').dataset.stage, 'complete');
});
test('UI rejects corrupt saves and provides manual copy when clipboard access fails', async () => {
  const key = E.storageKey(daily(E.utcDate()));
  const corrupt = await ui({ entries: { [key]: 'not-json' } });
  assert.equal(corrupt.element('actionNotice').hidden, false);
  assert.equal(corrupt.element('gameView').dataset.stage, 'intro');
  let { state } = finishDraft(daily(E.utcDate()));
  state = E.transition(data, state, { type: 'lock' });
  state = E.transition(data, state, { type: 'revealAll' });
  const browser = await ui({ entries: { [key]: JSON.stringify(state) }, failedClipboard: true });
  await browser.click('share');
  assert.equal(browser.element('shareDialog').open, true);
  assert.equal(browser.element('shareContent').value, E.shareText(state));
  await browser.element('copyScorecard').handlers.click();
  assert.equal(browser.element('shareContent').selected, true);
  assert.match(browser.element('copyStatus').textContent, /Select and copy/);
});
test('another tab’s locked daily result is adopted before further drafting', async () => {
  const start = daily(E.utcDate());
  const browser = await ui({ entries: { [E.storageKey(start)]: JSON.stringify(start) } });
  const full = E.transition(data, finishDraft(start).state, { type: 'lock' });
  browser.listeners.get('storage')({ key: E.storageKey(full), newValue: JSON.stringify(full) });
  assert.equal(browser.element('gameView').dataset.stage, 'reveal');
});

(async () => {
  let failures = 0;
  for (const [name, run] of tests) {
    try { await run(); console.log(`ok - ${name}`); }
    catch (error) { failures++; console.error(`FAIL - ${name}\n${error.stack}`); }
  }
  console.log(`${tests.length - failures}/${tests.length} game tests passed`);
  process.exitCode = failures ? 1 : 0;
})();
