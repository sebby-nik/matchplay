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

const EVENT_ORDER = ["WGC Match Play", "Olympics", "Presidents Cup", "Seve Trophy", "Ryder Cup"];
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

const FIXED_LEADER_NAME = "Kevin Kisner";
const CALIBRATION_BIN = 25;
const CALIBRATION_MIN_MATCHES = 8;
const MATCHPLAY_MODEL = window.MatchplayModel;

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
const normalize = (value) =>
  MATCHPLAY_MODEL && typeof MATCHPLAY_MODEL.normalizeName === "function"
    ? MATCHPLAY_MODEL.normalizeName(value)
    : String(value || "").toLowerCase();

const flagFromCountry = (code) => {
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
      (item) => `<span class="multi-pill" title="${item.replace(/\"/g, "&quot;")}">${item}</span>`
    )
    .join("");
  const more =
    extra > 0
      ? `<span class="multi-pill multi-pill--more" title="${items.join(", ").replace(/\"/g, "&quot;")}">+${extra}</span>`
      : "";
  return `
    <span class="multi-summary__chips">${chips}${more}</span>
    <button class="summary-clear" type="button" data-clear="${type}">×</button>
  `;
};

const renderSparkline = (values, className = "", label = "") => {
  if (!values || values.length < 2) return "";
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

const getOutcomeProbabilityFromRatings = (rating, opponentRating) => {
  if (!MATCHPLAY_MODEL || !MATCHPLAY_MODEL.getCalibratedOutcomeProbability) {
    const baseWin = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
    return { win: baseWin, draw: 0, loss: 1 - baseWin, source: "elo" };
  }
  return MATCHPLAY_MODEL.getCalibratedOutcomeProbability(rating, opponentRating, outcomeCalibration, {
    calibrationBin: CALIBRATION_BIN,
    calibrationMinMatches: CALIBRATION_MIN_MATCHES
  });
};

const computeRatings = (matches) => {
  if (!MATCHPLAY_MODEL || !MATCHPLAY_MODEL.computeRatingsAndCalibration) {
    outcomeCalibration = null;
    return [];
  }
  const computed = MATCHPLAY_MODEL.computeRatingsAndCalibration(matches, {
    eventOrder: EVENT_ORDER,
    monthOrder: MONTH_ORDER,
    roundOrder: ROUND_ORDER,
    baseRating: 1000,
    yearDecay: 0.99,
    calibrationBin: CALIBRATION_BIN,
    calibrationPrior: 1
  });
  outcomeCalibration = computed.calibration;
  if (typeof window !== "undefined") {
    window.matchplayOutcomeCalibration = outcomeCalibration;
    window.getOutcomeProbabilityFromRatings = getOutcomeProbabilityFromRatings;
  }
  return computed.ratings;
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

const getFixedLeaderPlayer = () => {
  const ratings = getCachedRatings();
  return ratings.find((player) => player.name === FIXED_LEADER_NAME) || null;
};

const formatDelta = (delta) => {
  const value = Math.round(delta);
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "0";
};

const getDisplayMatchList = (player) => {
  if (selectedEvents.size === 0) return player.matchList;
  return player.matchList.filter((match) => selectedEvents.has(match.event));
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
            <strong>${match.event} ${match.year}</strong> — ${match.opponent}
            <div class="meta">${match.round || "Singles"}</div>
          </div>
          <div>
            <span class="rating-delta ${deltaClass}">${deltaValue}</span>
            <div class="match-result">${label}</div>
            <span class="meta">${match.score || ""}</span>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="player-detail">
      <h3>${flag ? `${flag} ` : ""}${player.name}</h3>
      <div class="detail-meta">${player.displayMatches ?? player.matches} matches • ${player.displayWins ?? player.wins}-${player.displayDraws ?? player.draws}-${player.displayLosses ?? player.losses}</div>
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

  players.forEach((player) => {
    const row = document.createElement("tr");
    row.dataset.player = player.name;
    const flag = flagFromCountry(player.country);
    row.innerHTML = `
      <td>${player.rank}</td>
      <td>${player.name}${flag ? ` <span class="flag">${flag}</span>` : ""}</td>
      <td>${Math.round(player.rating)}</td>
      <td>${player.displayMatches ?? player.matches}</td>
      <td>${player.displayWins ?? player.wins}-${player.displayDraws ?? player.draws}-${player.displayLosses ?? player.losses}</td>
      <td title="Peak rating: ${Math.round(player.peak)}">
        <div class="trend-cell">
          ${renderSparkline(player.history, "trend-sparkline", `Peak rating: ${Math.round(player.peak)}`)}
        </div>
      </td>
    `;
    row.addEventListener("click", () => renderPlayerDetail(player, row));
    ratingBody.append(row);
  });
};

const sortPlayers = (players) => {
  const sorted = players.slice().sort((a, b) => {
    const dir = currentSort.direction === "asc" ? 1 : -1;
    if (currentSort.key === "name") return a.name.localeCompare(b.name) * dir;
    if (currentSort.key === "matches") {
      return ((a.displayMatches ?? a.matches) - (b.displayMatches ?? b.matches)) * dir;
    }
    if (currentSort.key === "trend") return (a.peak - b.peak) * dir;
    if (currentSort.key === "wdl") {
      const aRecord = (a.displayWins ?? a.wins) * 3 + (a.displayDraws ?? a.draws);
      const bRecord = (b.displayWins ?? b.wins) * 3 + (b.displayDraws ?? b.draws);
      return (aRecord - bRecord) * dir;
    }
    if (currentSort.key === "rank") return (a.rank - b.rank) * dir;
    return (a.rating - b.rating) * dir;
  });
  return sorted;
};

const updateSortIndicators = () => {
  tableHeaders.forEach((th) => {
    th.classList.remove("is-sorted", "is-sorted-asc", "is-sorted-desc");
    if (th.dataset.sort === currentSort.key) {
      th.classList.add("is-sorted");
      th.classList.add(currentSort.direction === "asc" ? "is-sorted-asc" : "is-sorted-desc");
    }
  });
};

const updateEventSummary = () => {
  if (selectedEvents.size === 0) {
    eventSummary.textContent = "All events";
    return;
  }
  const list = Array.from(selectedEvents);
  eventSummary.innerHTML = renderSummaryChips(list, "event");
};

const syncEventCheckboxes = () => {
  eventFilter.querySelectorAll("input[type=\"checkbox\"]").forEach((cb) => {
    if (cb === eventSelectAll) return;
    cb.checked = selectedEvents.has(cb.value);
  });
  eventSelectAll.checked = selectedEvents.size > 0 && selectedEvents.size === allEvents.length;
};


const updateCountrySummary = () => {
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
    button.innerHTML = `<span>${chip.label}</span><span class="filter-chip__close">×</span>`;
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
    chip.innerHTML = `<span>${name}</span><button type="button" aria-label="Remove ${name}">×</button>`;
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
  const source = availablePlayers.length ? availablePlayers : allPlayers;
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
    .map((name) => `<div class="player-suggestion" data-name="${name}">${name}</div>`)
    .join("");
  playerSuggestions.classList.add("is-open");
};

const addPlayerSelection = (name) => {
  if (!name) return;
  selectedPlayers.add(name);
  renderPlayerChips();
  searchInput.value = "";
  showPlayerSuggestions("");
  applyFilters();
};

const applyFilters = () => {
  const minMatches = Number(minMatchesInput.value || 1);
  const ratings = getCachedRatings();
  const currentYear = new Date().getFullYear();
  const activeCutoff = currentYear - 5;

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
    .sort((a, b) => b.rating - a.rating)
    .map((player, index) => ({ ...player, rank: index + 1 }));

  const sorted = sortPlayers(baseRanked);
  availablePlayers = baseRanked.map((player) => player.name);
  const searched =
    selectedPlayers.size > 0
      ? sorted.filter((player) => selectedPlayers.has(player.name))
      : sorted;

  currentPlayers = searched;
  if (summary) summary.textContent = `${searched.length} players`;
  updateLeaderCard(getFixedLeaderPlayer() || searched[0]);
  renderFilterChips();
  renderPlayerChips();
  renderTable(searched);
  updateSortIndicators();

  document.querySelectorAll(".detail-row").forEach((node) => node.remove());
  document.querySelectorAll("tr.is-open").forEach((node) => node.classList.remove("is-open"));
};

const updateLeaderCard = (player) => {
  if (!ratingLeaderName || !ratingLeaderRating || !ratingLeaderMeta || !ratingLeaderStats) return;
  if (!player) {
    ratingLeaderName.textContent = "—";
    ratingLeaderRating.textContent = "Rating —";
    ratingLeaderMeta.textContent = "";
    ratingLeaderStats.innerHTML = "";
    return;
  }

  ratingLeaderName.textContent = player.name;
  ratingLeaderRating.textContent = `Rating ${Math.round(player.rating)}`;
  ratingLeaderMeta.textContent = `${player.matches} matches · ${player.wins}-${player.draws}-${player.losses} W-D-L`;
  ratingLeaderStats.innerHTML = `
    <span>Peak ${Math.round(player.peak)}</span>
  `;
};

const populateFilters = () => {
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

  if (allMatches.length > 0) {
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
  if (currentSort.key === key) {
    currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
  } else {
    currentSort = { key, direction: "desc" };
  }
  const sorted = sortPlayers(currentPlayers);
  renderTable(sorted);
  updateSortIndicators();
};

fetch("data.json")
  .then((res) => res.json())
  .then((data) => {
    allMatches = (data.matches || []).filter((match) => match.result !== "not played");
    allPlayers = Array.from(new Set(allMatches.map((match) => match.player))).sort();
    ratingsCache = new Map();
    populateFilters();
    applyFilters();
    updateSortIndicators();
  });

const toggleFilters = (open) => {
  document.body.classList.toggle("filters-open", open);
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
  dropdown.addEventListener("toggle", () => {
    if (dropdown.open) {
      if (dropdown === eventDropdown) {
        syncEventCheckboxes();
        eventSearch.value = "";
        eventFilter.querySelectorAll(".country-filter__item").forEach((item) => {
          item.classList.remove("is-hidden");
        });
      }
      if (dropdown === countryDropdown) {
        syncCountryCheckboxes();
        countrySearch.value = "";
        countryFilter.querySelectorAll(".country-filter__item").forEach((item) => {
          item.classList.remove("is-hidden");
        });
      }
    }
  });
});

eventSearch.addEventListener("input", () => {
  const query = normalize(eventSearch.value.trim());
  eventFilter.querySelectorAll(".country-filter__item").forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.classList.toggle("is-hidden", query && !text.includes(query));
  });
});

