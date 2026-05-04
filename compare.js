const compareRoot = document.getElementById("compareRoot");
const playerAInput = document.getElementById("comparePlayerA");
const playerBInput = document.getElementById("comparePlayerB");
const playerOptions = document.getElementById("comparePlayerOptions");

const CompareStats = globalThis.MatchplayStats;

if (!CompareStats) {
  throw new Error("Player statistics helpers failed to load.");
}

const {
  asText,
  buildHeadToHeadMatches,
  buildPlayerProfileStats,
  calculateHeadToHeadRecord,
  formatMatchDate,
  getRecordRates
} = CompareStats;

let players = [];
let matches = [];
let playerBySlug = new Map();
let selectedSlugs = ["", ""];

const POPULAR_COMPARISONS = [
  ["tiger-woods", "rory-mcilroy"],
  ["ian-poulter", "sergio-garcia"],
  ["scottie-scheffler", "jon-rahm"],
  ["seve-ballesteros", "nick-faldo"]
];

const escapeHtml = (value) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatNumber = (value, digits = 0, fallback = "—") =>
  Number.isFinite(value) ? value.toFixed(digits) : fallback;

const formatPercentage = (value) => (Number.isFinite(value) ? `${Math.round(value)}%` : "—");

const formatPoints = (value) => {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(Number.isInteger(value) ? 0 : 1);
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

const getProfileHref = (player) => `/players/${encodeURIComponent(player.slug)}/`;

const getCanonicalHeadToHeadHref = (playerA, playerB) => {
  if (!playerA?.slug || !playerB?.slug) return "";
  const [slugA, slugB] = [playerA.slug, playerB.slug].sort((a, b) => a.localeCompare(b));
  return `/head-to-head/${slugA}/vs/${slugB}/`;
};

const getCompareUrl = (slugA, slugB = "") =>
  `/compare/?players=${[slugA, slugB].filter(Boolean).map(encodeURIComponent).join(",")}`;

const getPlayerLabel = (player) =>
  `${player.name}${player.country ? ` (${player.country.toUpperCase()})` : ""}`;

const findPlayerFromInput = (value) => {
  const text = asText(value).toLowerCase();
  if (!text) return null;
  return (
    players.find((player) => player.slug === text) ||
    players.find((player) => player.name.toLowerCase() === text) ||
    players.find((player) => getPlayerLabel(player).toLowerCase() === text) ||
    null
  );
};

const getEventRecord = (profileStats, eventName) =>
  (profileStats.eventRecords || []).find((record) => record.event === eventName) || null;

const formatRecord = (record) => {
  if (!record || !record.matches) return "—";
  return `${record.wins}-${record.draws}-${record.losses}`;
};

const getMetricRows = (playerAStats, playerBStats) => {
  const aRecord = playerAStats.record;
  const bRecord = playerBStats.record;
  const aRyder = getEventRecord(playerAStats, "Ryder Cup");
  const bRyder = getEventRecord(playerBStats, "Ryder Cup");
  const aPresidents = getEventRecord(playerAStats, "Presidents Cup");
  const bPresidents = getEventRecord(playerBStats, "Presidents Cup");
  const aWgc = getEventRecord(playerAStats, "WGC / Dell Match Play");
  const bWgc = getEventRecord(playerBStats, "WGC / Dell Match Play");

  return [
    ["Current Elo", playerAStats.currentRating ? Math.round(playerAStats.currentRating) : "—", playerBStats.currentRating ? Math.round(playerBStats.currentRating) : "—"],
    ["Peak Elo", playerAStats.peakRating ? Math.round(playerAStats.peakRating) : "—", playerBStats.peakRating ? Math.round(playerBStats.peakRating) : "—"],
    ["Matches played", aRecord.matches, bRecord.matches],
    ["Wins", aRecord.wins, bRecord.wins],
    ["Draws / halves", aRecord.draws, bRecord.draws],
    ["Losses", aRecord.losses, bRecord.losses],
    ["Points", formatPoints(aRecord.points), formatPoints(bRecord.points)],
    ["Points per match", formatNumber(aRecord.pointsPerMatch, 2), formatNumber(bRecord.pointsPerMatch, 2)],
    ["Points percentage", formatPercentage(aRecord.pointsPercentage), formatPercentage(bRecord.pointsPercentage)],
    ["Win percentage", formatPercentage(aRecord.winPercentage), formatPercentage(bRecord.winPercentage)],
    ["Ryder Cup record", formatRecord(aRyder), formatRecord(bRyder)],
    ["Presidents Cup record", formatRecord(aPresidents), formatRecord(bPresidents)],
    ["WGC / Dell Match Play record", formatRecord(aWgc), formatRecord(bWgc)]
  ];
};

const renderSuggestedComparisons = () => {
  const suggestions = POPULAR_COMPARISONS
    .map(([slugA, slugB]) => [playerBySlug.get(slugA), playerBySlug.get(slugB)])
    .filter(([playerA, playerB]) => playerA && playerB);

  if (suggestions.length === 0) return "";

  return `
    <div class="compare-suggestions">
      <span class="player-profile-related-card__label">Popular comparisons</span>
      <div class="compare-suggestions__grid">
        ${suggestions
          .map(
            ([playerA, playerB]) => `
              <a class="compare-suggestion-card" href="${getCompareUrl(playerA.slug, playerB.slug)}">
                <span>${escapeHtml(playerA.name)}</span>
                <strong>vs</strong>
                <span>${escapeHtml(playerB.name)}</span>
              </a>
            `
          )
          .join("")}
      </div>
    </div>
  `;
};

const renderState = (title, message, showSuggestions = false) => {
  compareRoot.innerHTML = `
    <section class="panel panel--sport compare-state">
      <p class="sport-band__eyebrow">Compare</p>
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">${escapeHtml(message)}</p>
      ${showSuggestions ? renderSuggestedComparisons() : ""}
    </section>
  `;
};

const renderPlayerSummary = (player, stats) => {
  const country = player.country ? `${flagFromCountry(player.country)} ${player.country.toUpperCase()}`.trim() : "Country unavailable";
  return `
    <article class="compare-player-card">
      <p class="sport-band__eyebrow">${escapeHtml(country)}</p>
      <h2><a class="player-link" href="${getProfileHref(player)}">${escapeHtml(player.name)}</a></h2>
      <div class="player-profile-identity-tags">
        ${stats.currentRanking ? `<span>#${stats.currentRanking} current ranking</span>` : ""}
        <span>${stats.currentRating ? Math.round(stats.currentRating) : "—"} current Elo</span>
        <span>${stats.peakRating ? Math.round(stats.peakRating) : "—"} peak Elo</span>
      </div>
    </article>
  `;
};

const renderHeadToHeadSummary = (playerA, playerB) => {
  const h2hMatches = buildHeadToHeadMatches(matches, playerA.name, playerB.name);
  const h2hRecord = calculateHeadToHeadRecord(matches, playerA.name, playerB.name);
  const ratesA = getRecordRates(h2hRecord.playerA);
  const ratesB = getRecordRates(h2hRecord.playerB);
  const href = getCanonicalHeadToHeadHref(playerA, playerB);
  const latest = h2hMatches.slice().sort((a, b) => b.sortValue - a.sortValue)[0];

  return `
    <section class="panel panel--sport compare-h2h">
      <div class="panel__header">
        <div class="panel__title-row">
          <h2>Direct Head-to-Head</h2>
        </div>
        <p class="muted">Only matches where these two players faced each other directly.</p>
      </div>
      <div class="compare-h2h__body">
        <div class="compare-h2h__score">
          <span>${escapeHtml(playerA.name)}</span>
          <strong>${h2hRecord.playerA.wins}-${h2hRecord.playerA.draws}-${h2hRecord.playerB.wins}</strong>
          <span>${escapeHtml(playerB.name)}</span>
        </div>
        <div class="compare-h2h__meta">
          <span>${h2hRecord.matches} match${h2hRecord.matches === 1 ? "" : "es"}</span>
          <span>${formatPoints(h2hRecord.playerA.points)}-${formatPoints(h2hRecord.playerB.points)} points</span>
          <span>${formatNumber(ratesA.pointsPerMatch, 2)}-${formatNumber(ratesB.pointsPerMatch, 2)} PPM</span>
          ${latest ? `<span>Latest: ${escapeHtml(formatMatchDate(latest))}</span>` : "<span>No meetings in the archive</span>"}
        </div>
        <a class="head-to-head-inline-link compare-h2h__link" href="${href}">Full H2H page</a>
      </div>
    </section>
  `;
};

const renderComparison = (playerA, playerB) => {
  const latestArchiveYear = matches.reduce((latest, match) => Math.max(latest, Number(match.year) || 0), 0);
  const activeCutoff = latestArchiveYear ? latestArchiveYear - 5 : 0;
  const playerAStats = buildPlayerProfileStats(matches, playerA.name, { activeCutoff });
  const playerBStats = buildPlayerProfileStats(matches, playerB.name, { activeCutoff });
  const rows = getMetricRows(playerAStats, playerBStats);

  compareRoot.innerHTML = `
    <section class="compare-player-grid">
      ${renderPlayerSummary(playerA, playerAStats)}
      ${renderPlayerSummary(playerB, playerBStats)}
    </section>
    <section class="panel panel--sport">
      <div class="panel__header">
        <div class="panel__title-row">
          <h2>Summary Comparison</h2>
        </div>
        <p class="muted">Metrics are derived from the same match and Elo logic used on player profiles.</p>
      </div>
      <div class="table-wrap">
        <table class="rank-table compare-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>${escapeHtml(playerA.name)}</th>
              <th>${escapeHtml(playerB.name)}</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                ([label, valueA, valueB]) => `
                  <tr>
                    <td>${escapeHtml(label)}</td>
                    <td>${escapeHtml(valueA)}</td>
                    <td>${escapeHtml(valueB)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
    ${renderHeadToHeadSummary(playerA, playerB)}
  `;
};

const updateUrlState = () => {
  const params = new URLSearchParams(window.location.search);
  if (selectedSlugs[0] || selectedSlugs[1]) {
    params.set("players", selectedSlugs.filter(Boolean).join(","));
  } else {
    params.delete("players");
  }
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
};

const syncInputs = () => {
  const [slugA, slugB] = selectedSlugs;
  playerAInput.value = slugA ? getPlayerLabel(playerBySlug.get(slugA)) : "";
  playerBInput.value = slugB ? getPlayerLabel(playerBySlug.get(slugB)) : "";
};

const renderCurrentState = () => {
  const playerA = playerBySlug.get(selectedSlugs[0]);
  const playerB = playerBySlug.get(selectedSlugs[1]);

  if (!playerA && !playerB) {
    renderState("Select two players", "Choose players above to compare their matchplay records and direct head-to-head.", true);
    return;
  }

  if (!playerA || !playerB) {
    renderState("Choose one more player", "Select a second player to build the comparison.");
    return;
  }

  if (playerA.slug === playerB.slug) {
    renderState("Choose two different players", "A comparison needs two different players.");
    return;
  }

  renderComparison(playerA, playerB);
};

const handleInputChange = (index, value) => {
  const player = findPlayerFromInput(value);
  selectedSlugs[index] = player ? player.slug : "";
  syncInputs();
  updateUrlState();
  renderCurrentState();
};

const setupInputs = () => {
  playerAInput.addEventListener("change", () => handleInputChange(0, playerAInput.value));
  playerBInput.addEventListener("change", () => handleInputChange(1, playerBInput.value));
  playerAInput.addEventListener("blur", () => handleInputChange(0, playerAInput.value));
  playerBInput.addEventListener("blur", () => handleInputChange(1, playerBInput.value));
};

const setupNav = () => {
  const navToggle = document.querySelector(".site-nav__toggle");
  const navLinks = document.getElementById("siteNavLinks");
  const navBackdrop = document.getElementById("siteNavBackdrop");
  if (!navToggle || !navLinks || !navBackdrop) return;

  const closeNav = () => {
    navLinks.classList.remove("is-open");
    navBackdrop.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navBackdrop.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
  navBackdrop.addEventListener("click", closeNav);
  navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
};

const initCompare = async () => {
  setupNav();
  setupInputs();

  try {
    const [playersData, matchData] = await Promise.all([
      fetch("/players-data.json").then((res) => {
        if (!res.ok) throw new Error("Unable to load player index");
        return res.json();
      }),
      fetch("/data.json").then((res) => {
        if (!res.ok) throw new Error("Unable to load match data");
        return res.json();
      })
    ]);

    players = (playersData.players || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    matches = (matchData.matches || []).filter((match) => match && match.result !== "not played");
    playerBySlug = new Map(players.map((player) => [player.slug, player]));
    playerOptions.innerHTML = players
      .map((player) => `<option value="${escapeHtml(getPlayerLabel(player))}"></option>`)
      .join("");

    const params = new URLSearchParams(window.location.search);
    const requested = asText(params.get("players"))
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean);
    selectedSlugs = [requested[0] || "", requested[1] || ""].map((slug) => (playerBySlug.has(slug) ? slug : ""));
    syncInputs();
    renderCurrentState();
  } catch (error) {
    console.error(error);
    renderState("Comparison unavailable", "The comparison data could not be loaded. Please try again later.");
  }
};

initCompare();
