const headToHeadRoot = document.getElementById("headToHeadRoot");
const pagePlayerASlug = document.body.dataset.playerA || "";
const pagePlayerBSlug = document.body.dataset.playerB || "";
const canonicalPath = document.body.dataset.canonicalPath || "";

const HeadToHeadStats = globalThis.MatchplayStats;

if (!HeadToHeadStats) {
  throw new Error("Head-to-head statistics helpers failed to load.");
}

const {
  asText,
  buildHeadToHeadEventBreakdown,
  buildHeadToHeadMatches,
  calculateHeadToHeadRecord,
  formatMatchDate,
  getRecordRates
} = HeadToHeadStats;

const escapeHtml = (value) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

const formatNumber = (value, digits = 1, fallback = "—") =>
  Number.isFinite(value) ? value.toFixed(digits) : fallback;

const formatPoints = (value) => formatNumber(value, Number.isInteger(value) ? 0 : 1);

const profileHref = (slug) => `/players/${encodeURIComponent(slug)}/`;

const setMetaContent = (selector, content) => {
  const element = document.querySelector(selector);
  if (element && content) element.setAttribute("content", content);
};

const setCanonicalHref = (href) => {
  const element = document.querySelector('link[rel="canonical"]');
  if (element && href) element.setAttribute("href", href);
};

const setPageMetadata = (playerA, playerB) => {
  const title = `${playerA.name} vs ${playerB.name} Head-to-Head Matchplay Record | Matchplay Rankings`;
  const description = `View the professional golf matchplay head-to-head record between ${playerA.name} and ${playerB.name}, including results, events, scores, and match history.`;
  const canonicalUrl = `https://www.matchplayrankings.com/head-to-head/${playerA.slug}/vs/${playerB.slug}/`;
  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
  setCanonicalHref(canonicalUrl);
};

const renderState = (title, message, actionHref = "/index.html", actionText = "Back to homepage") => {
  headToHeadRoot.innerHTML = `
    <section class="sport-band sport-band--compact">
      <div class="sport-band__content">
        <div class="head-to-head-state">
          <p class="section-kicker">Head-to-head</p>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(message)}</p>
          <a class="btn btn--primary" href="${escapeHtml(actionHref)}">${escapeHtml(actionText)}</a>
        </div>
      </div>
    </section>
  `;
};

const getWinnerLabel = (record, playerA, playerB) => {
  if (record.playerA.points > record.playerB.points) return `${playerA.name} leads`;
  if (record.playerB.points > record.playerA.points) return `${playerB.name} leads`;
  if (record.matches > 0) return "All square";
  return "No meetings yet";
};

const recordLine = (record) => `${record.wins}-${record.draws}-${record.losses}`;

const renderPlayerPanel = (player, record, sideLabel) => `
  <article class="head-to-head-player-card">
    <span class="head-to-head-player-card__eyebrow">${escapeHtml(sideLabel)}</span>
    <h2><a class="player-link" href="${profileHref(player.slug)}">${escapeHtml(player.name)}</a></h2>
    <div class="player-profile-identity-tags">
      ${
        player.country
          ? `<span>${escapeHtml(`${flagFromCountry(player.country)} ${player.country}`.trim())}</span>`
          : ""
      }
      <span>${escapeHtml(recordLine(record))} W-D-L</span>
    </div>
    <div class="head-to-head-points">
      <strong>${formatPoints(record.points)}</strong>
      <span>points · ${formatNumber(record.pointsPerMatch, 2)} PPM</span>
    </div>
  </article>
`;

const renderSummaryStats = (record, playerA, playerB) => `
  <div class="head-to-head-summary-grid" aria-label="Head-to-head summary">
    <div class="player-profile-stat">
      <span>Matches</span>
      <strong>${record.matches}</strong>
    </div>
    <div class="player-profile-stat">
      <span>${escapeHtml(playerA.name)} wins</span>
      <strong>${record.playerA.wins}</strong>
    </div>
    <div class="player-profile-stat">
      <span>Draws / halves</span>
      <strong>${record.playerA.draws}</strong>
    </div>
    <div class="player-profile-stat">
      <span>${escapeHtml(playerB.name)} wins</span>
      <strong>${record.playerB.wins}</strong>
    </div>
  </div>
`;

