const eventSelect = document.getElementById("eventSelect");
const yearSelect = document.getElementById("yearSelect");
const searchInput = document.getElementById("searchInput");
const minMatchesInput = document.getElementById("minMatches");
const minMatchesValue = document.getElementById("minMatchesValue");
const summary = document.getElementById("summary");
const rankBody = document.getElementById("rankBody");

let allMatches = [];
let currentSort = { key: "ppm", direction: "desc" };
let currentPlayers = [];
let expandedPlayer = null;

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
    row.classList.toggle("is-open", expandedPlayer === player.name);

    const flag = flagFromCountry(player.country);
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${player.name}</td>
      <td>${flag ? `<span class=\"flag\">${flag}</span>` : ""}${player.country || ""}</td>
      <td>${player.matches}</td>
      <td>${player.points.toFixed(1)}</td>
      <td>${player.wins}-${player.draws}-${player.losses}</td>
      <td>${player.ppm.toFixed(2)}</td>
    `;

    row.addEventListener("click", () => renderPlayerDetail(player, row));
    rankBody.append(row);

    if (expandedPlayer === player.name) {
      const detailRow = document.createElement("tr");
      detailRow.className = "detail-row";
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.innerHTML = renderPlayerDetailContent(player);
      detailRow.append(cell);
      rankBody.append(detailRow);
    }
  });
};

const renderPlayerDetailContent = (player) => {
  const flag = flagFromCountry(player.country);
  const matches = player.matchList
    .slice()
    .sort((a, b) => b.year - a.year)
    .map((match) => {
      const label = match.result === "halved" ? "Halved" : match.result.toUpperCase();
      return `
        <div class="match-row">
          <div>
            <strong>${match.event} ${match.year}</strong> — ${match.opponent}
            <div class="meta">${match.round || "Singles"}</div>
          </div>
          <div>
            <strong>${label}</strong><br />
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

const renderPlayerDetail = (player) => {
  if (expandedPlayer === player.name) {
    expandedPlayer = null;
  } else {
    expandedPlayer = player.name;
  }
  renderTable(currentPlayers);
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
  const eventValue = eventSelect.value;
  const yearValue = yearSelect.value;
  const query = normalize(searchInput.value.trim());
  const minMatches = Number(minMatchesInput.value || 1);

  let matches = allMatches.slice();

  if (eventValue !== "all") {
    matches = matches.filter((match) => match.event === eventValue);
  }

  if (yearValue !== "all") {
    matches = matches.filter((match) => match.year === Number(yearValue));
  }

  if (query) {
    matches = matches.filter((match) =>
      match.player.toLowerCase().includes(query)
    );
  }

  const players = calculatePlayers(matches);
  const filteredPlayers = players.filter((player) => player.matches >= minMatches);
  const sorted = sortPlayers(filteredPlayers);

  currentPlayers = sorted;
  summary.textContent = `${sorted.length} players • ${matches.length} matches • Min ${minMatches}+`;
  renderTable(sorted);

  if (sorted.length === 0) {
    expandedPlayer = null;
  } else if (!sorted.find((player) => player.name === expandedPlayer)) {
    expandedPlayer = null;
  }
};

const populateFilters = () => {
  const events = Array.from(new Set(allMatches.map((match) => match.event))).sort();
  events.forEach((event) => {
    const option = document.createElement("option");
    option.value = event;
    option.textContent = event;
    eventSelect.append(option);
  });

  const years = Array.from(new Set(allMatches.map((match) => match.year))).sort((a, b) => b - a);
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.append(option);
  });

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

[eventSelect, yearSelect].forEach((input) => {
  input.addEventListener("change", applyFilters);
});

searchInput.addEventListener("input", applyFilters);
minMatchesInput.addEventListener("input", () => {
  minMatchesValue.textContent = `${minMatchesInput.value}+`;
  applyFilters();
});

document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => handleSort(th.dataset.sort));
});
