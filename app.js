const eventFilter = document.getElementById("eventFilter");
const eventSummary = document.getElementById("eventSummary");
const eventSearch = document.getElementById("eventSearch");
const eventSelectAll = document.getElementById("eventSelectAll");
const eventApply = document.getElementById("eventApply");
const eventCancel = document.getElementById("eventCancel");
const eventClear = document.getElementById("eventClear");
const eventDropdown = document.getElementById("eventDropdown");
const yearFilter = document.getElementById("yearFilter");
const yearSummary = document.getElementById("yearSummary");
const yearSearch = document.getElementById("yearSearch");
const yearSelectAll = document.getElementById("yearSelectAll");
const yearApply = document.getElementById("yearApply");
const yearCancel = document.getElementById("yearCancel");
const yearClear = document.getElementById("yearClear");
const yearDropdown = document.getElementById("yearDropdown");
const searchInput = document.getElementById("searchInput");
const minMatchesInput = document.getElementById("minMatches");
const minMatchesValue = document.getElementById("minMatchesValue");
const summary = document.getElementById("summary");
const filterChips = document.getElementById("filterChips");
const clearAllFilters = document.getElementById("clearAllFilters");
const rankBody = document.getElementById("rankBody");
const countryFilter = document.getElementById("countryFilter");
const countrySummary = document.getElementById("countrySummary");
const countrySearch = document.getElementById("countrySearch");
const countrySelectAll = document.getElementById("countrySelectAll");
const countryApply = document.getElementById("countryApply");
const countryCancel = document.getElementById("countryCancel");
const countryClear = document.getElementById("countryClear");
const countryDropdown = document.getElementById("countryDropdown");

let allMatches = [];
let currentSort = { key: "matches", direction: "desc" };
let currentPlayers = [];
let selectedEvents = new Set();
let pendingEvents = new Set();
let allEvents = [];
let selectedYears = new Set();
let pendingYears = new Set();
let allYears = [];
let selectedCountries = new Set();
let pendingCountries = new Set();
let allCountries = [];

const normalize = (value) => value.toLowerCase();

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
    PH: "Philippines"
  };
  return names[code] || code;
};

const renderSummaryChips = (items, type) => {
  if (items.length === 0) return "";
  const chips = items
    .map(
      (item) => `<span class="multi-pill" title="${item.replace(/\"/g, "&quot;")}">${item}</span>`
    )
    .join("");
  return `
    <span class="multi-summary__chips">${chips}</span>
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
    ppm: player.matches ? player.points / player.matches : 0
  }));
};

const renderTable = (players) => {
  rankBody.innerHTML = "";

  players.forEach((player, index) => {
    const row = document.createElement("tr");
    row.dataset.player = player.name;

    const flag = flagFromCountry(player.country);
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${player.name}</td>
      <td>${flag ? `<span class=\"flag\">${flag}</span>` : ""}</td>
      <td>${player.matches}</td>
      <td>${player.points.toFixed(1)}</td>
      <td>${player.wins}-${player.draws}-${player.losses}</td>
      <td>${player.matches < 3 ? "N/A" : player.ppm.toFixed(2)}</td>
    `;

    row.addEventListener("click", () => renderPlayerDetail(player, row));
    rankBody.append(row);
  });
};

const updateCountrySummary = () => {
  if (selectedCountries.size === 0) {
    countrySummary.textContent = "All countries";
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
    cb.checked = pendingCountries.has(cb.value);
  });
  countrySelectAll.checked =
    pendingCountries.size > 0 && pendingCountries.size === allCountries.length;
};

const applyCountryFilter = () => {
  selectedCountries = new Set(pendingCountries);
  updateCountrySummary();
  applyFilters();
};

const renderPlayerDetailContent = (player) => {
  const flag = flagFromCountry(player.country);
  const matches = player.matchList
    .slice()
    .sort((a, b) => b.year - a.year)
    .map((match) => {
      const label = match.result === "halved" ? "Halved" : match.result.toUpperCase();
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
    return (a[currentSort.key] - b[currentSort.key]) * dir;
  });

  return sorted;
};

const applyFilters = () => {
  const query = normalize(searchInput.value.trim());
  const minMatches = Number(minMatchesInput.value || 1);

  let matches = allMatches.slice();

  if (selectedEvents.size > 0) {
    matches = matches.filter((match) => selectedEvents.has(match.event));
  }

  if (selectedYears.size > 0) {
    matches = matches.filter((match) => selectedYears.has(String(match.year)));
  }

  if (query) {
    matches = matches.filter((match) =>
      match.player.toLowerCase().includes(query)
    );
  }

  if (selectedCountries.size > 0) {
    matches = matches.filter((match) => selectedCountries.has(match.player_country));
  }

  const players = calculatePlayers(matches);
  const filteredPlayers = players.filter((player) => player.matches >= minMatches);
  const sorted = sortPlayers(filteredPlayers);

  currentPlayers = sorted;
  summary.textContent = `${sorted.length} players • ${matches.length} matches • Min ${minMatches}+`;
  renderFilterChips();
  renderTable(sorted);

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
        pendingEvents = new Set(selectedEvents);
        updateEventSummary();
        syncEventCheckboxes();
      }
      if (chip.type === "year") {
        selectedYears.delete(chip.value);
        pendingYears = new Set(selectedYears);
        updateYearSummary();
        syncYearCheckboxes();
      }
      if (chip.type === "country") {
        selectedCountries.delete(chip.value);
        pendingCountries = new Set(selectedCountries);
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
    cb.checked = pendingEvents.has(cb.value);
  });
  eventSelectAll.checked =
    pendingEvents.size > 0 && pendingEvents.size === allEvents.length;
};

const applyEventFilter = () => {
  selectedEvents = new Set(pendingEvents);
  updateEventSummary();
  applyFilters();
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
    cb.checked = pendingYears.has(cb.value);
  });
  yearSelectAll.checked =
    pendingYears.size > 0 && pendingYears.size === allYears.length;
};

const applyYearFilter = () => {
  selectedYears = new Set(pendingYears);
  updateYearSummary();
  applyFilters();
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
      <span>${event}</span>
    `;
    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        pendingEvents.add(event);
      } else {
        pendingEvents.delete(event);
      }
      eventSelectAll.checked =
        pendingEvents.size > 0 && pendingEvents.size === allEvents.length;
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
      <span>${year}</span>
    `;
    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        pendingYears.add(year);
      } else {
        pendingYears.delete(year);
      }
      yearSelectAll.checked =
        pendingYears.size > 0 && pendingYears.size === allYears.length;
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
      <span>${flag ? `${flag} ` : ""}${name}</span>
    `;
    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        pendingCountries.add(code);
      } else {
        pendingCountries.delete(code);
      }
      countrySelectAll.checked =
        pendingCountries.size > 0 && pendingCountries.size === allCountries.length;
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
};

