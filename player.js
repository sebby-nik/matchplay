const profileRoot = document.getElementById("playerProfileRoot");
const currentSlug = document.body.dataset.playerSlug || "";

const PlayerStats = globalThis.MatchplayStats;

if (!PlayerStats) {
  throw new Error("Player statistics helpers failed to load.");
}

const {
  asText,
  buildBestWins,
  buildEventRecords,
  buildHeadToHeadRecords,
  buildPlayerProfileStats,
  buildWorstLosses,
  calculateOverallRecord,
  computePlayerRatingProfile,
  formatMatchDate,
  getCurrentRanking,
  normalizeEventLabel
} = PlayerStats;

const calculateRecord = calculateOverallRecord;
const buildEventBreakdown = buildEventRecords;

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

const buildPlayerSlugMap = (players) =>
  new Map((Array.isArray(players) ? players : []).map((entry) => [entry.name, entry.slug]));

const LINEAL_CHAMPION_NAMES = new Set([
  "Tiger Woods",
  "Jeff Maggert",
  "Paul Lawrie",
  "Darren Clarke",
  "Matt Gogel",
  "Tom Lehman",
  "Scott McCarron",
  "Kevin Sutherland",
  "Adam Scott",
  "Nick O'Hern",
  "Ian Poulter",
  "David Toms",
  "Geoff Ogilvy",
  "Henrik Stenson",
  "Tim Clark",
  "Rory McIlroy",
  "Camilo Villegas",
  "Paul Casey",
  "Stewart Cink",
  "Yang Yong-eun",
  "Matt Kuchar",
  "Luke Donald",
  "Ernie Els",
  "Peter Hanson",
  "Mark Wilson",
  "Hunter Mahan",
  "Jordan Spieth",
  "Victor Dubuisson",
  "Jason Day",
  "Charley Hoffman",
  "Branden Grace",
  "Tommy Fleetwood",
  "Danny Willett",
  "Gary Woodland",
  "Pat Perez",
  "Lee Westwood",
  "Xander Schauffele",
  "Rafa Cabrera-Bello",
  "Kevin Kisner",
  "Billy Horschel",
  "Scottie Scheffler",
  "Sam Burns"
]);

const getPlayerProfileHref = (playerSlugMap, name) => {
  const slug = playerSlugMap.get(name);
  return slug ? `../${slug}/` : "";
};

const getCompareHref = (playerSlug, opponentSlug = "") => {
  if (!playerSlug) return "";
  const slugs = [playerSlug, opponentSlug].filter(Boolean);
  return `../../compare/?players=${slugs.map(encodeURIComponent).join(",")}`;
};

const formatRatingDelta = (value) => {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
};

const renderOpponentLink = (match, playerSlugMap) => {
  const href = getPlayerProfileHref(playerSlugMap, match.opponent);
  const label = `${flagFromCountry(match.opponentCountry)} ${match.opponent}`.trim();
  return href
    ? `<a class="player-link" href="${href}">${escapeHtml(label)}</a>`
    : escapeHtml(label);
};

const getCanonicalHeadToHeadHref = (playerSlug, opponentSlug) => {
  if (!playerSlug || !opponentSlug) return "";
  const [playerA, playerB] = [playerSlug, opponentSlug].sort((a, b) => a.localeCompare(b));
  return `../../head-to-head/${playerA}/vs/${playerB}/`;
};

const renderHeadToHeadInlineLink = (opponentName, playerSlugMap, label = "H2H") => {
  const opponentSlug = playerSlugMap.get(opponentName);
  const href = getCanonicalHeadToHeadHref(currentSlug, opponentSlug);
  return href
    ? `<a class="head-to-head-inline-link" href="${href}" aria-label="View head-to-head record">${escapeHtml(label)}</a>`
    : "";
};

