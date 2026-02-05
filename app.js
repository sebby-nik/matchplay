const eventFilter = document.getElementById("eventFilter");
const eventSummary = document.getElementById("eventSummary");
const eventSearch = document.getElementById("eventSearch");
const eventSelectAll = document.getElementById("eventSelectAll");
const eventDropdown = document.getElementById("eventDropdown");
const yearFilter = document.getElementById("yearFilter");
const yearSummary = document.getElementById("yearSummary");
const yearSearch = document.getElementById("yearSearch");
const yearSelectAll = document.getElementById("yearSelectAll");
const yearDropdown = document.getElementById("yearDropdown");
const searchInput = document.getElementById("searchInput");
const playerChips = document.getElementById("playerChips");
const playerSuggestions = document.getElementById("playerSuggestions");
const minMatchesInput = document.getElementById("minMatches");
const minMatchesValue = document.getElementById("minMatchesValue");
const activeOnlyToggle = document.getElementById("activeOnlyToggle");
const summary = document.getElementById("summary");
const filterChips = document.getElementById("filterChips");
const clearAllFilters = document.getElementById("clearAllFilters");
const rankBody = document.getElementById("rankBody");
const countryFilter = document.getElementById("countryFilter");
const countrySummary = document.getElementById("countrySummary");
const countrySearch = document.getElementById("countrySearch");
const countrySelectAll = document.getElementById("countrySelectAll");
const countryDropdown = document.getElementById("countryDropdown");

let allMatches = [];
let currentSort = { key: "points", direction: "desc" };
let currentPlayers = [];
let selectedEvents = new Set();
let allEvents = [];
let selectedYears = new Set();
let allYears = [];
let selectedCountries = new Set();
let allCountries = [];
let selectedPlayers = new Set();
let availablePlayers = [];
let allPlayers = [];

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

const calculatePlayers = (matches) => {
  const stats = new Map();

  matches.forEach((match) => {
    const key = match.player;
    if (!stats.has(key)) {
      stats.set(key, {
        name: match.player,
        country: match.player_country || "",
        matches: 0,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        matchList: []
      });
    }

    const player = stats.get(key);
    player.matches += 1;
    player.points += match.points;
    if (match.result === "win") player.wins += 1;
    if (match.result === "halved") player.draws += 1;
    if (match.result === "loss") player.losses += 1;

    player.matchList.push(match);
  });

  return Array.from(stats.values()).map((player) => ({
    ...player,
    ppm: player.matches ? player.points / player.matches : 0,
    lastYear: player.matchList.reduce(
      (max, match) => (match.year > max ? match.year : max),
      0
    )
  }));
};