eventSelectAll.addEventListener("change", () => {
  if (eventSelectAll.checked) {
    selectedEvents = new Set(allEvents);
  } else {
    selectedEvents = new Set();
  }
  syncEventCheckboxes();
  updateEventSummary();
  applyFilters();
});

countrySearch.addEventListener("input", () => {
  const query = normalize(countrySearch.value.trim());
  countryFilter.querySelectorAll(".country-filter__item").forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.classList.toggle("is-hidden", query && !text.includes(query));
  });
});

countrySelectAll.addEventListener("change", () => {
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
    const exact = availablePlayers.find((name) => name.toLowerCase() === query);
    if (exact) {
      addPlayerSelection(exact);
    }
  });
}

if (playerSuggestions) {
  playerSuggestions.addEventListener("mousedown", (event) => {
    const target = event.target.closest(".player-suggestion");
    if (!target) return;
    event.preventDefault();
    addPlayerSelection(target.dataset.name);
  });
}

document.addEventListener("click", (event) => {
  if (!playerSuggestions) return;
  if (event.target.closest(".player-search")) return;
  playerSuggestions.classList.remove("is-open");
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
  th.addEventListener("click", () => handleSort(th.dataset.sort));
});

const closeDropdownsOnClickOutside = (event) => {
  [eventDropdown, countryDropdown].forEach((dropdown) => {
    if (!dropdown.open) return;
    if (dropdown.contains(event.target)) return;
    dropdown.open = false;
  });
};

document.addEventListener("click", closeDropdownsOnClickOutside);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  [eventDropdown, countryDropdown].forEach((dropdown) => {
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
