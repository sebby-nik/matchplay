const ratingBody = document.getElementById("ratingBody");
const eventFilter = document.getElementById("eventFilter");
const eventSummary = document.getElementById("eventSummary");
const eventSearch = document.getElementById("eventSearch");
const eventSelectAll = document.getElementById("eventSelectAll");
const eventDropdown = document.getElementById("eventDropdown");
const searchInput = document.getElementById("searchInput");
const playerChips = document.getElementById("playerChips");
const playerSuggestions = document.getElementById("playerSuggestions");
const minMatchesInput = document.getElementById("minMatches");
const minMatchesValue = document.getElementById("minMatchesValue");
const activeOnlyToggle = document.getElementById("activeOnlyToggle");
const summary = document.getElementById("summary");
const filterChips = document.getElementById("filterChips");
const clearAllFilters = document.getElementById("clearAllFilters");
const countryFilter = document.getElementById("countryFilter");
const countrySummary = document.getElementById("countrySummary");
const countrySearch = document.getElementById("countrySearch");
const countrySelectAll = document.getElementById("countrySelectAll");
const countryDropdown = document.getElementById("countryDropdown");
const mobileFilterToggle = document.getElementById("mobileFilterToggle");
const mobileFilterToggleBar = document.getElementById("mobileFilterToggleBar");
const mobileFilterBar = document.getElementById("mobileFilterBar");
const mobileFilterOverlay = document.getElementById("mobileFilterOverlay");
const controlsPanel = document.getElementById("controlsPanel");
const controlsPanelClose = document.getElementById("controlsPanelClose");
const tableHeaders = document.querySelectorAll(".rank-table th[data-sort]");
const ratingLeaderName = document.getElementById("ratingLeaderName");
const ratingLeaderRating = document.getElementById("ratingLeaderRating");
const ratingLeaderMeta = document.getElementById("ratingLeaderMeta");
const ratingLeaderStats = document.getElementById("ratingLeaderStats");
const lastUpdatedNote = document.getElementById("lastUpdatedNote");
const profileSearchInput = document.getElementById("profileSearchInput");
const profileSearchResults = document.getElementById("profileSearchResults");

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
const CALIBRATION_BIN = 25;
const CALIBRATION_MIN_MATCHES = 8;
const CALIBRATION_PRIOR = 1;
const MOV_MARGIN_CAP = 10;
const MOV_MULTIPLIER_MIN = 0.75;
const MOV_MULTIPLIER_MAX = 1.8;
const MOV_NEUTRAL_SCORES = new Set(["ret", "wd", "won", "by default", "conceded"]);
const DEFAULT_LEADER_COPY = {
  name: "Ratings loading",
  rating: "Rating —",
  meta: "Computing matchplay ratings from the archive.",
  stats: ["Singles matchplay only", "Elo-based ratings"]
};

let allMatches = [];
let allPlayers = [];
let availablePlayers = [];
let currentPlayers = [];
let selectedEvents = new Set();
let selectedCountries = new Set();
let selectedPlayers = new Set();
let allEvents = [];
let allCountries = [];
let currentSort = { key: "rating", direction: "desc" };
let ratingsCache = new Map();
let outcomeCalibration = null;
let siteMetadata = null;
let playerSlugMap = new Map();
let profileSearchIndex = [];

