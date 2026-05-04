const eventEditionRoot = document.getElementById("eventEditionRoot");
const eventSeriesSlug = document.body.dataset.eventSeriesSlug || "";
const eventEditionYear = Number(document.body.dataset.eventEditionYear);

const EditionStats = globalThis.MatchplayStats;
const EditionUtils = globalThis.MatchplayEvents;

if (!EditionStats || !EditionUtils) {
  throw new Error("Event edition helpers failed to load.");
}

const {
  asText,
  computePlayerRatingProfile,
  constants,
  sortMatches,
  uniqueMatches
} = EditionStats;
const { SERIES_CONFIG, getSeriesSlug, slugify } = EditionUtils;

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

const formatNumber = (value, digits = 0, fallback = "—") =>
  Number.isFinite(value) ? value.toFixed(digits) : fallback;

const formatRating = (value) => formatNumber(value, 0);

const formatDelta = (value) => {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
};

const getPlayerProfileHref = (slug) => `/players/${encodeURIComponent(slug)}/`;

const getHeadToHeadHref = (playerSlug, opponentSlug) => {
  if (!playerSlug || !opponentSlug) return "";
  const [playerA, playerB] = [playerSlug, opponentSlug].sort((a, b) => a.localeCompare(b));
  return `/head-to-head/${encodeURIComponent(playerA)}/vs/${encodeURIComponent(playerB)}/`;
};

const renderPlayerLink = (name, playerSlugMap) => {
  const slug = playerSlugMap.get(name);
  return slug
    ? `<a class="player-link" href="${getPlayerProfileHref(slug)}">${escapeHtml(name)}</a>`
    : escapeHtml(name);
};

const renderFlag = (country) => {
  const flag = flagFromCountry(country);
  return flag ? `${escapeHtml(flag)} ` : "";
};

const renderHeadToHeadLink = (player, opponent, playerSlugMap) => {
  const href = getHeadToHeadHref(playerSlugMap.get(player), playerSlugMap.get(opponent));
  return href ? `<a class="subtle-link" href="${href}">H2H</a>` : "";
};

const getOpponentPoints = (match) => {
  if (match.result === "win") return 0;
  if (match.result === "loss") return 1;
  if (match.result === "halved") return 0.5;
  return 0;
};

const resultLabel = (match) => {
  if (match.result === "win") return `${match.player} defeated ${match.opponent}`;
  if (match.result === "loss") return `${match.opponent} defeated ${match.player}`;
  if (match.result === "halved") return `${match.player} and ${match.opponent} halved`;
  return "Result unavailable";
};

const resultClass = (result) => {
  if (result === "win") return "result-win";
  if (result === "loss") return "result-loss";
  return "result-halved";
};

const teamSideForCountry = (seriesSlug, country) => {
  const code = asText(country).toUpperCase();
  if (!code) return null;
  if (seriesSlug === "ryder-cup" || seriesSlug === "presidents-cup") {
    return code === "US" ? 0 : 1;
  }
  if (seriesSlug === "seve-trophy") {
    return ["GB", "IE"].includes(code) ? 0 : 1;
  }
  if (seriesSlug === "eurasia-cup" || seriesSlug === "the-royal-trophy") {
    return ["JP", "KR", "CN", "IN", "TH", "MY", "PH", "TW"].includes(code) ? 1 : 0;
  }
  return null;
};

const buildTeamSinglesScore = (matches, seriesConfig) => {
  if (!seriesConfig.teamLabels) return null;
  const totals = [0, 0];
  uniqueMatches(matches).forEach((match) => {
    const playerSide = teamSideForCountry(eventSeriesSlug, match.player_country);
    const opponentSide = teamSideForCountry(eventSeriesSlug, match.opponent_country);
    if (playerSide !== null) totals[playerSide] += Number(match.points || 0);
    if (opponentSide !== null) totals[opponentSide] += getOpponentPoints(match);
  });
  return {
    labels: seriesConfig.teamLabels,
    totals
  };
};

