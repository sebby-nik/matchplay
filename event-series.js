const eventSeriesRoot = document.getElementById("eventSeriesRoot");
const eventSeriesSlug = document.body.dataset.eventSeriesSlug || "";

const EventStats = globalThis.MatchplayStats;
const EventUtils = globalThis.MatchplayEvents;

if (!EventStats || !EventUtils) {
  throw new Error("Event helpers failed to load.");
}

const { asText, uniqueMatches } = EventStats;
const { SERIES_CONFIG, getSeriesSlug } = EventUtils;

const escapeHtml = (value) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatNumber = (value, digits = 0, fallback = "—") =>
  Number.isFinite(value) ? value.toFixed(digits) : fallback;

const formatPoints = (value) => {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(Number.isInteger(value) ? 0 : 1);
};

const getPlayerProfileHref = (slug) => `/players/${encodeURIComponent(slug)}/`;

const renderPlayerLink = (name, playerSlugMap) => {
  const slug = playerSlugMap.get(name);
  return slug
    ? `<a class="player-link" href="${getPlayerProfileHref(slug)}">${escapeHtml(name)}</a>`
    : escapeHtml(name);
};

const getRecordRates = (record) => {
  const matches = record.matches || 0;
  const points = record.points || 0;
  return {
    pointsPerMatch: matches ? points / matches : null,
    pointsPercentage: matches ? (points / matches) * 100 : null
  };
};

const buildPlayerRecords = (matches) => {
  const records = new Map();
  matches.forEach((match) => {
    if (!match?.player) return;
    if (!records.has(match.player)) {
      records.set(match.player, {
        player: match.player,
        country: match.player_country || "",
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0
      });
    }
    const record = records.get(match.player);
    record.matches += 1;
    record.points += Number(match.points || 0);
    if (match.result === "win") record.wins += 1;
    else if (match.result === "loss") record.losses += 1;
    else if (match.result === "halved") record.draws += 1;
  });

  return Array.from(records.values()).map((record) => ({ ...record, ...getRecordRates(record) }));
};

const buildEditionRows = (matches) => {
  const editions = new Map();
  matches.forEach((match) => {
    const year = Number(match.year);
    if (!Number.isFinite(year)) return;
    if (!editions.has(year)) {
      editions.set(year, { year, month: match.month || "", rowMatches: [], players: new Set() });
    }
    const edition = editions.get(year);
    edition.rowMatches.push(match);
    if (match.player) edition.players.add(match.player);
    if (match.opponent) edition.players.add(match.opponent);
  });

  return Array.from(editions.values())
    .map((edition) => ({
      year: edition.year,
      month: edition.month,
      matches: uniqueMatches(edition.rowMatches).length,
      players: edition.players.size
    }))
    .sort((a, b) => b.year - a.year);
};

const renderMetricGrid = ({ totalMatches, playerCount, editionRows, minMatches }) => `
  <section class="player-profile-summary-grid event-series-summary" aria-label="Event series summary">
    <article class="player-profile-stat">
      <span>Total matches</span>
      <strong>${totalMatches.toLocaleString("en-GB")}</strong>
    </article>
    <article class="player-profile-stat">
      <span>Players</span>
      <strong>${playerCount.toLocaleString("en-GB")}</strong>
    </article>
    <article class="player-profile-stat">
      <span>Editions covered</span>
      <strong>${editionRows.length}</strong>
    </article>
    <article class="player-profile-stat">
      <span>PPM threshold</span>
      <strong>${minMatches}+</strong>
    </article>
  </section>
`;

const renderPlayerTable = ({ title, description, rows, playerSlugMap, valueLabel, valueFor }) => `
  <section class="panel panel--sport">
    <div class="panel__header">
      <div class="panel__title-row">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <p class="muted">${escapeHtml(description)}</p>
    </div>
    ${
      rows.length
        ? `
          <div class="table-wrap">
            <table class="rank-table event-series-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Record</th>
                  <th>Matches</th>
                  <th>Points</th>
                  <th>${escapeHtml(valueLabel)}</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (record) => `
                      <tr>
                        <td>${renderPlayerLink(record.player, playerSlugMap)}</td>
                        <td>${record.wins}-${record.draws}-${record.losses}</td>
                        <td>${record.matches}</td>
                        <td>${formatPoints(record.points)}</td>
                        <td>${escapeHtml(valueFor(record))}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="player-profile-unavailable"><p class="muted">No player records are available for this section.</p></div>`
    }
  </section>