const normalize = (value) => {
  if (!value) return "";
  const map = {
    ø: "o",
    Ø: "O",
    æ: "ae",
    Æ: "AE",
    å: "a",
    Å: "A",
    ñ: "n",
    Ñ: "N",
    ç: "c",
    Ç: "C",
    á: "a",
    Á: "A",
    é: "e",
    É: "E",
    í: "i",
    Í: "I",
    ß: "ss",
    ẞ: "SS"
  };
  const mapped = value.replace(/[øØæÆåÅñÑçÇáÁéÉíÍßẞ]/g, (char) => map[char] || char);
  return mapped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

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

const getRankingsUpdatedDate = () =>
  formatUpdatedDate(siteMetadata?.rankingsUpdatedAt || siteMetadata?.dataUpdatedAt || siteMetadata?.lastUpdated);

const renderLastUpdatedNote = () => {
  if (!lastUpdatedNote) return;
  const updated = getRankingsUpdatedDate();
  lastUpdatedNote.textContent = updated
    ? `Last updated: ${updated}`
    : "Last updated unavailable";
};

const getPlayerProfileHref = (name) => {
  const slug = playerSlugMap.get(name);
  return slug ? `players/${slug}/` : "";
};

const getHeadToHeadHref = (playerName, opponentName) => {
  const playerSlug = playerSlugMap.get(playerName);
  const opponentSlug = playerSlugMap.get(opponentName);
  if (!playerSlug || !opponentSlug) return "";
  const [playerA, playerB] = [playerSlug, opponentSlug].sort((a, b) => a.localeCompare(b));
  return `head-to-head/${playerA}/vs/${playerB}/`;
};

const getCompareHref = (playerName, opponentName = "") => {
  const playerSlug = playerSlugMap.get(playerName);
  const opponentSlug = opponentName ? playerSlugMap.get(opponentName) : "";
  if (!playerSlug) return "";
  return `compare/?players=${[playerSlug, opponentSlug].filter(Boolean).map(encodeURIComponent).join(",")}`;
};

const renderPlayerLink = (name) => {
  const href = getPlayerProfileHref(name);
  return href
    ? `<a class="player-link" href="${href}">${escapeHtml(name)}</a>`
    : escapeHtml(name);
};

const renderHeadToHeadLink = (playerName, opponentName) => {
  const href = getHeadToHeadHref(playerName, opponentName);
  return href
    ? `<a class="head-to-head-inline-link" href="${href}" aria-label="View head-to-head record for ${escapeHtml(playerName)} and ${escapeHtml(opponentName)}">H2H</a>`
    : "";
};

const renderCompareLink = (playerName, opponentName = "", label = "Compare") => {
  const href = getCompareHref(playerName, opponentName);
  return href
    ? `<a class="head-to-head-inline-link compare-inline-link" href="${href}" aria-label="Compare full careers">${escapeHtml(label)}</a>`
    : "";
};

const getPlayerCountry = (player) => {
  const code = asText(player?.country || player?.countries?.[0]).toUpperCase();
  return code || "";
};

const buildProfileSearchIndex = (players, ratings) => {
  const ratingMap = new Map((Array.isArray(ratings) ? ratings : []).map((player) => [player.name, player]));
  profileSearchIndex = (Array.isArray(players) ? players : [])
    .map((player) => {
      const rating = ratingMap.get(player.name);
      const matches = rating?.matches ?? player.matchRows ?? 0;
      const country = getPlayerCountry(player);
      const summary = rating
        ? `Rating ${Math.round(rating.rating)} · ${matches} matches · ${rating.wins}-${rating.draws}-${rating.losses}`
        : matches
          ? `${matches} match rows`
          : "Profile available";
      return {
        name: player.name,
        normalizedName: normalize(player.name),
        href: getPlayerProfileHref(player.name),
        country,
        summary,
        rating: rating?.rating ?? 0,
        matches
      };
    })
    .filter((player) => player.name && player.href)
    .sort((a, b) => a.name.localeCompare(b.name));
};

const renderProfileSearchResults = (query) => {
  if (!profileSearchResults) return;
  const normalizedQuery = normalize(query || "");
  if (!normalizedQuery) {
    profileSearchResults.innerHTML = "";
    profileSearchResults.classList.remove("is-open");
    return;
  }

  const matches = profileSearchIndex
    .filter((player) => player.normalizedName.includes(normalizedQuery))
    .sort((a, b) => {
      const aStarts = a.normalizedName.startsWith(normalizedQuery) ? 1 : 0;
      const bStarts = b.normalizedName.startsWith(normalizedQuery) ? 1 : 0;
      return bStarts - aStarts || b.rating - a.rating || b.matches - a.matches || a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  profileSearchResults.classList.add("is-open");
  if (matches.length === 0) {
    profileSearchResults.innerHTML = `<div class="profile-finder__empty">No players found.</div>`;
    return;
  }

  profileSearchResults.innerHTML = matches
    .map((player) => {
      const flag = flagFromCountry(player.country);
      return `
        <a class="profile-finder__result" href="${player.href}">
          <span class="profile-finder__name">${flag ? `${flag} ` : ""}${escapeHtml(player.name)}</span>
          <span class="profile-finder__summary">${escapeHtml(player.summary)}</span>
        </a>
      `;
    })
    .join("");
};

const asText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const escapeHtml = (value) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeResult = (value) => {
  const result = asText(value).toLowerCase();
  if (["win", "loss", "halved", "not played"].includes(result)) return result;
  if (["draw", "tie", "tied", "half"].includes(result)) return "halved";
  return "";
};

const normalizeMatch = (match) => {
  if (!match || typeof match !== "object") return null;
  const player = asText(match.player);
  const opponent = asText(match.opponent);
  const year = asNumber(match.year, NaN);
  const result = normalizeResult(match.result);
  if (!player || !opponent || !Number.isFinite(year) || !result) return null;
  return {
    event: asText(match.event, "Unknown event"),
    year,
    round: asText(match.round, "Singles"),
    player,
    player_country: asText(match.player_country).toUpperCase(),
    opponent,
    opponent_country: asText(match.opponent_country).toUpperCase(),
    result,
    score: asText(match.score),
    points: asNumber(match.points, result === "win" ? 1 : result === "halved" ? 0.5 : 0),
    month: asText(match.month)
  };
};

const normalizeMatches = (data) => {
  const source = Array.isArray(data?.matches) ? data.matches : [];
  return source
    .map(normalizeMatch)
    .filter((match) => match && match.result !== "not played");
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

const countryNameFromCode = (code) => {
  code = asText(code).toUpperCase();
  if (!code) return "";
  const names = {
    US: "United States",
    GB: "Great Britain",
    AU: "Australia",
    NZ: "New Zealand",
    ZA: "South Africa",
    ZW: "Zimbabwe",
    AT: "Austria",
    BE: "Belgium",
    JP: "Japan",
    KR: "South Korea",
    MY: "Malaysia",
    BD: "Bangladesh",
    AR: "Argentina",
    ES: "Spain",
    DE: "Germany",
    DK: "Denmark",
    IE: "Ireland",
    CA: "Canada",
    FR: "France",
    SE: "Sweden",
    PY: "Paraguay",
    CO: "Colombia",
    MX: "Mexico",
    TW: "Taiwan",
    CN: "China",
    VE: "Venezuela",
    TH: "Thailand",
    IN: "India",
    CL: "Chile",
    FJ: "Fiji",
    PH: "Philippines",
    FI: "Finland",
    IT: "Italy",
    NL: "Netherlands",
    NO: "Norway",
    PL: "Poland",
    TT: "Trinidad and Tobago"
  };
  return names[code] || code;
};

const renderSummaryChips = (items, type) => {
  if (items.length === 0) return "";
  const maxVisible = 2;
  const visible = items.slice(0, maxVisible);
  const extra = items.length - visible.length;
  const chips = visible
    .map(
      (item) => `<span class="multi-pill" title="${escapeHtml(item)}">${escapeHtml(item)}</span>`
    )
    .join("");
  const more =
    extra > 0
      ? `<span class="multi-pill multi-pill--more" title="${escapeHtml(items.join(", "))}">+${extra}</span>`
      : "";
  return `
    <span class="multi-summary__chips">${chips}${more}</span>
    <button class="summary-clear" type="button" data-clear="${type}">×</button>
  `;
};

const renderSparkline = (values, className = "", label = "") => {
  values = Array.isArray(values) ? values.filter(Number.isFinite) : [];
  if (values.length < 2) return "";
  const tail = values.slice(-10);
  const slope = tail[tail.length - 1] - tail[0];
  const trendClass = slope > 1 ? "sparkline--up" : slope < -1 ? "sparkline--down" : "sparkline--flat";
  const width = 160;
  const height = 36;
  const padding = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - padding * 2) / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = padding + step * index;
      const y =
        height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return `
    <div class="sparkline ${className} ${trendClass}" aria-hidden="true" title="${label}">
      <svg viewBox="0 0 ${width} ${height}" role="img" focusable="false">
        <title>${label}</title>
        <polyline points="${points}" />
      </svg>
    </div>
  `;
};

const getRoundIndex = (round) => {
  const idx = ROUND_ORDER.indexOf(round);
  return idx === -1 ? ROUND_ORDER.length : idx;
};

const getEventIndex = (event) => {
  const idx = EVENT_ORDER.indexOf(event);
  return idx === -1 ? EVENT_ORDER.length : idx;
};

const getMonthIndex = (month) => {
  const idx = MONTH_ORDER.indexOf(month);
  return idx === -1 ? MONTH_ORDER.length : idx;
};

const uniqueMatches = (matches) => {
  const seen = new Set();
  const result = [];
  matches.forEach((match) => {
    if (!match?.player || !match?.opponent) return;
    const players = [match.player, match.opponent].sort().join(" vs ");
    const key = `${match.event}|${match.year}|${match.round}|${players}|${match.score}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(match);
  });
  return result;
};

const sortMatches = (matches) =>
  uniqueMatches(Array.isArray(matches) ? matches : [])
    .slice()
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const monthDiff = getMonthIndex(a.month) - getMonthIndex(b.month);
      if (monthDiff !== 0) return monthDiff;
      const eventDiff = getEventIndex(a.event) - getEventIndex(b.event);
      if (eventDiff !== 0) return eventDiff;
      const roundDiff = getRoundIndex(a.round) - getRoundIndex(b.round);
      if (roundDiff !== 0) return roundDiff;
      return asText(a.player).localeCompare(asText(b.player));
    });

const expectedScore = (rating, opponentRating) =>
  1 / (1 + Math.pow(10, (opponentRating - rating) / 400));

const normalizeScoreText = (value) =>
  (value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const parseMarginFromScore = (scoreText) => {
  const score = normalizeScoreText(scoreText);
  if (!score) return { margin: null, kind: "unknown" };
  if (score === "halved") return { margin: 0, kind: "halved" };
  if (MOV_NEUTRAL_SCORES.has(score)) return { margin: null, kind: "special" };

  if (/^\d+h$/.test(score)) {
    return { margin: 1, kind: "playoff_holes" };
  }

  const andMatch = score.match(/^(\d+)\s*(?:&|and)\s*(\d+)$/);
  if (andMatch) {
    return { margin: Number(andMatch[1]), kind: "and" };
  }

  const andUpMatch = score.match(/^(\d+)\s+and\s+up$/);
  if (andUpMatch) {
    return { margin: Number(andUpMatch[1]), kind: "up" };
  }

  const upMatch = score.match(/^(\d+)\s*-?\s*up(?:\s*\(\d+\))?$/);
  if (upMatch) {
    return { margin: Number(upMatch[1]), kind: "up" };
  }

  return { margin: null, kind: "unknown" };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const computeMovMultiplier = (result, scoreText, playerRating, opponentRating) => {
  if (result === "halved") return 1;

  const parsed = parseMarginFromScore(scoreText);
  if (!Number.isFinite(parsed.margin) || parsed.margin <= 0) {
    return 1;
  }

  const margin = clamp(parsed.margin, 1, MOV_MARGIN_CAP);
  const winnerRating = result === "win" ? playerRating : opponentRating;
  const loserRating = result === "win" ? opponentRating : playerRating;
  const winnerDelta = winnerRating - loserRating;
  const rawMultiplier = Math.log(margin + 1) * (2.2 / (winnerDelta * 0.001 + 2.2));

  if (!Number.isFinite(rawMultiplier) || rawMultiplier <= 0) {
    return 1;
  }
  return clamp(rawMultiplier, MOV_MULTIPLIER_MIN, MOV_MULTIPLIER_MAX);
};

const getCalibrationBin = (delta) => Math.round(delta / CALIBRATION_BIN) * CALIBRATION_BIN;

const initCalibration = () => ({
  bins: new Map(),
  total: 0
});

const recordCalibration = (calibration, delta, result) => {
  if (!calibration) return;
  const bin = getCalibrationBin(delta);
  if (!calibration.bins.has(bin)) {
    calibration.bins.set(bin, { wins: 0, draws: 0, losses: 0, total: 0 });
  }
  const bucket = calibration.bins.get(bin);
  if (result === "win") bucket.wins += 1;
  else if (result === "loss") bucket.losses += 1;
  else bucket.draws += 1;
  bucket.total += 1;
  calibration.total += 1;
};

const finalizeCalibration = (calibration) => {
  if (!calibration) return null;
  const bins = {};
  calibration.bins.forEach((bucket, bin) => {
    const total = bucket.total + CALIBRATION_PRIOR * 3;
    bins[bin] = {
      wins: (bucket.wins + CALIBRATION_PRIOR) / total,
      draws: (bucket.draws + CALIBRATION_PRIOR) / total,
      losses: (bucket.losses + CALIBRATION_PRIOR) / total,
      total: bucket.total
    };
  });
  return { bins, total: calibration.total };
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const getOutcomeProbabilityFromRatings = (rating, opponentRating) => {
  const delta = rating - opponentRating;
  const baseWin = expectedScore(rating, opponentRating);
  const baseLoss = 1 - baseWin;
  if (!outcomeCalibration) {
    return { win: baseWin, draw: 0, loss: baseLoss, source: "elo" };
  }
  const bin = getCalibrationBin(delta);
  const bucket = outcomeCalibration.bins[String(bin)];
  if (!bucket || bucket.total < CALIBRATION_MIN_MATCHES) {
    return { win: baseWin, draw: 0, loss: baseLoss, source: "elo" };
  }
  const win = clamp01(bucket.wins);
  const draw = clamp01(bucket.draws);
  const loss = clamp01(1 - win - draw);
  return { win, draw, loss, source: "calibrated", bin };
};

const kFactor = (matchesPlayed) => {
  if (matchesPlayed < 10) return 40;
  if (matchesPlayed < 30) return 30;
  return 20;
};

const applyYearDecay = (ratings) => {
  ratings.forEach((entry) => {
    entry.rating = BASE_RATING + (entry.rating - BASE_RATING) * YEAR_DECAY;
  });
};

const ensurePlayer = (ratings, name, country) => {
  name = asText(name);
  if (!name) return null;
  if (!ratings.has(name)) {
    ratings.set(name, {
      name,
      country: country || "",
      rating: BASE_RATING,
      peak: BASE_RATING,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      lastYear: null,
      matchList: [],
      history: []
    });
  } else if (country && !ratings.get(name).country) {
    ratings.get(name).country = country;
  }
  return ratings.get(name);
};

const addMatchToPlayer = (player, match, opponent, result, delta) => {
  if (!player || !match) return;
  player.matchList.push({
    event: match.event,
    year: match.year,
    round: match.round,
    opponent,
    result,
    score: match.score,
    delta
  });
};

const computeRatings = (matches) => {
  const ordered = sortMatches(matches);
  const ratings = new Map();
  const calibration = initCalibration();
  let currentYear = null;

  ordered.forEach((match) => {
    if (!match.player || !match.opponent) return;
    if (currentYear === null) currentYear = match.year;
    if (match.year !== currentYear) {
      applyYearDecay(ratings);
      currentYear = match.year;
    }

    const player = ensurePlayer(ratings, match.player, match.player_country);
    const opponent = ensurePlayer(ratings, match.opponent, match.opponent_country);
    if (!player || !opponent) return;

    const playerExpected = expectedScore(player.rating, opponent.rating);
    const opponentExpected = expectedScore(opponent.rating, player.rating);

    let score = 0.5;
    if (match.result === "win") score = 1;
    if (match.result === "loss") score = 0;

    const playerK = kFactor(player.matches);
    const opponentK = kFactor(opponent.matches);

    const playerBefore = player.rating;
    const opponentBefore = opponent.rating;
    recordCalibration(calibration, player.rating - opponent.rating, match.result);
    const movMultiplier = computeMovMultiplier(match.result, match.score, player.rating, opponent.rating);

    player.rating = player.rating + playerK * movMultiplier * (score - playerExpected);
    opponent.rating = opponent.rating + opponentK * movMultiplier * ((1 - score) - opponentExpected);

    player.matches += 1;
    opponent.matches += 1;
    player.lastYear = match.year;
    opponent.lastYear = match.year;

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
    player.history.push(player.rating);
    opponent.history.push(opponent.rating);

    const opponentResult =
      match.result === "win" ? "loss" : match.result === "loss" ? "win" : "halved";
    const playerDelta = player.rating - playerBefore;
    const opponentDelta = opponent.rating - opponentBefore;
    addMatchToPlayer(player, match, match.opponent, match.result, playerDelta);
    addMatchToPlayer(opponent, match, match.player, opponentResult, opponentDelta);
  });

  outcomeCalibration = finalizeCalibration(calibration);
  if (typeof window !== "undefined") {
    window.matchplayOutcomeCalibration = outcomeCalibration;
    window.getOutcomeProbabilityFromRatings = getOutcomeProbabilityFromRatings;
  }
  return Array.from(ratings.values()).filter((player) => player.matches > 0 && Number.isFinite(player.rating));
};

const buildRatingsCacheKey = () => {
  return "all-matches";
};

const getMatchesForRatings = () => {
  return allMatches;
};

const getCachedRatings = () => {
  const key = buildRatingsCacheKey();
  if (ratingsCache.has(key)) {
    return ratingsCache.get(key);
  }
  const ratings = computeRatings(getMatchesForRatings());
  ratingsCache.set(key, ratings);

  if (ratingsCache.size > 64) {
    const oldestKey = ratingsCache.keys().next().value;
    ratingsCache.delete(oldestKey);
  }

  return ratings;
};

const formatDelta = (delta) => {
  const value = Math.round(delta);
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "0";
};

const getDisplayMatchList = (player) => {
  const matchList = Array.isArray(player?.matchList) ? player.matchList : [];
  if (selectedEvents.size === 0) return matchList;
  return matchList.filter((match) => selectedEvents.has(match.event));
};

const withDisplayStats = (player) => {
  const displayMatchList = getDisplayMatchList(player);
  let displayWins = 0;
  let displayDraws = 0;
  let displayLosses = 0;
  displayMatchList.forEach((match) => {
    if (match.result === "win") displayWins += 1;
    else if (match.result === "halved") displayDraws += 1;
    else if (match.result === "loss") displayLosses += 1;
  });
  return {
    ...player,
    displayMatchList,
    displayMatches: displayMatchList.length,
    displayWins,
    displayDraws,
    displayLosses
  };
};

const renderPlayerDetailContent = (player) => {
  const flag = flagFromCountry(player.country);
  const matches = (player.displayMatchList || player.matchList)
    .slice()
    .sort((a, b) => b.year - a.year)
    .map((match) => {
      const label = match.result === "halved" ? "Draw" : match.result.toUpperCase();
      const resultClass =
        match.result === "win"
          ? "result-win"
          : match.result === "loss"
            ? "result-loss"
            : "result-halved";
      const deltaValue = formatDelta(match.delta || 0);
      const deltaClass =
        deltaValue.startsWith("+") ? "rating-delta--pos" : deltaValue.startsWith("-") ? "rating-delta--neg" : "rating-delta--even";
      return `
        <div class="match-row ${resultClass}">
          <div>
            <strong>${escapeHtml(match.event)} ${escapeHtml(match.year)}</strong> — ${renderPlayerLink(match.opponent)}
            <div class="meta">${escapeHtml(match.round || "Singles")} ${renderHeadToHeadLink(player.name, match.opponent)}</div>
          </div>
          <div>
            <span class="rating-delta ${deltaClass}">${deltaValue}</span>
            <div class="match-result">${label}</div>
            <span class="meta">${escapeHtml(match.score || "")}</span>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="player-detail">
      <h3>${flag ? `${flag} ` : ""}${escapeHtml(player.name)}</h3>
      <div class="detail-meta">${player.displayMatches ?? player.matches} matches • ${player.displayWins ?? player.wins}-${player.displayDraws ?? player.draws}-${player.displayLosses ?? player.losses}</div>
      <div class="detail-actions">${renderCompareLink(player.name, "", "Compare this player")}</div>
      <div class="match-list">${matches || "<p class=\"muted\">No matches yet.</p>"}</div>
    </div>
  `;
};

const renderPlayerDetail = (player, row) => {
  const existingDetail = row.nextElementSibling;
  if (existingDetail && existingDetail.classList.contains("detail-row")) {
    existingDetail.remove();
    row.classList.remove("is-open");
    return;
  }

  document.querySelectorAll(".detail-row").forEach((node) => node.remove());
  document.querySelectorAll("tr.is-open").forEach((node) => node.classList.remove("is-open"));

  const detailRow = document.createElement("tr");
  detailRow.className = "detail-row";
  const cell = document.createElement("td");
  cell.colSpan = 6;
  cell.innerHTML = renderPlayerDetailContent(player);
  detailRow.append(cell);
  row.after(detailRow);
  row.classList.add("is-open");
};

const renderTable = (players) => {
  if (!ratingBody) return;
  ratingBody.innerHTML = "";
  players = Array.isArray(players) ? players.filter(Boolean) : [];

  if (players.length === 0) {
    setRatingTableState("No players match the current filters.");
    return;
  }

  players.forEach((player) => {
    const row = document.createElement("tr");
    row.dataset.player = player.name;
    const flag = flagFromCountry(player.country);
    const rating = Number.isFinite(player.rating) ? Math.round(player.rating) : "—";
    const peak = Number.isFinite(player.peak) ? Math.round(player.peak) : "—";
    const profileHref = getPlayerProfileHref(player.name);
    const playerNameHtml = profileHref
      ? `<a class="player-link" href="${profileHref}">${escapeHtml(player.name)}</a>`
      : escapeHtml(player.name);
    row.innerHTML = `
      <td>${player.rank || "—"}</td>
      <td>${playerNameHtml}${flag ? ` <span class="flag">${flag}</span>` : ""}</td>
      <td>${rating}</td>
      <td>${player.displayMatches ?? player.matches}</td>
      <td>${player.displayWins ?? player.wins}-${player.displayDraws ?? player.draws}-${player.displayLosses ?? player.losses}</td>
      <td title="Peak rating: ${peak}">
        <div class="trend-cell">
          ${renderSparkline(player.history, "trend-sparkline", `Peak rating: ${peak}`)}
        </div>
      </td>
    `;
    const profileLink = row.querySelector(".player-link");
    if (profileLink) {
      profileLink.addEventListener("click", (event) => event.stopPropagation());
    }
    row.addEventListener("click", () => renderPlayerDetail(player, row));
    ratingBody.append(row);
  });
};

const sortPlayers = (players) => {
  const sorted = (Array.isArray(players) ? players : []).slice().sort((a, b) => {
    const dir = currentSort.direction === "asc" ? 1 : -1;
    if (currentSort.key === "name") return asText(a.name).localeCompare(asText(b.name)) * dir;
    if (currentSort.key === "matches") {
      return ((a.displayMatches ?? a.matches) - (b.displayMatches ?? b.matches)) * dir;
    }
    if (currentSort.key === "trend") return (asNumber(a.peak) - asNumber(b.peak)) * dir;
    if (currentSort.key === "wdl") {
      const aRecord = (a.displayWins ?? a.wins) * 3 + (a.displayDraws ?? a.draws);
      const bRecord = (b.displayWins ?? b.wins) * 3 + (b.displayDraws ?? b.draws);
      return (aRecord - bRecord) * dir;
    }
    if (currentSort.key === "rank") return (asNumber(a.rank) - asNumber(b.rank)) * dir;
    return (asNumber(a.rating) - asNumber(b.rating)) * dir;
  });
  return sorted;
};

const updateSortIndicators = () => {
  tableHeaders.forEach((th) => {
    th.classList.remove("is-sorted", "is-sorted-asc", "is-sorted-desc");
    const isCurrentSort = th.dataset.sort === currentSort.key;
    th.setAttribute(
      "aria-sort",
      isCurrentSort ? (currentSort.direction === "asc" ? "ascending" : "descending") : "none"
    );
    if (isCurrentSort) {
      th.classList.add("is-sorted");
      th.classList.add(currentSort.direction === "asc" ? "is-sorted-asc" : "is-sorted-desc");
    }
  });
};

const updateEventSummary = () => {
  if (!eventSummary) return;
  if (selectedEvents.size === 0) {
    eventSummary.textContent = "All events";
    return;
  }
  const list = Array.from(selectedEvents);
  eventSummary.innerHTML = renderSummaryChips(list, "event");
};

const syncEventCheckboxes = () => {
  if (!eventFilter || !eventSelectAll) return;
  eventFilter.querySelectorAll("input[type=\"checkbox\"]").forEach((cb) => {
    if (cb === eventSelectAll) return;
    cb.checked = selectedEvents.has(cb.value);
  });
  eventSelectAll.checked = selectedEvents.size > 0 && selectedEvents.size === allEvents.length;
};


const updateCountrySummary = () => {
  if (!countrySummary) return;
  if (selectedCountries.size === 0) {
    countrySummary.textContent = "All nationalities";
    return;
  }
  const list = Array.from(selectedCountries).map((code) => {
    const flag = flagFromCountry(code);
    const name = countryNameFromCode(code);
    return `${flag ? `${flag} ` : ""}${name}`;
  });
  countrySummary.innerHTML = renderSummaryChips(list, "country");
};

const syncCountryCheckboxes = () => {
  if (!countryFilter || !countrySelectAll) return;
  countryFilter.querySelectorAll("input[type=\"checkbox\"]").forEach((cb) => {
    if (cb === countrySelectAll) return;
    cb.checked = selectedCountries.has(cb.value);
  });
  countrySelectAll.checked =
    selectedCountries.size > 0 && selectedCountries.size === allCountries.length;
};

const renderFilterChips = () => {
  if (!filterChips) return;
  filterChips.innerHTML = "";

  const chips = [];

  selectedEvents.forEach((event) => {
    chips.push({ type: "event", label: event, value: event });
  });

  selectedCountries.forEach((code) => {
    const flag = flagFromCountry(code);
    const name = countryNameFromCode(code);
    chips.push({ type: "country", label: `${flag ? `${flag} ` : ""}${name}`, value: code });
  });

  if (chips.length === 0) {
    filterChips.style.display = "none";
    if (clearAllFilters) clearAllFilters.style.display = "none";
    return;
  }

  filterChips.style.display = "flex";
  if (clearAllFilters) clearAllFilters.style.display = "inline-flex";
  chips.forEach((chip) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    button.innerHTML = `<span>${escapeHtml(chip.label)}</span><span class="filter-chip__close">×</span>`;
    button.addEventListener("click", () => {
      if (chip.type === "event") {
        selectedEvents.delete(chip.value);
        updateEventSummary();
        syncEventCheckboxes();
      }
      if (chip.type === "country") {
        selectedCountries.delete(chip.value);
        updateCountrySummary();
        syncCountryCheckboxes();
      }
      applyFilters();
    });
    filterChips.append(button);
  });
};

const renderPlayerChips = () => {
  if (!playerChips) return;
  playerChips.innerHTML = "";
  selectedPlayers.forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "player-chip";
    chip.innerHTML = `<span>${escapeHtml(name)}</span><button type="button" aria-label="Remove ${escapeHtml(name)}">×</button>`;
    chip.querySelector("button").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectedPlayers.delete(name);
      renderPlayerChips();
      applyFilters();
    });
    playerChips.append(chip);
  });
};

const showPlayerSuggestions = (query) => {
  if (!playerSuggestions) return;
  const source = (availablePlayers.length ? availablePlayers : allPlayers).filter(Boolean);
  if (!query) {
    playerSuggestions.classList.remove("is-open");
    playerSuggestions.innerHTML = "";
    return;
  }
  const matches = source
    .filter((name) => normalize(name).includes(query))
    .filter((name) => !selectedPlayers.has(name))
    .slice(0, 8);
  if (matches.length === 0) {
    playerSuggestions.classList.remove("is-open");
    playerSuggestions.innerHTML = "";
    return;
  }
  playerSuggestions.innerHTML = matches
    .map((name) => `<div class="player-suggestion" data-name="${escapeHtml(name)}">${escapeHtml(name)}</div>`)
    .join("");
  playerSuggestions.classList.add("is-open");
};

const addPlayerSelection = (name) => {
  if (!name) return;
  selectedPlayers.add(name);
  renderPlayerChips();
  if (searchInput) searchInput.value = "";
  showPlayerSuggestions("");
  applyFilters();
};

const applyFilters = () => {
  try {
    const minMatches = asNumber(minMatchesInput?.value, 1);
    const ratings = getCachedRatings();
    const currentYear = new Date().getFullYear();
    const activeCutoff = currentYear - 5;

    if (!ratings.length) {
      if (summary) summary.textContent = "No ratings available";
      updateLeaderCard(null, "empty");
      renderFilterChips();
      renderPlayerChips();
      setRatingTableState("No ratings are available yet.");
      return;
    }

    const eventScopedPlayers = ratings.map(withDisplayStats);
    const filteredPlayers = eventScopedPlayers.filter((player) => {
      if (selectedEvents.size > 0 && player.displayMatches === 0) {
        return false;
      }
      if (selectedCountries.size > 0 && !selectedCountries.has(player.country)) {
        return false;
      }
      return activeOnlyToggle && activeOnlyToggle.checked ? player.lastYear >= activeCutoff : true;
    });

    const minFiltered = filteredPlayers.filter(
      (player) => (player.displayMatches ?? player.matches) >= minMatches
    );
    const baseRanked = minFiltered
      .slice()
      .sort((a, b) => asNumber(b.rating) - asNumber(a.rating))
      .map((player, index) => ({ ...player, rank: index + 1 }));

    const sorted = sortPlayers(baseRanked);
    availablePlayers = baseRanked.map((player) => player.name).filter(Boolean);
    const searched =
      selectedPlayers.size > 0
        ? sorted.filter((player) => selectedPlayers.has(player.name))
        : sorted;

    currentPlayers = searched;
    if (summary) summary.textContent = `${searched.length} players`;
    updateLeaderCard(baseRanked[0] || searched[0] || null);
    renderFilterChips();
    renderPlayerChips();
    renderTable(searched);
    updateSortIndicators();

    document.querySelectorAll(".detail-row").forEach((node) => node.remove());
    document.querySelectorAll("tr.is-open").forEach((node) => node.classList.remove("is-open"));
  } catch (error) {
    console.warn("Unable to render ratings", error);
    if (summary) summary.textContent = "Ratings unavailable";
    updateLeaderCard(null, "error");
    setRatingTableState("Unable to calculate ratings from the available data.", true);
  }
};

const setRatingTableState = (message, isError = false) => {
  if (!ratingBody) return;
  ratingBody.innerHTML = `
    <tr class="state-row ${isError ? "state-row--error" : ""}">
      <td colspan="6">${message}</td>
    </tr>
  `;
};

const updateLeaderCard = (player, state = "") => {
  if (!ratingLeaderName || !ratingLeaderRating || !ratingLeaderMeta || !ratingLeaderStats) return;
  if (!player) {
    ratingLeaderName.textContent =
      state === "error"
        ? "Ratings unavailable"
        : state === "loading"
          ? DEFAULT_LEADER_COPY.name
          : "No player found";
    ratingLeaderRating.textContent = DEFAULT_LEADER_COPY.rating;
    ratingLeaderMeta.textContent =
      state === "error"
        ? "Unable to load ranking data. Please refresh or try again later."
        : state === "loading"
          ? DEFAULT_LEADER_COPY.meta
          : "Try adjusting the filters.";
    ratingLeaderStats.innerHTML =
      state === "error"
        ? "<span>Data unavailable</span><span>Page content preserved</span>"
        : DEFAULT_LEADER_COPY.stats.map((stat) => `<span>${stat}</span>`).join("");
    return;
  }

  const matches = asNumber(player.matches);
  const wins = asNumber(player.wins);
  const draws = asNumber(player.draws);
  const losses = asNumber(player.losses);
  const rating = Number.isFinite(player.rating) ? Math.round(player.rating) : "—";
  const peak = Number.isFinite(player.peak) ? Math.round(player.peak) : "—";
  const pointsPerMatch = matches > 0 ? (wins + draws * 0.5) / matches : 0;
  const leaderName = asText(player.name, "Top rated player");
  const leaderHref = getPlayerProfileHref(leaderName);
  ratingLeaderName.innerHTML = leaderHref
    ? `<a class="player-link" href="${leaderHref}">${escapeHtml(leaderName)}</a>`
    : escapeHtml(leaderName);
  ratingLeaderRating.textContent = `Rating ${rating}`;
  ratingLeaderMeta.textContent = `${matches} matches · ${wins}-${draws}-${losses} W-D-L`;
  ratingLeaderStats.innerHTML = `
    <span>Peak ${peak}</span>
    <span>PPM ${pointsPerMatch.toFixed(2)}</span>
    ${getRankingsUpdatedDate() ? `<span>Updated ${getRankingsUpdatedDate()}</span>` : ""}
  `;
};

const populateFilters = () => {
  if (!eventFilter || !countryFilter) return;
  const events = Array.from(new Set(allMatches.map((match) => match.event))).sort();
  allEvents = events.slice();
  eventFilter.innerHTML = "";
  events.forEach((event) => {
    const id = `event-${normalize(event)}`;
    const item = document.createElement("label");
    item.className = "country-filter__item";
    item.innerHTML = `
      <input type="checkbox" value="${event}" id="${id}" />
      <span class="country-filter__text">${event}</span>
    `;
    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedEvents.add(event);
      } else {
        selectedEvents.delete(event);
      }
      updateEventSummary();
      syncEventCheckboxes();
      applyFilters();
    });
    eventFilter.append(item);
  });
  updateEventSummary();

  const countries = Array.from(new Set(allMatches.map((match) => match.player_country))).sort();
  const sticky = ["US", "GB"].filter((code) => countries.includes(code));
  const remaining = countries.filter((code) => !sticky.includes(code));
  const orderedCountries = [...sticky, ...remaining];
  allCountries = orderedCountries.slice();

  countryFilter.innerHTML = "";
  orderedCountries.forEach((code) => {
    const id = `country-${code}`;
    const item = document.createElement("label");
    item.className = "country-filter__item";
    const flag = flagFromCountry(code);
    const name = countryNameFromCode(code);
    item.innerHTML = `
      <input type="checkbox" value="${code}" id="${id}" />
      <span class="country-filter__text">${flag ? `${flag} ` : ""}${name}</span>
    `;
    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedCountries.add(code);
      } else {
        selectedCountries.delete(code);
      }
      updateCountrySummary();
      syncCountryCheckboxes();
      applyFilters();
    });
    countryFilter.append(item);
  });
  updateCountrySummary();

  if (allMatches.length > 0 && minMatchesInput) {
    const matchCountMap = new Map();
    allMatches.forEach((match) => {
      matchCountMap.set(match.player, (matchCountMap.get(match.player) || 0) + 1);
    });
    const matchCounts = Array.from(matchCountMap.values());
    const maxMatches = Math.max(...matchCounts, 1);
    minMatchesInput.max = String(maxMatches);
  }
};

const handleSort = (key) => {
  if (!key) return;
  if (currentSort.key === key) {
    currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
  } else {
    currentSort = { key, direction: "desc" };
  }
  const sorted = sortPlayers(currentPlayers);
  renderTable(sorted);
  updateSortIndicators();
};

setRatingTableState("Loading ratings...");
updateLeaderCard(null, "loading");

Promise.all([
  fetch("data.json").then((res) => {
    if (!res.ok) throw new Error("Unable to load ratings data");
    return res.json();
  }),
  fetch("players-data.json")
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null),
  fetch("site-data.json")
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
])
  .then(([data, playersData, metadata]) => {
    siteMetadata = metadata && typeof metadata === "object" ? metadata : null;
    const indexedPlayers = playersData?.players || [];
    playerSlugMap = new Map(indexedPlayers.map((player) => [player.name, player.slug]));
    renderLastUpdatedNote();
    allMatches = normalizeMatches(data);
    if (allMatches.length === 0) {
      throw new Error("Ratings data did not include any playable matches");
    }
    allPlayers = Array.from(new Set(allMatches.map((match) => match.player).filter(Boolean))).sort();
    ratingsCache = new Map();
    buildProfileSearchIndex(indexedPlayers, computeRatings(allMatches));
    populateFilters();
    applyFilters();
    updateSortIndicators();
  })
  .catch((error) => {
    if (summary) summary.textContent = "Ratings unavailable";
    renderLastUpdatedNote();
    updateLeaderCard(null, "error");
    setRatingTableState(error.message || "Unable to load ratings data.", true);
  });

const toggleFilters = (open) => {
  const isOpen = Boolean(open);
  document.body.classList.toggle("filters-open", isOpen);
  [mobileFilterToggle, mobileFilterToggleBar].forEach((btn) => {
    if (!btn) return;
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
};

const openFilters = () => toggleFilters(true);
const closeFilters = () => toggleFilters(false);

[mobileFilterToggle, mobileFilterToggleBar].forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("click", () => openFilters());
});

if (controlsPanelClose) {
  controlsPanelClose.addEventListener("click", () => closeFilters());
}

if (mobileFilterOverlay) {
  mobileFilterOverlay.addEventListener("click", () => closeFilters());
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFilters();
});

const handleMobileFilterBar = () => {
  if (!mobileFilterBar) return;
  if (window.scrollY > 240) {
    mobileFilterBar.classList.add("is-visible");
  } else {
    mobileFilterBar.classList.remove("is-visible");
  }
};

window.addEventListener("scroll", handleMobileFilterBar);
window.addEventListener("load", handleMobileFilterBar);

[eventDropdown, countryDropdown].forEach((dropdown) => {
  if (!dropdown) return;
  dropdown.addEventListener("toggle", () => {
    if (dropdown.open) {
      if (dropdown === eventDropdown) {
        syncEventCheckboxes();
        if (eventSearch) eventSearch.value = "";
        eventFilter?.querySelectorAll(".country-filter__item").forEach((item) => {
          item.classList.remove("is-hidden");
        });
      }
      if (dropdown === countryDropdown) {
        syncCountryCheckboxes();
        if (countrySearch) countrySearch.value = "";
        countryFilter?.querySelectorAll(".country-filter__item").forEach((item) => {
          item.classList.remove("is-hidden");
        });
      }
    }
  });
});

if (eventSearch && eventFilter) eventSearch.addEventListener("input", () => {
  const query = normalize(eventSearch.value.trim());
  eventFilter.querySelectorAll(".country-filter__item").forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.classList.toggle("is-hidden", query && !text.includes(query));
  });
});

if (eventSelectAll) eventSelectAll.addEventListener("change", () => {
  if (eventSelectAll.checked) {
    selectedEvents = new Set(allEvents);
  } else {
    selectedEvents = new Set();
  }
  syncEventCheckboxes();
  updateEventSummary();
  applyFilters();
});

if (countrySearch && countryFilter) countrySearch.addEventListener("input", () => {
  const query = normalize(countrySearch.value.trim());
  countryFilter.querySelectorAll(".country-filter__item").forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.classList.toggle("is-hidden", query && !text.includes(query));
  });
});

if (countrySelectAll) countrySelectAll.addEventListener("change", () => {
  if (countrySelectAll.checked) {
    selectedCountries = new Set(allCountries);
  } else {
    selectedCountries = new Set();
  }
  syncCountryCheckboxes();
  updateCountrySummary();
  applyFilters();
});

const bindSummaryClear = (summaryEl, onClear) => {
  if (!summaryEl) return;
  summaryEl.addEventListener("click", (event) => {
    const target = event.target.closest(".summary-clear");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    onClear();
  });
};

bindSummaryClear(eventSummary, () => {
  selectedEvents = new Set();
  syncEventCheckboxes();
  updateEventSummary();
  applyFilters();
});

bindSummaryClear(countrySummary, () => {
  selectedCountries = new Set();
  syncCountryCheckboxes();
  updateCountrySummary();
  applyFilters();
});

if (searchInput) {
  searchInput.addEventListener("input", () => {
    showPlayerSuggestions(normalize(searchInput.value.trim()));
  });

  searchInput.addEventListener("focus", () => {
    const query = normalize(searchInput.value.trim());
    showPlayerSuggestions(query);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = normalize(searchInput.value.trim());
    const exact = availablePlayers.find((name) => normalize(name) === query);
    if (exact) {
      addPlayerSelection(exact);
    }
  });
}

const handlePlayerSuggestionPick = (event) => {
  if (!playerSuggestions?.classList.contains("is-open")) return;
    const target = event.target.closest(".player-suggestion");
    if (!target) return;
    event.preventDefault();
    addPlayerSelection(target.dataset.name);
};

if (playerSuggestions) {
  playerSuggestions.addEventListener("click", handlePlayerSuggestionPick);
}

document.addEventListener("click", (event) => {
  if (!playerSuggestions) return;
  if (event.target.closest(".player-search")) return;
  playerSuggestions.classList.remove("is-open");
});

if (profileSearchInput) {
  profileSearchInput.addEventListener("input", () => {
    renderProfileSearchResults(profileSearchInput.value);
  });

  profileSearchInput.addEventListener("focus", () => {
    renderProfileSearchResults(profileSearchInput.value);
  });

  profileSearchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const firstResult = profileSearchResults?.querySelector(".profile-finder__result");
    if (!firstResult) return;
    event.preventDefault();
    firstResult.click();
  });
}

document.addEventListener("click", (event) => {
  if (!profileSearchResults) return;
  if (event.target.closest(".profile-finder__search")) return;
  profileSearchResults.classList.remove("is-open");
});

if (minMatchesInput) {
  minMatchesInput.addEventListener("input", () => {
    minMatchesValue.textContent = `${minMatchesInput.value}+`;
    applyFilters();
  });
}

if (activeOnlyToggle) {
  activeOnlyToggle.addEventListener("change", applyFilters);
}

  if (clearAllFilters) {
    clearAllFilters.addEventListener("click", () => {
      selectedEvents = new Set();
      selectedCountries = new Set();
      selectedPlayers = new Set();
      updateEventSummary();
      updateCountrySummary();
      syncEventCheckboxes();
      syncCountryCheckboxes();
      renderPlayerChips();
      applyFilters();
    });
  }

tableHeaders.forEach((th) => {
  th.tabIndex = 0;
  th.setAttribute("role", "button");
  th.addEventListener("click", () => handleSort(th.dataset.sort));
  th.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSort(th.dataset.sort);
  });
});

const closeDropdownsOnClickOutside = (event) => {
  [eventDropdown, countryDropdown].forEach((dropdown) => {
    if (!dropdown) return;
    if (!dropdown.open) return;
    if (dropdown.contains(event.target)) return;
    dropdown.open = false;
  });
};

document.addEventListener("click", closeDropdownsOnClickOutside);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  [eventDropdown, countryDropdown].forEach((dropdown) => {
    if (!dropdown) return;
    dropdown.open = false;
  });
});

const navToggle = document.querySelector(".site-nav__toggle");
const navLinks = document.getElementById("siteNavLinks");
const navBackdrop = document.getElementById("siteNavBackdrop");

const closeNav = () => {
  if (!navLinks || !navToggle || !navBackdrop) return;
  navLinks.classList.remove("is-open");
  navBackdrop.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open navigation");
  document.querySelectorAll(".site-nav__dropdown[open]").forEach((dropdown) => {
    dropdown.removeAttribute("open");
  });
};

if (navToggle && navLinks && navBackdrop) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navBackdrop.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  });

  navBackdrop.addEventListener("click", closeNav);
  navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) closeNav();
  });
}
