(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TwelveZero = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const TOTAL = 12;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const utcDate = (date = new Date()) => date.toISOString().slice(0, 10);
  const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && utcDate(new Date(date)) === date;
  // FNV-1a seed hashing and Mulberry32 are fixed for the lifetime of dataset v1.
  function random(seed) {
    let value = 2166136261;
    for (const letter of seed) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
    return () => {
      let t = value += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(items, rng) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function validateData(data) {
    assert(data?.version === 'v1' && Array.isArray(data.cards), 'Unsupported card collection.');
    const ids = new Set();
    const groups = { modern: new Set(), legend: new Set() };
    for (const c of data.cards) {
      assert(c && typeof c.id === 'string' && !ids.has(c.id) && typeof c.playerId === 'string' &&
        typeof c.name === 'string' && typeof c.country === 'string' && Number.isInteger(c.year) &&
        Number.isFinite(c.rating) && groups[c.group], 'Invalid golfer card.');
      assert(c.id === `${c.playerId}:${c.year}`, 'Invalid card identity.');
      ids.add(c.id); groups[c.group].add(c.playerId);
    }
    assert(groups.modern.size >= 60 && groups.legend.size >= 6, 'Not enough golfers for a full challenge.');
    assert(![...groups.modern].some(id => groups.legend.has(id)), 'Draft pools must contain distinct golfers.');
    return data;
  }
  function seedFor(state) {
    return state.mode === 'daily' ? `12-0:${state.dataVersion}:${state.date}` : `12-0:${state.dataVersion}:practice:${state.practiceId}`;
  }
  function createGame(data, { mode = 'daily', date = utcDate(), practiceId = '' } = {}) {
    assert(['daily', 'practice'].includes(mode) && validDate(date), 'Invalid challenge.');
    assert(mode === 'daily' || /^[a-z0-9-]{8,100}$/i.test(practiceId), 'Invalid practice identifier.');
    return { schema: 1, dataVersion: data.version, mode, date, practiceId: mode === 'practice' ? practiceId : '', actions: [], lineup: [], results: null, revealed: 0 };
  }
  function createChallenge(data, state) {
    assert(state.dataVersion === data.version, 'This challenge uses a different card collection.');
    const seed = seedFor(state);
    const draftRandom = random(`${seed}:draft`);
    const byGroup = { modern: new Map(), legend: new Map() };
    data.cards.forEach(c => {
      const group = byGroup[c.group];
      if (!group.has(c.playerId)) group.set(c.playerId, []);
      group.get(c.playerId).push(c);
    });
    const draw = (group, count) => shuffle([...byGroup[group].values()], draftRandom).slice(0, count)
      .map(cards => cards[Math.floor(draftRandom() * cards.length)]);
    const deck = shuffle([...draw('modern', 36), ...draw('legend', 6)], draftRandom);
    const used = new Set(deck.map(c => c.playerId));
    const remaining = data.cards.filter(c => !used.has(c.playerId)).sort((a, b) => a.rating - b.rating || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const opponentRandom = random(`${seed}:opponents`);
    const opponents = [];
    for (let tier = 0; tier < 3; tier++) {
      const band = remaining.slice(Math.floor(tier * remaining.length / 3), Math.floor((tier + 1) * remaining.length / 3));
      for (let i = 0; i < 4; i++) {
        const eligible = band.filter(c => !used.has(c.playerId));
        assert(eligible.length, 'Unable to create the opposition.');
        const card = eligible[Math.floor(opponentRandom() * eligible.length)];
        opponents.push(card); used.add(card.playerId);
      }
    }
    return {
      offers: Array.from({ length: TOTAL }, (_, i) => deck.slice(i * 3, i * 3 + 3)),
      reserves: [deck.slice(36, 39), deck.slice(39, 42)],
      opponents: shuffle(opponents, opponentRandom)
    };
  }
  function draftState(challenge, actions) {
    assert(Array.isArray(actions) && actions.length <= 14, 'Invalid draft history.');
    const picks = [];
    let rerolls = 0;
    let offers = challenge.offers[0];
    for (const action of actions) {
      assert(picks.length < TOTAL && action, 'The draft is already complete.');
      if (action.type === 'reroll') {
        assert(rerolls < 2, 'No rerolls remaining.');
        offers = challenge.reserves[rerolls++];
      } else {
        assert(action.type === 'pick' && offers.some(c => c.id === action.cardId), 'This golfer was not offered.');
        picks.push(action.cardId);
        offers = challenge.offers[picks.length] || [];
      }
    }
    return { picks, rerolls, offers };
  }
  function probabilities(rating, opponentRating) {
    const expected = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
    const half = 0.12 * 4 * expected * (1 - expected);
    const win = expected - half / 2;
    return { win, half, loss: 1 - win - half };
  }
  function simulate(data, state, challenge) {
    const cards = new Map(data.cards.map(c => [c.id, c]));
    const rng = random(`${seedFor(state)}:results`);
    return state.lineup.map((id, i) => {
      const card = cards.get(id);
      const opponent = challenge.opponents[i];
      const p = probabilities(card.rating, opponent.rating);
      const roll = rng();
      const result = roll < p.win ? 'win' : roll < p.win + p.half ? 'half' : 'loss';
      return { cardId: id, opponentId: opponent.id, result, points: result === 'win' ? 1 : result === 'half' ? 0.5 : 0 };
    });
  }
  function transition(data, state, action, challenge = createChallenge(data, state)) {
    const next = { ...state };
    const draft = draftState(challenge, state.actions);
    if (action.type === 'pick' || action.type === 'reroll') {
      assert(!state.results, 'The lineup is locked.');
      next.actions = [...state.actions, action];
      const updated = draftState(challenge, next.actions);
      if (updated.picks.length === TOTAL) next.lineup = [...updated.picks];
    } else if (action.type === 'swap') {
      assert(draft.picks.length === TOTAL && !state.results, 'Finish drafting before arranging your team.');
      assert([action.a, action.b].every(n => Number.isInteger(n) && n >= 0 && n < TOTAL), 'Invalid lineup position.');
      next.lineup = [...state.lineup];
      [next.lineup[action.a], next.lineup[action.b]] = [next.lineup[action.b], next.lineup[action.a]];
    } else if (action.type === 'lock') {
      assert(draft.picks.length === TOTAL && !state.results, 'The lineup cannot be locked.');
      next.results = simulate(data, state, challenge);
    } else if (action.type === 'reveal' || action.type === 'revealAll') {
      assert(state.results && state.revealed < TOTAL, 'No matches left to reveal.');
      next.revealed = action.type === 'revealAll' ? TOTAL : state.revealed + 1;
    } else throw new Error('Unknown game action.');
    return next;
  }
  function restoreGame(data, raw) {
    assert(raw?.schema === 1 && raw.dataVersion === data.version, 'Saved game version is unavailable.');
    const clean = createGame(data, raw);
    const challenge = createChallenge(data, clean);
    const draft = draftState(challenge, raw.actions);
    assert(Array.isArray(raw.lineup), 'Invalid saved lineup.');
    const sorted = a => [...a].sort().join('|');
    assert(draft.picks.length < TOTAL ? raw.lineup.length === 0 :
      raw.lineup.length === TOTAL && sorted(raw.lineup) === sorted(draft.picks), 'Invalid saved lineup.');
    clean.actions = raw.actions.map(a => a.type === 'pick' ? { type: 'pick', cardId: a.cardId } : { type: 'reroll' });
    clean.lineup = [...raw.lineup];
    assert(Number.isInteger(raw.revealed) && raw.revealed >= 0 && raw.revealed <= TOTAL, 'Invalid reveal progress.');
    if (raw.results !== null) {
      assert(draft.picks.length === TOTAL, 'Incomplete saved team.');
      clean.results = simulate(data, clean, challenge);
      assert(JSON.stringify(raw.results) === JSON.stringify(clean.results), 'Saved results do not match the challenge.');
    } else assert(raw.revealed === 0, 'The session has not started.');
    clean.revealed = raw.revealed;
    return clean;
  }
  const score = (results, revealed = TOTAL) => (results || []).slice(0, revealed).reduce((sum, r) => sum + r.points, 0);
  const formatPoints = points => Number.isInteger(points) ? String(points) : `${Math.floor(points) || ''}½`;
  const storageKey = state => `twelve-zero:${state.dataVersion}:${state.mode}:${state.mode === 'daily' ? state.date : 'current'}`;
  function shareText(state) {
    assert(state.results && state.revealed === TOTAL, 'Finish the session before sharing.');
    const points = score(state.results);
    return `12–0 · ${state.mode === 'daily' ? state.date : 'Practice'}\n${formatPoints(points)}–${formatPoints(TOTAL - points)}${points === TOTAL ? ' · Clean sweep!' : ''}\n${state.results.map(r => ({ win: '🟩', half: '🟨', loss: '⬜' })[r.result]).join('')}\nhttps://www.matchplayrankings.com/games/12-0/`;
  }
  return { TOTAL, utcDate, random, shuffle, validateData, createGame, createChallenge, draftState, probabilities, simulate, transition, restoreGame, score, formatPoints, storageKey, shareText };
});
