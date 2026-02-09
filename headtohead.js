const playerSearchA = document.getElementById("playerSearchA");
const playerSearchB = document.getElementById("playerSearchB");
const playerSuggestionsA = document.getElementById("playerSuggestionsA");
const playerSuggestionsB = document.getElementById("playerSuggestionsB");
const playerChipsA = document.getElementById("playerChipsA");
const playerChipsB = document.getElementById("playerChipsB");
const headtoheadSummary = document.getElementById("headtoheadSummary");
const headtoheadMatchesBody = document.getElementById("headtoheadMatchesBody");

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

const EVENT_ORDER = [
  "WGC Match Play",
  "Olympics",
  "Presidents Cup",
  "Seve Trophy",
  "Ryder Cup",
  "PGA Championship"
];

let allMatches = [];
let allPlayers = [];
let selectedA = null;
let selectedB = null;
let playersLoaded = false;

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

const getMonthIndex = (month) => {
  const idx = MONTH_ORDER.indexOf(month);
  return idx === -1 ? 0 : idx;
};

const getEventIndex = (event) => {
  const idx = EVENT_ORDER.indexOf(event);
  return idx === -1 ? EVENT_ORDER.length : idx;
};

const renderSuggestions = (value, listEl, currentSelection) => {
  if (!listEl) return;
  const query = normalize(value.trim());
  if (!playersLoaded) {
    listEl.innerHTML = `<div class="player-suggestion player-suggestion--muted">Loading players...</div>`;
    listEl.classList.add("is-open");
    return;
  }
  const baseList = allPlayers.filter((name) => name !== currentSelection);
  if (!query) {
    const results = baseList.slice(0, 12);
    if (!results.length) {
      listEl.classList.remove("is-open");
      listEl.innerHTML = "";
      return;
    }
    listEl.innerHTML = results
      .map((name) => `<div class="player-suggestion" data-name="${name.replace(/"/g, "&quot;")}">${name}</div>`)
      .join("");
    listEl.classList.add("is-open");
    return;
  }
  const results = baseList
    .filter((name) => normalize(name).includes(query))
    .slice(0, 12);
  if (!results.length) {
    listEl.classList.remove("is-open");
    listEl.innerHTML = "";
    return;
  }
  listEl.innerHTML = results
    .map((name) => `<div class="player-suggestion" data-name="${name.replace(/"/g, "&quot;")}">${name}</div>`)
    .join("");
  listEl.classList.add("is-open");
};

const setChip = (chipsEl, name, onClear) => {
  if (!chipsEl) return;
  chipsEl.innerHTML = "";
  if (!name) return;
  const chip = document.createElement("span");
  chip.className = "player-chip";
  chip.innerHTML = `${name} <button type="button" aria-label="Remove ${name}">×</button>`;
  chip.querySelector("button").addEventListener("click", onClear);
  chipsEl.appendChild(chip);
};

const clearSelection = (side) => {
  if (side === "A") {
    selectedA = null;
    if (playerSearchA) playerSearchA.value = "";
    if (playerSuggestionsA) playerSuggestionsA.classList.remove("is-open");
    setChip(playerChipsA, null, () => {});
  } else {
    selectedB = null;
    if (playerSearchB) playerSearchB.value = "";
    if (playerSuggestionsB) playerSuggestionsB.classList.remove("is-open");
    setChip(playerChipsB, null, () => {});
  }
  renderHeadToHead();
};

const selectPlayer = (side, name) => {
  if (side === "A") {
    selectedA = name;
    if (playerSearchA) playerSearchA.value = "";
    if (playerSuggestionsA) playerSuggestionsA.classList.remove("is-open");
    setChip(playerChipsA, name, () => clearSelection("A"));
  } else {
    selectedB = name;
    if (playerSearchB) playerSearchB.value = "";
    if (playerSuggestionsB) playerSuggestionsB.classList.remove("is-open");
    setChip(playerChipsB, name, () => clearSelection("B"));
  }
  renderHeadToHead();
};