const makeTimelineKey = (player, opponent, round, score) =>
  [player, opponent, asText(round), asText(score)].join("|");

const buildRatingContext = (allMatches, editionMatches) => {
  const participants = new Set();
  editionMatches.forEach((match) => {
    if (match.player) participants.add(match.player);
    if (match.opponent) participants.add(match.opponent);
  });

  const timelineLookup = new Map();
  const movement = [];

  participants.forEach((player) => {
    const profile = computePlayerRatingProfile(allMatches, player);
    const eventEntries = profile.timeline.filter(
      (entry) => getSeriesSlug(entry.event) === eventSeriesSlug && Number(entry.year) === eventEditionYear
    );
    eventEntries.forEach((entry) => {
      const key = makeTimelineKey(player, entry.opponent, entry.round, entry.score);
      if (!timelineLookup.has(key)) timelineLookup.set(key, []);
      timelineLookup.get(key).push(entry);
    });
    if (eventEntries.length) {
      const first = eventEntries[0];
      const last = eventEntries[eventEntries.length - 1];
      movement.push({
        player,
        before: first.ratingBefore,
        after: last.ratingAfter,
        delta: last.ratingAfter - first.ratingBefore
      });
    }
  });

  return { movement, timelineLookup };
};

const takeTimelineEntry = (timelineLookup, player, opponent, round, score) => {
  const key = makeTimelineKey(player, opponent, round, score);
  const entries = timelineLookup.get(key) || [];
  return entries.shift() || null;
};

const buildMatchRows = (allMatches, editionMatches) => {
  const { movement, timelineLookup } = buildRatingContext(allMatches, editionMatches);
  const matches = sortMatches(editionMatches);
  return {
    movement,
    matches: matches.map((match) => {
      const playerRating = takeTimelineEntry(timelineLookup, match.player, match.opponent, match.round, match.score);
      const opponentRating = takeTimelineEntry(timelineLookup, match.opponent, match.player, match.round, match.score);
      return {
        ...match,
        playerRatingBefore: playerRating?.ratingBefore ?? null,
        playerRatingAfter: playerRating?.ratingAfter ?? null,
        opponentRatingBefore: opponentRating?.ratingBefore ?? null,
        opponentRatingAfter: opponentRating?.ratingAfter ?? null
      };
    })
  };
};

const buildEditionMetadata = (eventsData, editionMatches) => {
  const fromMetadata = (eventsData?.results_events || []).find(
    (event) => getSeriesSlug(event.event) === eventSeriesSlug && Number(event.year) === eventEditionYear
  );
  const sample = editionMatches[0] || {};
  return {
    month: fromMetadata?.month || sample.month || "",
    venue: fromMetadata?.venue || sample.venue || "",
    dateLabel: fromMetadata?.dateLabel || (fromMetadata?.month || sample.month ? `${fromMetadata?.month || sample.month} ${eventEditionYear}` : `${eventEditionYear}`)
  };
};

const renderMetricGrid = ({ matchCount, playerCount, roundCount, ratingCount }) => `
  <section class="player-profile-summary-grid event-series-summary" aria-label="Event edition summary">
    <article class="player-profile-stat">
      <span>Singles matches</span>
      <strong>${matchCount.toLocaleString("en-GB")}</strong>
    </article>
    <article class="player-profile-stat">
      <span>Players</span>
      <strong>${playerCount.toLocaleString("en-GB")}</strong>
    </article>
    <article class="player-profile-stat">
      <span>Rounds</span>
      <strong>${roundCount.toLocaleString("en-GB")}</strong>
    </article>
    <article class="player-profile-stat">
      <span>Rating moves</span>
      <strong>${ratingCount.toLocaleString("en-GB")}</strong>
    </article>
  </section>
`;

