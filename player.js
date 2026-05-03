const profileRoot = document.getElementById("playerProfileRoot");
const currentSlug = document.body.dataset.playerSlug || "";

const EVENT_ORDER = [
  "WGC Match Play",
  "The World Match Play Championship",
  "World Match Play Championship",
  "Paul Lawrie Match Play",
  "Olympics",
  "PGA Championship",
  "Presidents Cup",
  "Seve Trophy",
  "Eurasia Cup",
  "The Royal Trophy",
  "Ryder Cup"
];
const MONTH_ORDER = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
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
const YEAR_DECAY = 0.99;
const MOV_MARGIN_CAP = 10;
const MOV_MULTIPLIER_MIN = 0.75;
const MOV_MULTIPLIER_MAX = 1.8;
const MOV_NEUTRAL_SCORES = new Set(["ret", "wd", "won", "by default", "conceded"]);
const FEATURED_EVENT_LABELS = ["Ryder Cup", "Presidents Cup", "WGC / Dell Match Play", "Seve Trophy"];

const asText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const escapeHtml = (value) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatUpdatedDate = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
};

const formatNumber = (value, digits = 0, fallback = "—") => {
  if (!Number.isFinite(value)) return fallback;
  return value.toFixed(digits);
};

const formatPercentage = (value) => {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
};

const flagFromCountry = (code) => {
  code = asText(code);
  if (!code) return "";
  const base = 0x1f1e6;
  return code
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map((char) => String.fromCodePoint(base + char.charCodeAt(0) - 65))
    .join("");
};

const getIndex = (list, value) => {
  const index = list.indexOf(value);
  return index === -1 ? list.length : index;
};

const normalizeEventLabel = (event) => {
  const label = asText(event, "Unknown event");
  if (/\b(wgc|dell)\b/i.test(label) && /match play/i.test(label)) {
    return "WGC / Dell Match Play";
  }
  return label;
};

const sortEventBreakdown = (a, b) => {
  const featuredDiff = getIndex(FEATURED_EVENT_LABELS, a.event) - getIndex(FEATURED_EVENT_LABELS, b.event);
  if (featuredDiff !== 0) return featuredDiff;
  const orderDiff = getIndex(EVENT_ORDER.map(normalizeEventLabel), a.event) - getIndex(EVENT_ORDER.map(normalizeEventLabel), b.event);
  if (orderDiff !== 0) return orderDiff;
  return a.event.localeCompare(b.event);
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
      const monthDiff = getIndex(MONTH_ORDER, a.month) - getIndex(MONTH_ORDER, b.month);
      if (monthDiff !== 0) return monthDiff;
      const eventDiff = getIndex(EVENT_ORDER, a.event) - getIndex(EVENT_ORDER, b.event);
      if (eventDiff !== 0) return eventDiff;
      const roundDiff = getIndex(ROUND_ORDER, a.round) - getIndex(ROUND_ORDER, b.round);
      if (roundDiff !== 0) return roundDiff;
      return asText(a.player).localeCompare(asText(b.player));
    });

const expectedScore = (rating, opponentRating) =>
  1 / (1 + Math.pow(10, (opponentRating - rating) / 400));

const kFactor = (matchesPlayed) => {
  if (matchesPlayed < 10) return 40;
  if (matchesPlayed < 30) return 30;
  return 20;
};