fetch("data.json")
  .then((res) => res.json())
  .then((data) => {
    allMatches = data.matches || [];
    populateFilters();
    applyFilters();
  });

[eventDropdown, yearDropdown, countryDropdown].forEach((dropdown) => {
  dropdown.addEventListener("toggle", () => {
    if (dropdown.open) {
      if (dropdown === eventDropdown) {
        pendingEvents = new Set(selectedEvents);
        syncEventCheckboxes();
        eventSearch.value = "";
        eventFilter.querySelectorAll(".country-filter__item").forEach((item) => {
          item.classList.remove("is-hidden");
        });
      }
      if (dropdown === yearDropdown) {
        pendingYears = new Set(selectedYears);
        syncYearCheckboxes();
        yearSearch.value = "";
        yearFilter.querySelectorAll(".country-filter__item").forEach((item) => {
          item.classList.remove("is-hidden");
        });
      }
      if (dropdown === countryDropdown) {
        pendingCountries = new Set(selectedCountries);
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
    pendingEvents = new Set(allEvents);
  } else {
    pendingEvents = new Set();
  }
  syncEventCheckboxes();
});

eventApply.addEventListener("click", () => {
  applyEventFilter();
  eventDropdown.open = false;
});

eventCancel.addEventListener("click", () => {
  pendingEvents = new Set(selectedEvents);
  syncEventCheckboxes();
  eventDropdown.open = false;
});

eventClear.addEventListener("click", () => {
  pendingEvents = new Set();
  selectedEvents = new Set();
  syncEventCheckboxes();
  updateEventSummary();
  applyFilters();
  eventDropdown.open = false;
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
    pendingYears = new Set(allYears);
  } else {
    pendingYears = new Set();
  }
  syncYearCheckboxes();
});

yearApply.addEventListener("click", () => {
  applyYearFilter();
  yearDropdown.open = false;
});

yearCancel.addEventListener("click", () => {
  pendingYears = new Set(selectedYears);
  syncYearCheckboxes();
  yearDropdown.open = false;
});

yearClear.addEventListener("click", () => {
  pendingYears = new Set();
  selectedYears = new Set();
  syncYearCheckboxes();
  updateYearSummary();
  applyFilters();
  yearDropdown.open = false;
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
    pendingCountries = new Set(allCountries);
  } else {
    pendingCountries = new Set();
  }
  syncCountryCheckboxes();
});

countryApply.addEventListener("click", () => {
  applyCountryFilter();
  countryDropdown.open = false;
});

countryCancel.addEventListener("click", () => {
  pendingCountries = new Set(selectedCountries);
  syncCountryCheckboxes();
  countryDropdown.open = false;
});

countryClear.addEventListener("click", () => {
  pendingCountries = new Set();
  selectedCountries = new Set();
  syncCountryCheckboxes();
  updateCountrySummary();
  applyFilters();
  countryDropdown.open = false;
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
  pendingEvents = new Set();
  syncEventCheckboxes();
  updateEventSummary();
  applyFilters();
});

bindSummaryClear(yearSummary, () => {
  selectedYears = new Set();
  pendingYears = new Set();
  syncYearCheckboxes();
  updateYearSummary();
  applyFilters();
});

bindSummaryClear(countrySummary, () => {
  selectedCountries = new Set();
  pendingCountries = new Set();
  syncCountryCheckboxes();
  updateCountrySummary();
  applyFilters();
});

searchInput.addEventListener("input", applyFilters);
minMatchesInput.addEventListener("input", () => {
  minMatchesValue.textContent = `${minMatchesInput.value}+`;
  applyFilters();
});

if (clearAllFilters) {
  clearAllFilters.addEventListener("click", () => {
    selectedEvents = new Set();
    pendingEvents = new Set();
    selectedYears = new Set();
    pendingYears = new Set();
    selectedCountries = new Set();
    pendingCountries = new Set();
    updateEventSummary();
    updateYearSummary();
    updateCountrySummary();
    syncEventCheckboxes();
    syncYearCheckboxes();
    syncCountryCheckboxes();
    applyFilters();
  });
}

document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => handleSort(th.dataset.sort));
});