`;

const renderSeriesPage = (seriesConfig, eventMatches, playerSlugMap) => {
  const unique = uniqueMatches(eventMatches);
  const editionRows = buildEditionRows(eventMatches);
  const playerSet = new Set();
  eventMatches.forEach((match) => {
    if (match.player) playerSet.add(match.player);
    if (match.opponent) playerSet.add(match.opponent);
  });

  const records = buildPlayerRecords(eventMatches);
  const minMatches = unique.length >= 100 ? 8 : unique.length >= 50 ? 5 : 3;
  const topPerformers = records
    .slice()
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.matches - a.matches || a.player.localeCompare(b.player))
    .slice(0, 10);
  const bestRecords = records
    .filter((record) => record.matches >= minMatches)
    .sort(
      (a, b) =>
        (b.pointsPercentage ?? -1) - (a.pointsPercentage ?? -1) ||
        b.points - a.points ||
        b.matches - a.matches ||
        a.player.localeCompare(b.player)
    )
    .slice(0, 10);
  const mostMatches = records
    .slice()
    .sort((a, b) => b.matches - a.matches || b.points - a.points || a.player.localeCompare(b.player))
    .slice(0, 10);
  const highestPpm = records
    .filter((record) => record.matches >= minMatches)
    .sort(
      (a, b) =>
        (b.pointsPerMatch ?? -1) - (a.pointsPerMatch ?? -1) ||
        b.matches - a.matches ||
        a.player.localeCompare(b.player)
    )
    .slice(0, 10);

  eventSeriesRoot.innerHTML = `
    <section class="sport-band sport-band--compact event-series-hero">
      <div class="sport-band__content">
        <div class="sport-band__copy">
          <p class="sport-band__eyebrow">Event Series</p>
          <h1>${escapeHtml(seriesConfig.name)}</h1>
          <p>${escapeHtml(seriesConfig.description)}</p>
        </div>
      </div>
    </section>
    <main class="layout layout--sport event-series-layout">
      ${renderMetricGrid({
        totalMatches: unique.length,
        playerCount: playerSet.size,
        editionRows,
        minMatches
      })}
      <div class="event-series-grid">
        ${renderPlayerTable({
          title: "Top Performers",
          description: "Players with the most points in this event series.",
          rows: topPerformers,
          playerSlugMap,
          valueLabel: "PPM",
          valueFor: (record) => formatNumber(record.pointsPerMatch, 2)
        })}
        ${renderPlayerTable({
          title: "Best Records",
          description: `Best points percentage with a minimum of ${minMatches} matches.`,
          rows: bestRecords,
          playerSlugMap,
          valueLabel: "Points %",
          valueFor: (record) => `${Math.round(record.pointsPercentage)}%`
        })}
        ${renderPlayerTable({
          title: "Most Matches Played",
          description: "Players with the most captured appearances in this event series.",
          rows: mostMatches,
          playerSlugMap,
          valueLabel: "PPM",
          valueFor: (record) => formatNumber(record.pointsPerMatch, 2)
        })}
        ${renderPlayerTable({
          title: "Highest Points Per Match",
          description: `Highest points per match with a minimum of ${minMatches} matches.`,
          rows: highestPpm,
          playerSlugMap,
          valueLabel: "PPM",
          valueFor: (record) => formatNumber(record.pointsPerMatch, 2)
        })}
      </div>
    </main>
  `;
};

const renderState = (title, message) => {
  eventSeriesRoot.innerHTML = `
    <section class="panel panel--sport player-profile__state">
      <p class="sport-band__eyebrow">Event Series</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">${escapeHtml(message)}</p>
      <a class="profile-back-link" href="/events.html">Back to events</a>
    </section>
  `;
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

const initEventSeries = async () => {
  if (!eventSeriesRoot) return;
  setupNav();
  const seriesConfig = SERIES_CONFIG[eventSeriesSlug];
  if (!seriesConfig) {
    renderState("Event not found", "This event series is not available in the matchplay archive yet.");
    return;
  }

  try {
    const [data, playersData] = await Promise.all([
      fetch("/data.json").then((response) => {
        if (!response.ok) throw new Error("Unable to load match data");
        return response.json();
      }),
      fetch("/players-data.json")
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
    ]);
    const playerSlugMap = new Map((playersData?.players || []).map((player) => [player.name, player.slug]));
    const eventMatches = (data.matches || []).filter(
      (match) => match && match.result !== "not played" && getSeriesSlug(match.event) === eventSeriesSlug
    );
    if (eventMatches.length === 0) {
      renderState(seriesConfig.name, "No matches are currently available for this event series.");
      return;
    }
    renderSeriesPage(seriesConfig, eventMatches, playerSlugMap);
  } catch (error) {
    console.error(error);
    renderState("Event unavailable", "The event series data could not be loaded. Please try again later.");
  }
};

initEventSeries();