const renderTeamPanel = (score) => {
  if (!score) return "";
  return `
    <section class="panel panel--sport event-edition-team-panel">
      <div class="panel__header">
        <div class="panel__title-row">
          <h2>Team Context</h2>
        </div>
        <p class="muted">Full event final score is not available in the archive yet; this is the singles points split from captured matches.</p>
      </div>
      <div class="event-edition-scoreline">
        <span>${escapeHtml(score.labels[0])}</span>
        <strong>${formatNumber(score.totals[0], Number.isInteger(score.totals[0]) ? 0 : 1)}-${formatNumber(score.totals[1], Number.isInteger(score.totals[1]) ? 0 : 1)}</strong>
        <span>${escapeHtml(score.labels[1])}</span>
      </div>
    </section>
  `;
};

const renderMovementTable = (title, description, rows, playerSlugMap) => `
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
                  <th>Before</th>
                  <th>After</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (row) => `
                      <tr>
                        <td>${renderPlayerLink(row.player, playerSlugMap)}</td>
                        <td>${formatRating(row.before)}</td>
                        <td>${formatRating(row.after)}</td>
                        <td>${formatDelta(row.delta)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="player-profile-unavailable"><p class="muted">Rating movement is unavailable for this edition.</p></div>`
    }
  </section>
`;

const renderMatchList = (matches, playerSlugMap) => `
  <section class="panel panel--sport">
    <div class="panel__header">
      <div class="panel__title-row">
        <h2>Singles Match Results</h2>
      </div>
      <p class="muted">Every captured singles or individual match from this edition.</p>
    </div>
    ${
      matches.length
        ? `
          <div class="table-wrap">
            <table class="rank-table event-edition-match-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Match</th>
                  <th>Result</th>
                  <th>Score</th>
                  <th>Ratings</th>
                  <th>Links</th>
                </tr>
              </thead>
              <tbody>
                ${matches
                  .map(
                    (match) => `
                      <tr>
                        <td>${escapeHtml(match.round || "—")}</td>
                        <td>
                          <div class="event-edition-matchup">
                            <span>${renderFlag(match.player_country)}${renderPlayerLink(match.player, playerSlugMap)}</span>
                            <span>${renderFlag(match.opponent_country)}${renderPlayerLink(match.opponent, playerSlugMap)}</span>
                          </div>
                        </td>
                        <td><span class="${resultClass(match.result)}">${escapeHtml(resultLabel(match))}</span></td>
                        <td>${escapeHtml(match.score || "—")}</td>
                        <td>
                          <div class="event-edition-ratings">
                            <span>${formatRating(match.playerRatingBefore)} → ${formatRating(match.playerRatingAfter)}</span>
                            <span>${formatRating(match.opponentRatingBefore)} → ${formatRating(match.opponentRatingAfter)}</span>
                          </div>
                        </td>
                        <td>${renderHeadToHeadLink(match.player, match.opponent, playerSlugMap)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="player-profile-unavailable"><p class="muted">No matches are available for this edition.</p></div>`
    }
  </section>
`;

const renderEditionPage = ({ seriesConfig, metadata, editionMatches, matchRows, movement, playerSlugMap }) => {
  const players = new Set();
  const rounds = new Set();
  editionMatches.forEach((match) => {
    if (match.player) players.add(match.player);
    if (match.opponent) players.add(match.opponent);
    if (match.round) rounds.add(match.round);
  });
  const teamScore = buildTeamSinglesScore(editionMatches, seriesConfig);
  const gains = movement
    .filter((row) => Number.isFinite(row.delta))
    .slice()
    .sort((a, b) => b.delta - a.delta || a.player.localeCompare(b.player))
    .slice(0, 8);
  const losses = movement
    .filter((row) => Number.isFinite(row.delta))
    .slice()
    .sort((a, b) => a.delta - b.delta || a.player.localeCompare(b.player))
    .slice(0, 8);

  eventEditionRoot.innerHTML = `
    <section class="sport-band sport-band--compact event-series-hero">
      <div class="sport-band__content">
        <div class="sport-band__copy">
          <p class="sport-band__eyebrow">Event Edition</p>
          <h1>${escapeHtml(`${seriesConfig.name} ${eventEditionYear}`)}</h1>
          <p>${escapeHtml(seriesConfig.description)}</p>
          <div class="event-series-coverage">
            <span class="event-series-status event-series-status--${slugify(seriesConfig.coverage)}">${escapeHtml(seriesConfig.coverage)}</span>
            <span>${escapeHtml(metadata.dateLabel || `${eventEditionYear}`)}</span>
          </div>
          <div class="event-edition-meta">
            <span>Date: ${escapeHtml(metadata.dateLabel || "Unavailable")}</span>
            <span>Venue: ${escapeHtml(metadata.venue || "Unavailable")}</span>
          </div>
          <a class="profile-back-link" href="/events/${encodeURIComponent(eventSeriesSlug)}/">Back to ${escapeHtml(seriesConfig.name)}</a>
        </div>
      </div>
    </section>
    <main class="layout layout--sport event-series-layout">
      ${renderMetricGrid({
        matchCount: uniqueMatches(editionMatches).length,
        playerCount: players.size,
        roundCount: rounds.size,
        ratingCount: movement.length
      })}
      ${renderTeamPanel(teamScore)}
      <div class="event-series-grid">
        ${renderMovementTable("Biggest Rating Gains", "Largest Elo gains across this edition, derived from the shared rating timeline.", gains, playerSlugMap)}
        ${renderMovementTable("Biggest Rating Losses", "Largest Elo drops across this edition, derived from the shared rating timeline.", losses, playerSlugMap)}
      </div>
      ${renderMatchList(matchRows, playerSlugMap)}
    </main>
  `;
};

const renderState = (title, message, seriesName = "events") => {
  const href = eventSeriesSlug ? `/events/${encodeURIComponent(eventSeriesSlug)}/` : "/events.html";
  eventEditionRoot.innerHTML = `
    <section class="panel panel--sport player-profile__state">
      <p class="sport-band__eyebrow">Event Edition</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">${escapeHtml(message)}</p>
      <a class="profile-back-link" href="${href}">Back to ${escapeHtml(seriesName)}</a>
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

const initEventEdition = async () => {
  if (!eventEditionRoot) return;
  setupNav();
  const seriesConfig = SERIES_CONFIG[eventSeriesSlug];
  if (!seriesConfig || !Number.isFinite(eventEditionYear)) {
    renderState("Event edition not found", "This event edition is not available in the matchplay archive yet.");
    return;
  }

  try {
    const [data, playersData, eventsData] = await Promise.all([
      fetch("/data.json").then((response) => {
        if (!response.ok) throw new Error("Unable to load match data");
        return response.json();
      }),
      fetch("/players-data.json")
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      fetch("/events-data.json")
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
    ]);
    const allMatches = (data.matches || []).filter((match) => match && match.result !== "not played");
    const editionMatches = allMatches.filter(
      (match) => getSeriesSlug(match.event) === eventSeriesSlug && Number(match.year) === eventEditionYear
    );
    if (editionMatches.length === 0) {
      renderState(seriesConfig.name, "No matches are currently available for this event edition.", seriesConfig.name);
      return;
    }

    const playerSlugMap = new Map((playersData?.players || []).map((player) => [player.name, player.slug]));
    const metadata = buildEditionMetadata(eventsData, editionMatches);
    const { matches: matchRows, movement } = buildMatchRows(allMatches, editionMatches);
    renderEditionPage({ seriesConfig, metadata, editionMatches, matchRows, movement, playerSlugMap });
  } catch (error) {
    console.error(error);
    renderState("Event edition unavailable", "The event edition data could not be loaded. Please try again later.", seriesConfig.name);
  }
};

initEventEdition();