const renderEventBreakdown = (breakdown, playerA, playerB) => `
  <section class="panel panel--sport">
    <div class="panel__header">
      <div class="panel__title-row">
        <h2>Event Breakdown</h2>
      </div>
      <p class="muted">Record split by competition for this matchup.</p>
    </div>
    ${
      breakdown.length
        ? `
          <div class="table-wrap">
            <table class="rank-table head-to-head-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Matches</th>
                  <th>${escapeHtml(playerA.name)}</th>
                  <th>Halves</th>
                  <th>${escapeHtml(playerB.name)}</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                ${breakdown
                  .map(
                    (event) => `
                      <tr>
                        <td>${escapeHtml(event.event)}</td>
                        <td>${event.matches}</td>
                        <td>${event.playerAWins}</td>
                        <td>${event.draws}</td>
                        <td>${event.playerBWins}</td>
                        <td>${formatPoints(event.playerAPoints)}-${formatPoints(event.playerBPoints)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="player-profile-unavailable"><p class="muted">No event breakdown is available because these players have not met in the dataset.</p></div>`
    }
  </section>
`;

const renderMatchResult = (match) => {
  if (match.resultForA === "win") return `${match.playerA} won`;
  if (match.resultForA === "loss") return `${match.playerB} won`;
  return "Halved";
};

const resultClass = (resultForA) => {
  if (resultForA === "win") return "result-win";
  if (resultForA === "loss") return "result-loss";
  return "result-halved";
};

const renderMatchList = (matches, playerA, playerB) => `
  <section class="panel panel--sport">
    <div class="panel__header">
      <div class="panel__title-row">
        <h2>Match History</h2>
      </div>
      <p class="muted">Every recorded match between ${escapeHtml(playerA.name)} and ${escapeHtml(playerB.name)}.</p>
    </div>
    ${
      matches.length
        ? `
          <div class="table-wrap">
            <table class="rank-table head-to-head-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Round</th>
                  <th>Result</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                ${matches
                  .slice()
                  .sort((a, b) => b.sortValue - a.sortValue)
                  .map(
                    (match) => `
                      <tr>
                        <td>${escapeHtml(formatMatchDate(match))}</td>
                        <td>${escapeHtml(match.event)}</td>
                        <td>${escapeHtml(match.round || "—")}</td>
                        <td><span class="match-result-pill ${resultClass(match.resultForA)}">${escapeHtml(renderMatchResult(match))}</span></td>
                        <td>${escapeHtml(match.score || "—")}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="player-profile-unavailable"><p class="muted">These players have not faced each other in the current matchplay dataset.</p></div>`
    }
  </section>
`;

const renderHeadToHead = (playerA, playerB, matches) => {
  setPageMetadata(playerA, playerB);
  const h2hMatches = buildHeadToHeadMatches(matches, playerA.name, playerB.name);
  const record = calculateHeadToHeadRecord(matches, playerA.name, playerB.name);
  const breakdown = buildHeadToHeadEventBreakdown(matches, playerA.name, playerB.name);
  const playerARates = getRecordRates(record.playerA);
  const playerBRates = getRecordRates(record.playerB);
  const playerARecord = { ...record.playerA, ...playerARates };
  const playerBRecord = { ...record.playerB, ...playerBRates };

  headToHeadRoot.innerHTML = `
    <section class="sport-band sport-band--compact">
      <div class="sport-band__content head-to-head-shell">
        <div class="head-to-head-hero">
          <div>
            <p class="section-kicker">Head-to-head</p>
            <h1>${escapeHtml(playerA.name)} vs ${escapeHtml(playerB.name)}</h1>
            <p>${escapeHtml(getWinnerLabel(record, playerA, playerB))}</p>
          </div>
          <div class="head-to-head-actions">
            <a class="btn btn--secondary" href="${profileHref(playerA.slug)}">${escapeHtml(playerA.name)} profile</a>
            <a class="btn btn--secondary" href="${profileHref(playerB.slug)}">${escapeHtml(playerB.name)} profile</a>
          </div>
        </div>
        <div class="head-to-head-versus">
          ${renderPlayerPanel(playerA, playerARecord, "Player A")}
          <div class="head-to-head-vs" aria-hidden="true">vs</div>
          ${renderPlayerPanel(playerB, playerBRecord, "Player B")}
        </div>
        ${renderSummaryStats(record, playerA, playerB)}
        ${renderEventBreakdown(breakdown, playerA, playerB)}
        ${renderMatchList(h2hMatches, playerA, playerB)}
      </div>
    </section>
  `;
};

const loadJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  return response.json();
};

const initHeadToHead = async () => {
  if (!headToHeadRoot) return;

  if (canonicalPath && window.location.pathname !== canonicalPath) {
    window.location.replace(canonicalPath);
    return;
  }

  headToHeadRoot.innerHTML = `
    <section class="sport-band sport-band--compact">
      <div class="sport-band__content">
        <div class="head-to-head-state"><p class="section-kicker">Head-to-head</p><h1>Loading matchup...</h1></div>
      </div>
    </section>
  `;

  try {
    const [playersData, matchData] = await Promise.all([
      loadJson("/players-data.json"),
      loadJson("/data.json")
    ]);
    const players = Array.isArray(playersData.players) ? playersData.players : [];
    const playerA = players.find((player) => player.slug === pagePlayerASlug);
    const playerB = players.find((player) => player.slug === pagePlayerBSlug);

    if (!playerA || !playerB) {
      renderState("Matchup not found", "One or both players could not be found.", "/index.html", "Back to rankings");
      return;
    }

    const [canonicalA, canonicalB] = [playerA, playerB].sort((a, b) => a.slug.localeCompare(b.slug));
    const expectedPath = `/head-to-head/${canonicalA.slug}/vs/${canonicalB.slug}/`;
    if (window.location.pathname !== expectedPath) {
      window.location.replace(expectedPath);
      return;
    }

    const matches = (matchData.matches || []).filter((match) => match && match.result !== "not played");
    renderHeadToHead(canonicalA, canonicalB, matches);
  } catch (error) {
    console.error(error);
    renderState("Could not load matchup", "The head-to-head data could not be loaded. Please try again later.", "/index.html", "Back to rankings");
  }
};

initHeadToHead();
