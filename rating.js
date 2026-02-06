const ratingBody = document.getElementById("ratingBody");

const EVENT_ORDER = ["WGC Match Play", "Presidents Cup", "Ryder Cup"];
const ROUND_ORDER = [
  "Pool Play",
  "Round of 64",
  "Round of 32",
  "Round of 16",
  "Quarterfinals",
  "Semifinals",
  "Third Place",
  "Final",
  "Singles"
];

const BASE_RATING = 1000;
const YEAR_DECAY = 0.99; // mild per-year decay toward baseline

const getRoundIndex = (round) => {
  const idx = ROUND_ORDER.indexOf(round);
  return idx === -1 ? ROUND_ORDER.length : idx;
};

const getEventIndex = (event) => {
  const idx = EVENT_ORDER.indexOf(event);
  return idx === -1 ? EVENT_ORDER.length : idx;
};

const uniqueMatches = (matches) => {
  const seen = new Set();
  const result = [];
  matches.forEach((match) => {
    const players = [match.player, match.opponent].sort().join(" vs ");
    const key = `${match.event}|${match.year}|${match.round}|${players}|${match.score}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(match);
  });
  return result;
};

const sortMatches = (matches) =>
  uniqueMatches(matches)
    .slice()
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const eventDiff = getEventIndex(a.event) - getEventIndex(b.event);
      if (eventDiff !== 0) return eventDiff;
      const roundDiff = getRoundIndex(a.round) - getRoundIndex(b.round);
      if (roundDiff !== 0) return roundDiff;
      return a.player.localeCompare(b.player);
    });

const expectedScore = (rating, opponentRating) =>
  1 / (1 + Math.pow(10, (opponentRating - rating) / 400));

const kFactor = (matchesPlayed) => {
  if (matchesPlayed < 10) return 40;
  if (matchesPlayed < 30) return 30;
  return 20;
};

const applyYearDecay = (ratings, year) => {
  ratings.forEach((entry) => {
    entry.rating = BASE_RATING + (entry.rating - BASE_RATING) * YEAR_DECAY;
    entry.lastYear = year;
  });
};

const ensurePlayer = (ratings, name) => {
  if (!ratings.has(name)) {
    ratings.set(name, {
      name,
      rating: BASE_RATING,
      peak: BASE_RATING,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      lastYear: null
    });
  }
  return ratings.get(name);
};

const computeRatings = (matches) => {
  const ordered = sortMatches(matches);
  const ratings = new Map();
  let currentYear = null;

  ordered.forEach((match) => {
    if (currentYear === null) currentYear = match.year;
    if (match.year !== currentYear) {
      applyYearDecay(ratings, match.year);
      currentYear = match.year;
    }

    const player = ensurePlayer(ratings, match.player);
    const opponent = ensurePlayer(ratings, match.opponent);

    const playerExpected = expectedScore(player.rating, opponent.rating);
    const opponentExpected = expectedScore(opponent.rating, player.rating);

    let score = 0.5;
    if (match.result === "win") score = 1;
    if (match.result === "loss") score = 0;

    const playerK = kFactor(player.matches);
    const opponentK = kFactor(opponent.matches);

    player.rating = player.rating + playerK * (score - playerExpected);
    opponent.rating = opponent.rating + opponentK * ((1 - score) - opponentExpected);

    player.matches += 1;
    opponent.matches += 1;

    if (score === 1) {
      player.wins += 1;
      opponent.losses += 1;
    } else if (score === 0) {
      player.losses += 1;
      opponent.wins += 1;
    } else {
      player.draws += 1;
      opponent.draws += 1;
    }

    if (player.rating > player.peak) player.peak = player.rating;
    if (opponent.rating > opponent.peak) opponent.peak = opponent.rating;
  });

  return Array.from(ratings.values());
};

const renderTable = (players) => {
  if (!ratingBody) return;
  ratingBody.innerHTML = "";

  const sorted = players.slice().sort((a, b) => b.rating - a.rating);
  sorted.forEach((player, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${player.name}</td>
      <td>${player.rating.toFixed(1)}</td>
      <td>${player.matches}</td>
      <td>${player.wins}-${player.draws}-${player.losses}</td>
      <td>${player.peak.toFixed(1)}</td>
    `;
    ratingBody.append(row);
  });
};

fetch("data.json")
  .then((res) => res.json())
  .then((data) => {
    const matches = (data.matches || []).filter((match) => match.result !== "not played");
    const ratings = computeRatings(matches);
    renderTable(ratings);
  });
