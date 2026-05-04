const eventDiscoveryRoot = document.getElementById("eventDiscoveryRoot");
const eventEditionDiscoveryRoot = document.getElementById("eventEditionDiscoveryRoot");
const eventDiscoverySearch = document.getElementById("eventDiscoverySearch");
const eventDiscoveryStatus = document.getElementById("eventDiscoveryStatus");

const DiscoveryStats = globalThis.MatchplayStats;
const DiscoveryUtils = globalThis.MatchplayEvents;

if (!DiscoveryStats || !DiscoveryUtils) {
  throw new Error("Event discovery helpers failed to load.");
}

const { asText, uniqueMatches } = DiscoveryStats;
const { SERIES_CONFIG, getSeriesSlug, slugify } = DiscoveryUtils;

const escapeHtml = (value) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatNumber = (value) =>
  Number.isFinite(value) ? value.toLocaleString("en-GB") : "—";

const SERIES_PRIORITY = [
  "ryder-cup",
  "presidents-cup",
  "wgc-match-play",
  "seve-trophy"
];

const getSeriesName = (slug, matches) => SERIES_CONFIG[slug]?.name || asText(matches[0]?.event, "Unknown event");

const buildSeries = (matches) => {
  const groups = new Map();
  matches.forEach((match) => {
    if (!match || match.result === "not played") return;
    const slug = getSeriesSlug(match.event);
    if (!groups.has(slug)) {
      groups.set(slug, { slug, sourceMatches: [] });
    }
    groups.get(slug).sourceMatches.push(match);
  });

  return Array.from(groups.values())
    .map((group) => {
      const unique = uniqueMatches(group.sourceMatches);
      const editions = new Map();
      const players = new Set();
      group.sourceMatches.forEach((match) => {
        const year = Number(match.year);
        if (Number.isFinite(year)) {
          if (!editions.has(year)) editions.set(year, []);
          editions.get(year).push(match);
        }
        if (match.player) players.add(match.player);
        if (match.opponent) players.add(match.opponent);
      });
      const years = Array.from(editions.keys()).sort((a, b) => b - a);
      const config = SERIES_CONFIG[group.slug] || {};
      return {
        slug: group.slug,
        name: getSeriesName(group.slug, group.sourceMatches),
        description: config.description || "Singles matchplay records represented in the archive.",
        coverage: config.coverage || "Partial",
        coverageNote: config.coverageNote || "Coverage is based on the event data currently represented in the archive.",
        matches: unique.length,
        players: players.size,
        editions: years.length,
        latestYear: years[0] || null,
        years,
        sourceMatches: group.sourceMatches,
        searchText: `${getSeriesName(group.slug, group.sourceMatches)} ${config.coverage || ""}`.toLowerCase()
      };
    })
    .sort((a, b) => {
      if (SERIES_PRIORITY.includes(a.slug) || SERIES_PRIORITY.includes(b.slug)) {
        return (SERIES_PRIORITY.includes(a.slug) ? SERIES_PRIORITY.indexOf(a.slug) : 99) - (SERIES_PRIORITY.includes(b.slug) ? SERIES_PRIORITY.indexOf(b.slug) : 99);
      }
      return b.matches - a.matches || a.name.localeCompare(b.name);
    });
};

const buildFeaturedEditions = (series) =>
  series
    .flatMap((eventSeries) =>
      eventSeries.years.map((year) => {
        const matches = eventSeries.sourceMatches.filter((match) => Number(match.year) === year);
        const players = new Set();
        matches.forEach((match) => {
          if (match.player) players.add(match.player);
          if (match.opponent) players.add(match.opponent);
        });
        return {
          seriesSlug: eventSeries.slug,
          eventName: eventSeries.name,
          coverage: eventSeries.coverage,
          year,
          matches: uniqueMatches(matches).length,
          players: players.size,
          month: matches[0]?.month || ""
        };
      })
    )
    .sort((a, b) => {
      const yearDiff = b.year - a.year;
      if (yearDiff !== 0) return yearDiff;
      const priorityA = SERIES_PRIORITY.includes(a.seriesSlug) ? SERIES_PRIORITY.indexOf(a.seriesSlug) : 99;
      const priorityB = SERIES_PRIORITY.includes(b.seriesSlug) ? SERIES_PRIORITY.indexOf(b.seriesSlug) : 99;
      return priorityA - priorityB || a.eventName.localeCompare(b.eventName);
    })
    .slice(0, 8);