const renderCompareInlineLink = (opponentName, playerSlugMap, label = "Compare") => {
  const opponentSlug = playerSlugMap.get(opponentName);
  const href = getCompareHref(currentSlug, opponentSlug);
  return href
    ? `<a class="head-to-head-inline-link compare-inline-link" href="${href}" aria-label="Compare full careers">${escapeHtml(label)}</a>`
    : "";
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
                  <th>Matchup</th>
                  <th>Compare</th>
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
                        <td>${renderHeadToHeadInlineLink(match.opponent, playerSlugMap, "View") || "—"}</td>
                        <td>${renderCompareInlineLink(match.opponent, playerSlugMap, "Compare") || "—"}</td>
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

const renderRatingTimelineSection = (timeline, rating) => {
  const points = timeline
    .filter((match) => Number.isFinite(match.ratingAfter))
    .map((match, index) => ({ ...match, index }));

  if (points.length < 2) {
    return `
      <section class="panel panel--sport">
        <div class="panel__header">
          <div class="panel__title-row">
            <h2>Rating Timeline</h2>
          </div>
          <p class="muted">Rating history is derived from chronological match data using the same Elo calculation as the profile summary.</p>
        </div>
        <div class="player-profile-unavailable"><p class="muted">Not enough match history is available to draw a rating timeline.</p></div>
      </section>
    `;
  }

  const width = 720;
  const height = 260;
  const padding = { top: 24, right: 26, bottom: 40, left: 54 };
  const values = points.map((point) => point.ratingAfter);
  const minRating = Math.floor((Math.min(...values) - 30) / 10) * 10;
  const maxRating = Math.ceil((Math.max(...values) + 30) / 10) * 10;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xFor = (index) => padding.left + (index / Math.max(points.length - 1, 1)) * chartWidth;
  const yFor = (value) => padding.top + ((maxRating - value) / Math.max(maxRating - minRating, 1)) * chartHeight;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(point.ratingAfter).toFixed(1)}`)
    .join(" ");
  const startYear = points[0]?.year || "";
  const endYear = points[points.length - 1]?.year || "";
  const peakPoint = points.reduce((peak, point) => (point.ratingAfter > peak.ratingAfter ? point : peak), points[0]);
  const currentRating = rating ? Math.round(rating.rating) : Math.round(points[points.length - 1].ratingAfter);
  const peakRating = rating ? Math.round(rating.peak) : Math.round(peakPoint.ratingAfter);
  const markerStep = points.length > 80 ? 4 : points.length > 40 ? 2 : 1;

  return `
    <section class="panel panel--sport">
      <div class="panel__header player-profile-chart-header">
        <div>
          <div class="panel__title-row">
            <h2>Rating Timeline</h2>
          </div>
          <p class="muted">Derived from chronological match data using the same Elo calculation as the profile summary.</p>
        </div>
        <div class="player-profile-chart-stats">
          <span>Current <strong>${currentRating}</strong></span>
          <span>Peak <strong>${peakRating}</strong></span>
        </div>
      </div>
      <div class="player-profile-chart" role="img" aria-label="Elo rating timeline from ${escapeHtml(startYear)} to ${escapeHtml(endYear)}">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <line class="player-profile-chart__grid" x1="${padding.left}" y1="${yFor(maxRating)}" x2="${width - padding.right}" y2="${yFor(maxRating)}"></line>
          <line class="player-profile-chart__grid" x1="${padding.left}" y1="${yFor((minRating + maxRating) / 2)}" x2="${width - padding.right}" y2="${yFor((minRating + maxRating) / 2)}"></line>
          <line class="player-profile-chart__grid" x1="${padding.left}" y1="${yFor(minRating)}" x2="${width - padding.right}" y2="${yFor(minRating)}"></line>
          <text class="player-profile-chart__label" x="8" y="${yFor(maxRating) + 4}">${maxRating}</text>
          <text class="player-profile-chart__label" x="8" y="${yFor((minRating + maxRating) / 2) + 4}">${Math.round((minRating + maxRating) / 2)}</text>
          <text class="player-profile-chart__label" x="8" y="${yFor(minRating) + 4}">${minRating}</text>
          <text class="player-profile-chart__label" x="${padding.left}" y="${height - 10}">${escapeHtml(startYear)}</text>
          <text class="player-profile-chart__label player-profile-chart__label--end" x="${width - padding.right}" y="${height - 10}">${escapeHtml(endYear)}</text>
          <path class="player-profile-chart__line" d="${path}"></path>
          <circle class="player-profile-chart__peak" cx="${xFor(peakPoint.index).toFixed(1)}" cy="${yFor(peakPoint.ratingAfter).toFixed(1)}" r="5">
            <title>Peak ${Math.round(peakPoint.ratingAfter)} after ${escapeHtml(peakPoint.event)} ${escapeHtml(formatMatchDate(peakPoint))}</title>
          </circle>
          ${points
            .filter((point, index) => index % markerStep === 0 || index === points.length - 1 || point === peakPoint)
            .map(
              (point) => `
                <circle class="player-profile-chart__point" cx="${xFor(point.index).toFixed(1)}" cy="${yFor(point.ratingAfter).toFixed(1)}" r="3">
                  <title>${escapeHtml(formatMatchDate(point))} · ${escapeHtml(point.event)} vs ${escapeHtml(point.opponent)} · ${Math.round(point.ratingAfter)} (${formatRatingDelta(point.ratingDelta)})</title>
                </circle>
              `
            )
            .join("")}
        </svg>
      </div>
    </section>
  `;
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

const getHeadToHeadHref = (record, playerSlugMap) => {
  const opponentSlug = playerSlugMap.get(record.opponent);
  return getCanonicalHeadToHeadHref(currentSlug, opponentSlug);
};

const renderHeadToHeadRows = (records, playerSlugMap) =>
  records
    .map(
      (record) => {
        const headToHeadHref = getHeadToHeadHref(record, playerSlugMap);
        return `
        <tr>
          <td>${getHeadToHeadOpponentLink(record, playerSlugMap)}</td>
          <td>${record.matches}</td>
          <td>${record.wins}</td>
          <td>${record.draws}</td>
          <td>${record.losses}</td>
          <td>${record.points.toFixed(1)}</td>
          <td>${formatNumber(record.pointsPerMatch, 2)}</td>
          <td>${escapeHtml(record.latestMeeting || "—")}</td>
          <td>${
            headToHeadHref
              ? `<a class="player-link" href="${headToHeadHref}">View matchup</a>`
              : "—"
          }</td>
        </tr>
      `;
      }
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
              <th>Matchup</th>
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

const renderRelatedPlayersSection = (records, playerSlugMap) => {
  const notable = records
    .slice()
    .sort(
      (a, b) =>
        b.matches - a.matches ||
        b.points - a.points ||
        b.latestSortValue - a.latestSortValue ||
        a.opponent.localeCompare(b.opponent)
    )
    .slice(0, 6);

  return `
    <section class="panel panel--sport">
      <div class="panel__header">
        <div class="panel__title-row">
          <h2>Notable Opponents</h2>
        </div>
        <p class="muted">Most frequent captured opponents, with profile links where available.</p>
      </div>
      ${
        notable.length
          ? `
            <div class="player-profile-related-grid">
              ${notable
                .map(
                  (record) => `
                    <article class="player-profile-related-card">
                      <div>
                        <span class="player-profile-related-card__label">${record.matches} match${record.matches === 1 ? "" : "es"}</span>
                        <h3>${getHeadToHeadOpponentLink(record, playerSlugMap)}</h3>
                      </div>
                      <div class="player-profile-related-card__meta">
                        <span>${record.wins}-${record.draws}-${record.losses} W-D-L</span>
                        <span>${record.points.toFixed(1)} pts</span>
                        <span>${escapeHtml(record.latestMeeting || "Latest unavailable")}</span>
                      </div>
                    </article>
                  `
                )
                .join("")}
            </div>
          `
          : `<div class="player-profile-unavailable"><p class="muted">No related opponents are available for this player yet.</p></div>`
      }
    </section>
  `;
};

const renderMatchHistorySection = (recentMatches, playerSlugMap) => `
  <section class="panel panel--sport">
    <div class="panel__header">
      <div class="panel__title-row">
        <h2>Match History</h2>
      </div>
      <p class="muted">Full captured singles match history. Rating values are shown before and after each match.</p>
    </div>
    ${
      recentMatches.length
        ? `
          <div class="table-wrap">
            <table class="rank-table player-profile-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Round</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th>Score</th>
                  <th>Opponent Elo</th>
                  <th>Elo</th>
                  <th>Change</th>
                  <th>Matchup</th>
                  <th>Compare</th>
                </tr>
              </thead>
              <tbody>
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
                      <tr>
                        <td>${escapeHtml(formatMatchDate(match))}</td>
                        <td>${escapeHtml(match.event)}</td>
                        <td>${escapeHtml(match.round || "Singles")}</td>
                        <td>${renderOpponentLink(match, playerSlugMap)}</td>
                        <td><span class="match-result-pill ${resultClass}">${resultLabel}</span></td>
                        <td>${escapeHtml(match.score || "—")}</td>
                        <td>${Math.round(match.opponentRatingBefore)}</td>
                        <td>${Math.round(match.ratingBefore)} → ${Math.round(match.ratingAfter)}</td>
                        <td><span class="rating-delta ${delta > 0 ? "rating-delta--pos" : delta < 0 ? "rating-delta--neg" : "rating-delta--even"}">${delta > 0 ? `+${delta}` : delta}</span></td>
                        <td>${renderHeadToHeadInlineLink(match.opponent, playerSlugMap, "View") || "—"}</td>
                        <td>${renderCompareInlineLink(match.opponent, playerSlugMap, "Compare") || "—"}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="player-profile-unavailable"><p class="muted">No match history is available for this player yet.</p></div>`
    }
  </section>
`;

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
  const playerSlugMap = buildPlayerSlugMap(players);
  const flag = flagFromCountry(player.country);
  const countryLabel = player.country ? player.country.toUpperCase() : "Country unavailable";
  const updated = formatUpdatedDate(metadata?.dataUpdatedAt || metadata?.lastUpdated);
  const latestArchiveYear = matches.reduce((latest, match) => Math.max(latest, Number(match.year) || 0), 0);
  const activeCutoff = latestArchiveYear ? latestArchiveYear - 5 : 0;
  const profileStats = buildPlayerProfileStats(matches, player.name, { activeCutoff });
  const { record, rating, timeline, eventRecords, bestWins, worstLosses, headToHeadRecords, currentRanking } = profileStats;
  const recentMatches = timeline.slice().reverse();
  const statusLabel = record.lastYear && activeCutoff && record.lastYear >= activeCutoff ? "Active" : "Inactive";
  const pointsPerMatch = record.matches ? record.points / record.matches : null;
  const pointsPercentage = record.matches ? (record.points / record.matches) * 100 : null;
  const winPercentage = record.matches ? (record.wins / record.matches) * 100 : null;
  const eventBreakdown = eventRecords;
  const hasFeaturedSummary = currentRanking === 1 || LINEAL_CHAMPION_NAMES.has(player.name);
  const summaryCardClass = hasFeaturedSummary
    ? "lineal-card lineal-card--gold player-profile-card"
    : "lineal-card player-profile-card player-profile-card--standard";

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
          <div class="player-profile-identity-tags" aria-label="Player identity summary">
            ${currentRanking ? `<span>#${currentRanking} current ranking</span>` : ""}
            <span>${rating ? Math.round(rating.rating) : "—"} current Elo</span>
            <span>${rating ? Math.round(rating.peak) : "—"} peak Elo</span>
            <span>${statusLabel}</span>
          </div>
          <div class="profile-actions">
            <a class="head-to-head-inline-link compare-inline-link" href="${getCompareHref(player.slug)}">Compare this player</a>
          </div>
        </div>
        <div class="${summaryCardClass}">
          <p class="lineal-card__label">Profile Summary</p>
          <div class="lineal-card__title-row">
            <h2 class="lineal-card__name">${rating ? Math.round(rating.rating) : "—"}</h2>
            <span class="lineal-card__record">Rating</span>
          </div>
          <div class="lineal-card__meta">${record.wins}-${record.draws}-${record.losses} W-D-L · ${record.points.toFixed(1)} points</div>
          <div class="lineal-card__stats">
            ${currentRanking ? `<span>Rank #${currentRanking}</span>` : ""}
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
          <span>Current ranking</span>
          <strong>${currentRanking ? `#${currentRanking}` : "—"}</strong>
        </article>
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
          <span>Matches</span>
          <strong>${record.matches}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Wins</span>
          <strong>${record.wins}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Draws / halves</span>
          <strong>${record.draws}</strong>
        </article>
        <article class="player-profile-stat">
          <span>Losses</span>
          <strong>${record.losses}</strong>
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
      ${renderRatingTimelineSection(timeline, rating)}
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
      ${renderRelatedPlayersSection(headToHeadRecords, playerSlugMap)}
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
      ${renderMatchHistorySection(recentMatches, playerSlugMap)}
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