const renderTable = (players) => {
  rankBody.innerHTML = "";
  const maxPpm = Math.max(
    ...players.map((player) => (player.matches < 3 ? 0 : player.ppm)),
    0
  );

  players.forEach((player, index) => {
    const row = document.createElement("tr");
    row.dataset.player = player.name;

    const flag = flagFromCountry(player.country);
    const ppmValue = player.matches < 3 ? null : player.ppm;
    const ppmPercent = ppmValue && maxPpm ? Math.max((ppmValue / maxPpm) * 100, 8) : 0;
    const ppmClass =
      ppmValue === null
        ? "ppm-bar__fill--na"
        : ppmValue / maxPpm >= 0.67
          ? "ppm-bar__fill--high"
          : ppmValue / maxPpm >= 0.34
            ? "ppm-bar__fill--mid"
            : "ppm-bar__fill--low";
    row.innerHTML = `
      <td>${player.rank ?? index + 1}</td>
      <td>${player.name}</td>
      <td>${flag ? `<span class=\"flag\">${flag}</span>` : ""}</td>
      <td>${player.matches}</td>
      <td>${player.points.toFixed(1)}</td>
      <td>${player.wins}-${player.draws}-${player.losses}</td>
      <td>
        <div class="ppm-cell">
          <span>${player.matches < 3 ? "N/A" : player.ppm.toFixed(2)}</span>
          <span class="ppm-bar">
            <span class="ppm-bar__fill ${ppmClass}" style="width: ${ppmPercent}%"></span>
          </span>
        </div>
      </td>
    `;

    row.addEventListener("click", () => renderPlayerDetail(player, row));
    rankBody.append(row);
  });
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

const renderPlayerDetailContent = (player) => {
  const flag = flagFromCountry(player.country);
  const matches = player.matchList
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
      return `
        <div class="match-row ${resultClass}">
          <div>
            <strong>${match.event} ${match.year}</strong> — ${match.opponent}
            <div class="meta">${match.round || "Singles"}</div>
          </div>
          <div>
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
      <div class="detail-meta">${player.matches} matches • ${player.points.toFixed(1)} points • ${player.wins}-${player.draws}-${player.losses}</div>
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
  cell.colSpan = 7;
  cell.innerHTML = renderPlayerDetailContent(player);
  detailRow.append(cell);
  row.after(detailRow);
  row.classList.add("is-open");
};
const sortPlayers = (players) => {
  const sorted = players.slice().sort((a, b) => {
    const dir = currentSort.direction === "asc" ? 1 : -1;
    if (currentSort.key === "name") return a.name.localeCompare(b.name) * dir;
    if (currentSort.key === "country") return a.country.localeCompare(b.country) * dir;
    if (currentSort.key === "record") {
      const aRecord = a.wins * 3 + a.draws;
      const bRecord = b.wins * 3 + b.draws;
      return (aRecord - bRecord) * dir;
    }
    if (currentSort.key === "ppm") {
      const aValue = a.matches < 3 ? -Infinity : a.ppm;
      const bValue = b.matches < 3 ? -Infinity : b.ppm;
      return (aValue - bValue) * dir;
    }
    return (a[currentSort.key] - b[currentSort.key]) * dir;
  });

  return sorted;
};

const applyFilters = () => {
  const minMatches = Number(minMatchesInput.value || 1);

  let matches = allMatches.slice();

  if (selectedEvents.size > 0) {
    matches = matches.filter((match) => selectedEvents.has(match.event));
  }

  if (selectedYears.size > 0) {
    matches = matches.filter((match) => selectedYears.has(String(match.year)));
  }

  if (selectedCountries.size > 0) {
    matches = matches.filter((match) => selectedCountries.has(match.player_country));
  }

  const currentYear = new Date().getFullYear();
  const activeCutoff = currentYear - 5;
  const players = calculatePlayers(matches).filter((player) =>
    activeOnlyToggle && activeOnlyToggle.checked
      ? player.lastYear >= activeCutoff
      : true
  );
  const filteredPlayers = players.filter((player) => player.matches >= minMatches);
  const sorted = sortPlayers(filteredPlayers).map((player, index) => ({
    ...player,
    rank: index + 1
  }));

  availablePlayers = sorted.map((player) => player.name);
  const searched =
    selectedPlayers.size > 0
      ? sorted.filter((player) => selectedPlayers.has(player.name))
      : sorted;

  currentPlayers = searched;
  summary.textContent = `${searched.length} players • ${matches.length} matches • Min ${minMatches}+`;
  renderFilterChips();
  renderPlayerChips();
  renderTable(searched);
  updateSortIndicators();

  document.querySelectorAll(".detail-row").forEach((node) => node.remove());
  document.querySelectorAll("tr.is-open").forEach((node) => node.classList.remove("is-open"));
};

const renderFilterChips = () => {
  if (!filterChips) return;
  filterChips.innerHTML = "";

  const chips = [];

  selectedEvents.forEach((event) => {
    chips.push({ type: "event", label: event, value: event });
  });

  selectedYears.forEach((year) => {
    chips.push({ type: "year", label: year, value: year });
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
    button.innerHTML = `<span>${chip.label}</span><span class=\"filter-chip__close\">×</span>`;
    button.addEventListener("click", () => {
      if (chip.type === "event") {
        selectedEvents.delete(chip.value);
        updateEventSummary();
        syncEventCheckboxes();
      }
      if (chip.type === "year") {
        selectedYears.delete(chip.value);
        updateYearSummary();
        syncYearCheckboxes();
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
  eventSelectAll.checked =
    selectedEvents.size > 0 && selectedEvents.size === allEvents.length;
};

const updateYearSummary = () => {
  if (selectedYears.size === 0) {
    yearSummary.textContent = "All years";
    return;
  }
  const list = Array.from(selectedYears).sort((a, b) => Number(b) - Number(a));
  yearSummary.innerHTML = renderSummaryChips(list, "year");
};

const syncYearCheckboxes = () => {
  yearFilter.querySelectorAll("input[type=\"checkbox\"]").forEach((cb) => {
    if (cb === yearSelectAll) return;
    cb.checked = selectedYears.has(cb.value);
  });
  yearSelectAll.checked =
    selectedYears.size > 0 && selectedYears.size === allYears.length;
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

  const years = Array.from(new Set(allMatches.map((match) => match.year)))
    .sort((a, b) => b - a)
    .map((year) => String(year));
  allYears = years.slice();
  yearFilter.innerHTML = "";
  years.forEach((year) => {
    const id = `year-${year}`;
    const item = document.createElement("label");
    item.className = "country-filter__item";
    item.innerHTML = `
      <input type="checkbox" value="${year}" id="${id}" />
      <span class="country-filter__text">${year}</span>
    `;
    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedYears.add(year);
      } else {
        selectedYears.delete(year);
      }
      updateYearSummary();
      syncYearCheckboxes();
      applyFilters();
    });
    yearFilter.append(item);
  });
  updateYearSummary();

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
    const matchCounts = calculatePlayers(allMatches).map((player) => player.matches);
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
    allMatches = data.matches || [];
    allPlayers = Array.from(new Set(allMatches.map((match) => match.player))).sort();
    populateFilters();
    applyFilters();
    updateSortIndicators();
  });

[eventDropdown, yearDropdown, countryDropdown].forEach((dropdown) => {
  dropdown.addEventListener("toggle", () => {
    if (dropdown.open) {
      if (dropdown === eventDropdown) {
        syncEventCheckboxes();
        eventSearch.value = "";
        eventFilter.querySelectorAll(".country-filter__item").forEach((item) => {
          item.classList.remove("is-hidden");
        });
      }
      if (dropdown === yearDropdown) {
        syncYearCheckboxes();
        yearSearch.value = "";
        yearFilter.querySelectorAll(".country-filter__item").forEach((item) => {
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

yearSearch.addEventListener("input", () => {
  const query = normalize(yearSearch.value.trim());
  yearFilter.querySelectorAll(".country-filter__item").forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.classList.toggle("is-hidden", query && !text.includes(query));
  });
});

yearSelectAll.addEventListener("change", () => {
  if (yearSelectAll.checked) {
    selectedYears = new Set(allYears);
  } else {
    selectedYears = new Set();
  }
  syncYearCheckboxes();
  updateYearSummary();
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

bindSummaryClear(yearSummary, () => {
  selectedYears = new Set();
  syncYearCheckboxes();
  updateYearSummary();
  applyFilters();
});

bindSummaryClear(countrySummary, () => {
  selectedCountries = new Set();
  syncCountryCheckboxes();
  updateCountrySummary();
  applyFilters();
});

searchInput.addEventListener("input", applyFilters);
minMatchesInput.addEventListener("input", () => {
  minMatchesValue.textContent = `${minMatchesInput.value}+`;
  applyFilters();
});

if (activeOnlyToggle) {
  activeOnlyToggle.addEventListener("change", applyFilters);
}

if (clearAllFilters) {
  clearAllFilters.addEventListener("click", () => {
    selectedEvents = new Set();
    selectedYears = new Set();
    selectedCountries = new Set();
    selectedPlayers = new Set();
    updateEventSummary();
    updateYearSummary();
    updateCountrySummary();
    syncEventCheckboxes();
    syncYearCheckboxes();
    syncCountryCheckboxes();
    renderPlayerChips();
    applyFilters();
  });
}

document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => handleSort(th.dataset.sort));
});

const updateSortIndicators = () => {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.classList.remove("is-sorted", "is-sorted-asc", "is-sorted-desc");
    if (th.dataset.sort === currentSort.key) {
      th.classList.add("is-sorted");
      th.classList.add(currentSort.direction === "asc" ? "is-sorted-asc" : "is-sorted-desc");
    }
  });
};

const closeDropdownsOnClickOutside = (event) => {
  [eventDropdown, yearDropdown, countryDropdown].forEach((dropdown) => {
    if (!dropdown.open) return;
    if (dropdown.contains(event.target)) return;
    dropdown.open = false;
  });
};

document.addEventListener("click", closeDropdownsOnClickOutside);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  [eventDropdown, yearDropdown, countryDropdown].forEach((dropdown) => {
    dropdown.open = false;
  });
});

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