const renderSeriesCard = (series) => `
  <a class="event-discovery-card" href="events/${encodeURIComponent(series.slug)}/" data-event-card data-search="${escapeHtml(series.searchText)}" data-status="${escapeHtml(slugify(series.coverage))}">
    <div class="event-discovery-card__header">
      <span class="event-series-status event-series-status--${slugify(series.coverage)}">${escapeHtml(series.coverage)}</span>
      <span>${series.latestYear ? `Latest: ${series.latestYear}` : "Latest unavailable"}</span>
    </div>
    <h3>${escapeHtml(series.name)}</h3>
    <p>${escapeHtml(series.description)}</p>
    <dl class="event-discovery-card__stats">
      <div>
        <dt>Matches</dt>
        <dd>${formatNumber(series.matches)}</dd>
      </div>
      <div>
        <dt>Editions</dt>
        <dd>${formatNumber(series.editions)}</dd>
      </div>
      <div>
        <dt>Players</dt>
        <dd>${formatNumber(series.players)}</dd>
      </div>
    </dl>
  </a>
`;

const renderEditionCard = (edition) => `
  <a class="event-edition-feature-card" href="events/${encodeURIComponent(edition.seriesSlug)}/${edition.year}/">
    <span class="event-series-status event-series-status--${slugify(edition.coverage)}">${escapeHtml(edition.coverage)}</span>
    <h3>${escapeHtml(`${edition.year} ${edition.eventName}`)}</h3>
    <p>${escapeHtml([edition.month, `${edition.matches} matches`, `${edition.players} players`].filter(Boolean).join(" · "))}</p>
  </a>
`;

const renderDiscovery = (series) => {
  if (!eventDiscoveryRoot || !eventEditionDiscoveryRoot) return;
  eventDiscoveryRoot.innerHTML = series.length
    ? series.map(renderSeriesCard).join("")
    : `<p class="schedule__empty">No event series are available yet.</p>`;

  const editions = buildFeaturedEditions(series);
  eventEditionDiscoveryRoot.innerHTML = editions.length
    ? editions.map(renderEditionCard).join("")
    : `<p class="schedule__empty">No event editions are available yet.</p>`;
};

const applyDiscoveryFilters = () => {
  if (!eventDiscoveryRoot) return;
  const query = asText(eventDiscoverySearch?.value).toLowerCase();
  const status = asText(eventDiscoveryStatus?.value);
  let visibleCount = 0;
  eventDiscoveryRoot.querySelectorAll("[data-event-card]").forEach((card) => {
    const matchesQuery = !query || card.dataset.search.includes(query);
    const matchesStatus = !status || card.dataset.status === status;
    const isVisible = matchesQuery && matchesStatus;
    card.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  let empty = document.getElementById("eventDiscoveryEmpty");
  if (!empty) {
    empty = document.createElement("p");
    empty.id = "eventDiscoveryEmpty";
    empty.className = "schedule__empty";
    empty.textContent = "No event series match those filters.";
    eventDiscoveryRoot.after(empty);
  }
  empty.hidden = visibleCount > 0;
};

const initEventsDiscovery = async () => {
  if (!eventDiscoveryRoot) return;
  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error("Unable to load event data");
    const data = await response.json();
    const series = buildSeries(data.matches || []);
    renderDiscovery(series);
    eventDiscoverySearch?.addEventListener("input", applyDiscoveryFilters);
    eventDiscoveryStatus?.addEventListener("change", applyDiscoveryFilters);
  } catch (error) {
    console.error(error);
    eventDiscoveryRoot.innerHTML = `<p class="schedule__empty">Unable to load event discovery data.</p>`;
    if (eventEditionDiscoveryRoot) {
      eventEditionDiscoveryRoot.innerHTML = `<p class="schedule__empty">Unable to load featured editions.</p>`;
    }
  }
};

initEventsDiscovery();