const bindSearch = (input, suggestionsEl, side) => {
  if (!input || !suggestionsEl) return;
  input.addEventListener("focus", () => {
    const currentSelection = side === "A" ? selectedA : selectedB;
    renderSuggestions(input.value, suggestionsEl, currentSelection);
  });
  input.addEventListener("input", () => {
    const currentSelection = side === "A" ? selectedA : selectedB;
    renderSuggestions(input.value, suggestionsEl, currentSelection);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = normalize(input.value.trim());
    const exact = allPlayers.find((name) => normalize(name) === query);
    if (exact) selectPlayer(side, exact);
  });

  suggestionsEl.addEventListener("mousedown", (event) => {
    const target = event.target.closest(".player-suggestion");
    if (!target) return;
    event.preventDefault();
    selectPlayer(side, target.dataset.name);
  });
};

const sortMatches = (matches) =>
  matches
    .slice()
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const monthDiff = getMonthIndex(b.month) - getMonthIndex(a.month);
      if (monthDiff !== 0) return monthDiff;
      const eventDiff = getEventIndex(a.event) - getEventIndex(b.event);
      if (eventDiff !== 0) return eventDiff;
      return a.round.localeCompare(b.round);
    });

const renderHeadToHead = () => {
  if (!headtoheadSummary || !headtoheadMatchesBody) return;
  if (!selectedA || !selectedB || selectedA === selectedB) {
    headtoheadSummary.classList.remove("is-filled");
    headtoheadSummary.classList.add("empty-state");
    headtoheadSummary.innerHTML = `
      <h3>Build a matchup</h3>
      <p>Select two different players to compare their matchplay history.</p>
    `;
    headtoheadMatchesBody.innerHTML = `
      <tr>
        <td colspan="5" class="muted">Select two players to see their matches.</td>
      </tr>
    `;
    return;
  }

  const matches = allMatches.filter(
    (match) => match.player === selectedA && match.opponent === selectedB
  );
  const ordered = sortMatches(matches);
  let wins = 0;
  let draws = 0;
  let losses = 0;
  ordered.forEach((match) => {
    if (match.result === "win") wins += 1;
    else if (match.result === "loss") losses += 1;
    else draws += 1;
  });

  headtoheadSummary.classList.remove("empty-state");
  headtoheadSummary.classList.add("is-filled");
  headtoheadSummary.innerHTML = `
    <div class="headtohead__summary-row">
      <div class="headtohead__names">
        <span>${selectedA}</span>
        <span class="headtohead__vs">VS</span>
        <span>${selectedB}</span>
      </div>
      <div class="headtohead__record">
        <span>${wins} Wins</span>
        <span>${draws} Draws</span>
        <span>${losses} Losses</span>
        <span>${ordered.length} Matches</span>
      </div>
    </div>
  `;

  if (!ordered.length) {
    headtoheadMatchesBody.innerHTML = `
      <tr>
        <td colspan="5" class="muted">No head-to-head matches found.</td>
      </tr>
    `;
    return;
  }

  headtoheadMatchesBody.innerHTML = "";
  ordered.forEach((match) => {
    const row = document.createElement("tr");
    const resultLabel =
      match.result === "win" ? "Win" : match.result === "loss" ? "Loss" : "Halved";
    row.innerHTML = `
      <td>${match.year}</td>
      <td>${match.event}</td>
      <td>${match.round}</td>
      <td>${resultLabel}</td>
      <td>${match.score || ""}</td>
    `;
    headtoheadMatchesBody.appendChild(row);
  });
};

const initHeadToHead = async () => {
  if (!playerSearchA || !playerSearchB) return;
  try {
    const response = await fetch("data.json");
    const data = await response.json();
    allMatches = data.matches || [];
    const playerSet = new Set();
    allMatches.forEach((match) => {
      if (match.player) playerSet.add(match.player);
    });
    allPlayers = Array.from(playerSet).sort((a, b) => a.localeCompare(b));
    playersLoaded = true;
  } catch (error) {
    playersLoaded = false;
    if (headtoheadSummary) {
      headtoheadSummary.classList.add("empty-state");
      headtoheadSummary.innerHTML = `
        <h3>Unable to load player data</h3>
        <p>Refresh the page or check that data.json is available.</p>
      `;
    }
  }

  bindSearch(playerSearchA, playerSuggestionsA, "A");
  bindSearch(playerSearchB, playerSuggestionsB, "B");

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#playerSearchA") && !event.target.closest("#playerSuggestionsA")) {
      playerSuggestionsA.classList.remove("is-open");
    }
    if (!event.target.closest("#playerSearchB") && !event.target.closest("#playerSuggestionsB")) {
      playerSuggestionsB.classList.remove("is-open");
    }
  });
};

initHeadToHead();