const normalizeScoreText = (value) =>
  (value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const parseMarginFromScore = (scoreText) => {
  const score = normalizeScoreText(scoreText);
  if (!score || score === "halved" || MOV_NEUTRAL_SCORES.has(score)) return null;
  if (/^\d+h$/.test(score)) return 1;
  const andMatch = score.match(/^(\d+)\s*(?:&|and)\s*(\d+)$/);
  if (andMatch) return Number(andMatch[1]);
  const andUpMatch = score.match(/^(\d+)\s+and\s+up$/);
  if (andUpMatch) return Number(andUpMatch[1]);
  const upMatch = score.match(/^(\d+)\s*-?\s*up(?:\s*\(\d+\))?$/);
  if (upMatch) return Number(upMatch[1]);
  return null;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const computeMovMultiplier = (result, scoreText, playerRating, opponentRating) => {
  if (result === "halved") return 1;
  const parsedMargin = parseMarginFromScore(scoreText);
  if (!Number.isFinite(parsedMargin) || parsedMargin <= 0) return 1;
  const margin = clamp(parsedMargin, 1, MOV_MARGIN_CAP);
  const winnerRating = result === "win" ? playerRating : opponentRating;
  const loserRating = result === "win" ? opponentRating : playerRating;
  const winnerDelta = winnerRating - loserRating;
  const rawMultiplier = Math.log(margin + 1) * (2.2 / (winnerDelta * 0.001 + 2.2));
  if (!Number.isFinite(rawMultiplier) || rawMultiplier <= 0) return 1;
  return clamp(rawMultiplier, MOV_MULTIPLIER_MIN, MOV_MULTIPLIER_MAX);
};

const ensureRatingPlayer = (ratings, name, country) => {
  if (!ratings.has(name)) {
    ratings.set(name, {
      name,
      country: country || "",
      rating: BASE_RATING,
      peak: BASE_RATING,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0
    });
  } else if (country && !ratings.get(name).country) {
    ratings.get(name).country = country;
  }
  return ratings.get(name);
};

const computePlayerRatingProfile = (matches, playerName) => {
  const ratings = new Map();
  const timeline = [];
  let currentYear = null;

  sortMatches(matches).forEach((match) => {
    if (currentYear === null) currentYear = match.year;
    if (match.year !== currentYear) {
      ratings.forEach((entry) => {
        entry.rating = BASE_RATING + (entry.rating - BASE_RATING) * YEAR_DECAY;
      });
      currentYear = match.year;
    }

    const player = ensureRatingPlayer(ratings, match.player, match.player_country);
    const opponent = ensureRatingPlayer(ratings, match.opponent, match.opponent_country);
    const playerBefore = player.rating;
    const opponentBefore = opponent.rating;
    const playerExpected = expectedScore(player.rating, opponent.rating);
    const opponentExpected = expectedScore(opponent.rating, player.rating);
    let score = 0.5;
    if (match.result === "win") score = 1;
    if (match.result === "loss") score = 0;

    const multiplier = computeMovMultiplier(match.result, match.score, player.rating, opponent.rating);
    player.rating += kFactor(player.matches) * multiplier * (score - playerExpected);
    opponent.rating += kFactor(opponent.matches) * multiplier * ((1 - score) - opponentExpected);

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

    if (match.player === playerName || match.opponent === playerName) {
      const isPlayerSide = match.player === playerName;
      const before = isPlayerSide ? playerBefore : opponentBefore;
      const after = isPlayerSide ? player.rating : opponent.rating;
      const opponentBeforeRating = isPlayerSide ? opponentBefore : playerBefore;
      const result = isPlayerSide
        ? match.result
        : match.result === "win"
          ? "loss"
          : match.result === "loss"
            ? "win"
            : "halved";
      timeline.push({
        event: match.event,
        year: match.year,
        month: match.month,
        round: match.round,
        opponent: isPlayerSide ? match.opponent : match.player,
        opponentCountry: isPlayerSide ? match.opponent_country : match.player_country,
        result,
        score: match.score,
        ratingBefore: before,
        ratingAfter: after,
        ratingDelta: after - before,
        opponentRatingBefore: opponentBeforeRating
      });
    }
  });

  return { rating: ratings.get(playerName) || null, timeline };
};

const calculateRecord = (matches, playerName) => {
  const playerMatches = matches.filter((match) => match.player === playerName);
  return playerMatches.reduce(
    (record, match) => {
      record.matches += 1;
      record.points += Number(match.points || 0);
      if (match.result === "win") record.wins += 1;
      if (match.result === "halved") record.draws += 1;
      if (match.result === "loss") record.losses += 1;
      record.lastYear = Math.max(record.lastYear, Number(match.year) || 0);
      return record;
    },
    { matches: 0, points: 0, wins: 0, draws: 0, losses: 0, lastYear: 0 }
  );
};

const buildEventBreakdown = (matches, playerName) => {
  const eventTypes = new Set(matches.map((match) => normalizeEventLabel(match.event)));
  const breakdown = new Map(
    Array.from(eventTypes).map((event) => [
      event,
      { event, matches: 0, wins: 0, draws: 0, losses: 0, points: 0 }
    ])
  );

  matches
    .filter((match) => match.player === playerName)
    .forEach((match) => {
      const event = normalizeEventLabel(match.event);
      if (!breakdown.has(event)) {
        breakdown.set(event, { event, matches: 0, wins: 0, draws: 0, losses: 0, points: 0 });
      }
      const split = breakdown.get(event);
      split.matches += 1;
      split.points += Number(match.points || 0);
      if (match.result === "win") split.wins += 1;
      if (match.result === "halved") split.draws += 1;
      if (match.result === "loss") split.losses += 1;
    });

  return Array.from(breakdown.values()).sort(sortEventBreakdown);
};

const buildPlayerSlugMap = (players) =>
  new Map((Array.isArray(players) ? players : []).map((entry) => [entry.name, entry.slug]));

const getPlayerProfileHref = (playerSlugMap, name) => {
  const slug = playerSlugMap.get(name);
  return slug ? `../${slug}/` : "";
};

const formatMatchDate = (match) => {
  const month = asText(match.month);
  const year = asText(match.year);
  return month && year ? `${month} ${year}` : year || "Date unavailable";
};

const getMatchSortValue = (match) => {
  const year = Number(match.year) || 0;
  return year * 100 + getIndex(MONTH_ORDER, match.month);
};

const formatRatingDelta = (value) => {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
};

const buildBestWins = (timeline) =>
  timeline
    .filter((match) => match.result === "win" && Number.isFinite(match.opponentRatingBefore))
    .slice()
    .sort((a, b) => b.opponentRatingBefore - a.opponentRatingBefore || b.ratingDelta - a.ratingDelta)
    .slice(0, 5);

const buildWorstLosses = (timeline) =>
  timeline
    .filter((match) => match.result === "loss" && Number.isFinite(match.opponentRatingBefore))
    .slice()
    .sort((a, b) => a.ratingDelta - b.ratingDelta || a.opponentRatingBefore - b.opponentRatingBefore)
    .slice(0, 5);

const renderOpponentLink = (match, playerSlugMap) => {
  const href = getPlayerProfileHref(playerSlugMap, match.opponent);
  const label = `${flagFromCountry(match.opponentCountry)} ${match.opponent}`.trim();
  return href
    ? `<a class="player-link" href="${href}">${escapeHtml(label)}</a>`
    : escapeHtml(label);
};

const renderNotableMatchesSection = ({ title, description, matches, playerSlugMap }) => `
  <section class="panel panel--sport">
    <div class="panel__header">
      <div class="panel__title-row">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <p class="muted">${escapeHtml(description)}</p>
    </div>
    ${
      matches.length
        ? `
          <div class="table-wrap">
            <table class="rank-table player-profile-notable-table">
              <thead>
                <tr>
                  <th>Opponent</th>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Opponent Elo</th>
                  <th>Elo change</th>
                </tr>
              </thead>
              <tbody>
                ${matches
                  .map(
                    (match) => `
                      <tr>
                        <td>${renderOpponentLink(match, playerSlugMap)}</td>
                        <td>${escapeHtml(match.event)}</td>
                        <td>${escapeHtml(formatMatchDate(match))}</td>
                        <td>${escapeHtml(match.score || (match.result === "win" ? "Win" : "Loss"))}</td>
                        <td>${Math.round(match.opponentRatingBefore)}</td>
                        <td>${formatRatingDelta(match.ratingDelta)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="player-profile-unavailable"><p class="muted">Not enough rating data is available for this section.</p></div>`
    }
  </section>
`;

const buildHeadToHeadRecords = (timeline) => {
  const records = new Map();

  timeline.forEach((match) => {
    const opponent = asText(match.opponent);
    if (!opponent) return;
    if (!records.has(opponent)) {
      records.set(opponent, {
        opponent,
        opponentCountry: match.opponentCountry || "",
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        latestMeeting: "",
        latestSortValue: 0
      });
    }

    const record = records.get(opponent);
    record.matches += 1;
    if (match.result === "win") {
      record.wins += 1;
      record.points += 1;
    } else if (match.result === "loss") {
      record.losses += 1;
    } else {
      record.draws += 1;
      record.points += 0.5;
    }

    const sortValue = getMatchSortValue(match);
    if (sortValue >= record.latestSortValue) {
      record.latestSortValue = sortValue;
      record.latestMeeting = formatMatchDate(match);
    }
  });

  return Array.from(records.values()).map((record) => ({
    ...record,
    pointsPerMatch: record.matches ? record.points / record.matches : null
  }));
};

const compareHeadToHeadRecords = (a, b, sortKey) => {
  if (sortKey === "wins") {
    return b.wins - a.wins || b.matches - a.matches || b.points - a.points || a.opponent.localeCompare(b.opponent);
  }
  if (sortKey === "ppm") {
    return (b.pointsPerMatch ?? -1) - (a.pointsPerMatch ?? -1) || b.matches - a.matches || a.opponent.localeCompare(b.opponent);
  }
  if (sortKey === "latest") {
    return b.latestSortValue - a.latestSortValue || b.matches - a.matches || a.opponent.localeCompare(b.opponent);
  }
  return b.matches - a.matches || b.points - a.points || b.wins - a.wins || a.opponent.localeCompare(b.opponent);
};

const getHeadToHeadOpponentLink = (record, playerSlugMap) => {
  const href = getPlayerProfileHref(playerSlugMap, record.opponent);
  const label = `${flagFromCountry(record.opponentCountry)} ${record.opponent}`.trim();
  return href
    ? `<a class="player-link" href="${href}">${escapeHtml(label)}</a>`
    : escapeHtml(label);
};

const renderHeadToHeadRows = (records, playerSlugMap) =>
  records
    .map(
      (record) => `
        <tr>
          <td>${getHeadToHeadOpponentLink(record, playerSlugMap)}</td>
          <td>${record.matches}</td>
          <td>${record.wins}</td>
          <td>${record.draws}</td>
          <td>${record.losses}</td>
          <td>${record.points.toFixed(1)}</td>
          <td>${formatNumber(record.pointsPerMatch, 2)}</td>
          <td>${escapeHtml(record.latestMeeting || "—")}</td>
        </tr>
      `
    )
    .join("");

const renderHeadToHeadSection = (records, playerSlugMap) => {
  const sortedRecords = records.slice().sort((a, b) => compareHeadToHeadRecords(a, b, "matches"));
  if (sortedRecords.length === 0) {
    return `
      <section class="panel panel--sport">
        <div class="panel__header">
          <div class="panel__title-row">
            <h2>Head-to-Head Records</h2>
          </div>
        </div>
        <div class="player-profile-unavailable"><p class="muted">No opponent records are available for this player.</p></div>
      </section>
    `;
  }

  return `
    <section class="panel panel--sport">
      <div class="panel__header player-profile-h2h-header">
        <div>
          <div class="panel__title-row">
            <h2>Head-to-Head Records</h2>
          </div>
          <p class="muted">Record against every captured opponent, sorted by most frequent opponents first.</p>
        </div>
        <div class="player-profile-h2h-controls">
          <label>
            <span>Search</span>
            <input id="headToHeadSearch" type="search" placeholder="Filter opponents" autocomplete="off" />
          </label>
          <label>
            <span>Sort</span>
            <select id="headToHeadSort">
              <option value="matches">Matches played</option>
              <option value="wins">Wins</option>
              <option value="ppm">Points per match</option>
              <option value="latest">Latest meeting</option>
            </select>
          </label>
        </div>
      </div>
      <div class="table-wrap">
        <table class="rank-table">
          <thead>
            <tr>
              <th>Opponent</th>
              <th>Matches</th>
              <th>Wins</th>
              <th>Draws</th>
              <th>Losses</th>
              <th>Points</th>
              <th>PPM</th>
              <th>Latest</th>
            </tr>
          </thead>
          <tbody id="headToHeadBody">
            ${renderHeadToHeadRows(sortedRecords, playerSlugMap)}
          </tbody>
        </table>
      </div>
      <div id="headToHeadEmpty" class="player-profile-unavailable" hidden>
        <p class="muted">No opponents match that search.</p>
      </div>
    </section>
  `;
};

const setupHeadToHeadControls = (records, playerSlugMap) => {
  const body = document.getElementById("headToHeadBody");
  const empty = document.getElementById("headToHeadEmpty");
  const search = document.getElementById("headToHeadSearch");
  const sort = document.getElementById("headToHeadSort");
  if (!body || !search || !sort) return;

  const update = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = records
      .filter((record) => record.opponent.toLowerCase().includes(query))
      .sort((a, b) => compareHeadToHeadRecords(a, b, sort.value));
    body.innerHTML = renderHeadToHeadRows(filtered, playerSlugMap);
    if (empty) empty.hidden = filtered.length > 0;
  };

  search.addEventListener("input", update);
  sort.addEventListener("change", update);
};

const renderState = ({ title, message, eyebrow = "Player Profile", actionLabel = "Back to player ratings" }) => {
  if (!profileRoot) return;
  profileRoot.innerHTML = `
    <section class="panel panel--sport player-profile__state">
      <p class="sport-band__eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">${escapeHtml(message)}</p>
      <a class="profile-back-link" href="../../index.html">${escapeHtml(actionLabel)}</a>
    </section>
  `;
};

const renderNotFound = () =>
  renderState({
    title: "Player not found",
    message: "We could not find that player in the matchplay archive."
  });

const renderError = () =>
  renderState({
    title: "Profile unavailable",
    message: "The player profile data could not be loaded. Please try again from the player ratings page.",
    eyebrow: "Loading Error"
  });

const renderEmpty = (player) =>
  renderState({
    title: player?.name || "No profile data",
    message: "This player exists in the archive, but there are no playable matches available for their profile yet.",
    eyebrow: "Empty Profile"
  });

const renderProfile = (player, matches, metadata, players = []) => {
  const record = calculateRecord(matches, player.name);
  const { rating, timeline } = computePlayerRatingProfile(matches, player.name);
  const playerSlugMap = buildPlayerSlugMap(players);
  const flag = flagFromCountry(player.country);
  const countryLabel = player.country ? player.country.toUpperCase() : "Country unavailable";
  const updated = formatUpdatedDate(metadata?.dataUpdatedAt || metadata?.lastUpdated);
  const recentMatches = timeline.slice().reverse();
  const latestArchiveYear = matches.reduce((latest, match) => Math.max(latest, Number(match.year) || 0), 0);
  const activeCutoff = latestArchiveYear ? latestArchiveYear - 5 : 0;
  const statusLabel = record.lastYear && activeCutoff && record.lastYear >= activeCutoff ? "Active" : "Inactive";
  const pointsPerMatch = record.matches ? record.points / record.matches : null;
  const pointsPercentage = record.matches ? (record.points / record.matches) * 100 : null;
  const winPercentage = record.matches ? (record.wins / record.matches) * 100 : null;
  const eventBreakdown = buildEventBreakdown(matches, player.name);
  const bestWins = buildBestWins(timeline);
  const worstLosses = buildWorstLosses(timeline);
  const headToHeadRecords = buildHeadToHeadRecords(timeline);

  if (record.matches === 0 || recentMatches.length === 0) {
    renderEmpty(player);
    return;
  }

  profileRoot.innerHTML = `
    <section class="sport-band player-profile-hero">
      <div class="sport-band__content player-profile-hero__content">
        <div class="sport-band__copy">
          <p class="sport-band__eyebrow">Player Profile</p>
          <h1>${flag ? `${flag} ` : ""}${escapeHtml(player.name)}</h1>
          <p>${escapeHtml(countryLabel)} · ${statusLabel} · ${record.matches} singles matches captured in the Matchplay Rankings archive.${updated ? ` Last updated: ${updated}.` : ""}</p>
        </div>
        <div class="lineal-card lineal-card--gold player-profile-card">
          <p class="lineal-card__label">Profile Summary</p>
          <div class="lineal-card__title-row">
            <h2 class="lineal-card__name">${rating ? Math.round(rating.rating) : "—"}</h2>
            <span class="lineal-card__record">Rating</span>
          </div>
          <div class="lineal-card__meta">${record.wins}-${record.draws}-${record.losses} W-D-L · ${record.points.toFixed(1)} points</div>
          <div class="lineal-card__stats">
            <span>${record.matches} matches</span>
            <span>Peak ${rating ? Math.round(rating.peak) : "—"}</span>
            <span>PPM ${formatNumber(pointsPerMatch, 2)}</span>
          </div>
        </div>
      </div>
    </section>
    <main class="layout layout--sport player-profile-layout">
      <section class="player-profile-summary-grid" aria-label="Player summary statistics">
        <article class="player-profile-stat">
          <span>Current Elo</span>
          <strong>${rating ? Math.round(rating.rating) : "—"}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Peak Elo</span>
          <strong>${rating ? Math.round(rating.peak) : "—"}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Record</span>
          <strong>${record.wins}-${record.draws}-${record.losses}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Points</span>
          <strong>${record.points.toFixed(1)}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Points per match</span>
          <strong>${formatNumber(pointsPerMatch, 2)}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Points percentage</span>
          <strong>${formatPercentage(pointsPercentage)}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Win percentage</span>
          <strong>${formatPercentage(winPercentage)}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Status</span>
          <strong>${statusLabel}</strong>
        </article>
      </section>
      <div class="player-profile-notables">
        ${renderNotableMatchesSection({
          title: "Best Wins",
          description: "Wins against the highest-rated opponents, using opponent pre-match Elo.",
          matches: bestWins,
          playerSlugMap
        })}
        ${renderNotableMatchesSection({
          title: "Worst Losses",
          description: "Losses with the biggest negative Elo impact; opponent rating shown is pre-match Elo.",
          matches: worstLosses,
          playerSlugMap
        })}
      </div>
      ${renderHeadToHeadSection(headToHeadRecords, playerSlugMap)}
      <section class="panel panel--sport">
        <div class="panel__header">
          <div class="panel__title-row">
            <h2>Competition Records</h2>
          </div>
          <p class="muted">Record by event type, including competitions where this player has no captured matches.</p>
        </div>
        <div class="table-wrap">
          <table class="rank-table">
            <thead>
              <tr>
                <th>Competition</th>
                <th>Matches</th>
                <th>Wins</th>
                <th>Draws</th>
                <th>Losses</th>
                <th>Points</th>
                <th>PPM</th>
                <th>Points %</th>
              </tr>
            </thead>
            <tbody>
              ${eventBreakdown
                .map(
                  (split) => {
                    const splitPointsPerMatch = split.matches ? split.points / split.matches : null;
                    const splitPointsPercentage = split.matches ? (split.points / split.matches) * 100 : null;
                    return `
                    <tr class="${split.matches === 0 ? "is-empty-event" : ""}">
                      <td>${escapeHtml(split.event)}</td>
                      <td>${split.matches}</td>
                      <td>${split.wins}</td>
                      <td>${split.draws}</td>
                      <td>${split.losses}</td>
                      <td>${split.points.toFixed(1)}</td>
                      <td>${formatNumber(splitPointsPerMatch, 2)}</td>
                      <td>${formatPercentage(splitPointsPercentage)}</td>
                    </tr>
                  `;
                  }
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel panel--sport">
        <div class="panel__header">
          <div class="panel__title-row">
            <h2>Match History</h2>
          </div>
          <p class="muted">Rating values are shown before and after each match.</p>
        </div>
        <div class="player-profile-matches">
          ${recentMatches
            .map((match) => {
              const resultClass =
                match.result === "win"
                  ? "result-win"
                  : match.result === "loss"
                    ? "result-loss"
                    : "result-halved";
              const resultLabel = match.result === "halved" ? "Draw" : match.result.toUpperCase();
              const delta = Math.round(match.ratingDelta);
              return `
                <article class="match-row ${resultClass}">
                  <div>
                    <strong>${escapeHtml(match.event)} ${escapeHtml(match.year)}</strong> — ${escapeHtml(match.opponent)}
                    <div class="meta">${escapeHtml(match.round || "Singles")} · Opponent rating ${Math.round(match.opponentRatingBefore)}</div>
                  </div>
                  <div>
                    <span class="rating-delta ${delta > 0 ? "rating-delta--pos" : delta < 0 ? "rating-delta--neg" : "rating-delta--even"}">${delta > 0 ? `+${delta}` : delta}</span>
                    <div class="match-result">${resultLabel}</div>
                    <span class="meta">${Math.round(match.ratingBefore)} → ${Math.round(match.ratingAfter)} · ${escapeHtml(match.score || "")}</span>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    </main>
  `;
  setupHeadToHeadControls(headToHeadRecords, playerSlugMap);
};

Promise.all([
  fetch("../../players-data.json").then((res) => {
    if (!res.ok) throw new Error("Unable to load player index");
    return res.json();
  }),
  fetch("../../data.json").then((res) => {
    if (!res.ok) throw new Error("Unable to load match data");
    return res.json();
  }),
  fetch("../../site-data.json")
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
])
  .then(([playersData, matchData, metadata]) => {
    const player = (playersData.players || []).find((entry) => entry.slug === currentSlug);
    if (!player) {
      renderNotFound();
      return;
    }
    const matches = Array.isArray(matchData?.matches)
      ? matchData.matches.filter((match) => match && match.result !== "not played")
      : [];
    renderProfile(player, matches, metadata, playersData.players);
  })
  .catch(() => {
    renderError();
  });

const navToggle = document.querySelector(".site-nav__toggle");
const navLinks = document.getElementById("siteNavLinks");
const navBackdrop = document.getElementById("siteNavBackdrop");

const closeNav = () => {
  if (!navLinks || !navToggle || !navBackdrop) return;
  navLinks.classList.remove("is-open");
  navBackdrop.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
};

if (navToggle && navLinks && navBackdrop) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navBackdrop.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  navBackdrop.addEventListener("click", closeNav);

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) closeNav();
  });
}
