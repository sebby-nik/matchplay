const playerSearchA = document.getElementById("playerSearchA");
const playerSearchB = document.getElementById("playerSearchB");
const playerSuggestionsA = document.getElementById("playerSuggestionsA");
const playerSuggestionsB = document.getElementById("playerSuggestionsB");
const playerChipsA = document.getElementById("playerChipsA");
const playerChipsB = document.getElementById("playerChipsB");
const headtoheadSummary = document.getElementById("headtoheadSummary");
const headtoheadProbabilities = document.getElementById("headtoheadProbabilities");
const headtoheadMatchesBody = document.getElementById("headtoheadMatchesBody");

const MODEL = window.MatchplayModel;
const EVENT_ORDER = ["WGC Match Play", "Olympics", "Presidents Cup", "Seve Trophy", "Ryder Cup", "PGA Championship"];
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
  "Round of 128",
  "Round of 64",
  "Round of 32",
  "Round of 16",
  "Fourth Round",
  "Third Round",
  "Quarterfinals",
  "Semifinals",
  "Third Place",
  "Final",
  "Singles"
];

let allMatches = [];
let uniqueMatches = [];
let allPlayers = [];
let ratingsByName = new Map();
let calibration = null;
let playersLoaded = false;
let selectedA = null;
let selectedB = null;

const normalize = (value) =>
  MODEL && typeof MODEL.normalizeName === "function"
    ? MODEL.normalizeName(value)
    : String(value || "").toLowerCase();

const getMonthIndex = (month) => {
  const idx = MONTH_ORDER.indexOf(month);
  return idx === -1 ? MONTH_ORDER.length : idx;
};

const getEventIndex = (event) => {
  const idx = EVENT_ORDER.indexOf(event);
  return idx === -1 ? EVENT_ORDER.length : idx;
};

const getRoundIndex = (round) => {
  const idx = ROUND_ORDER.indexOf(round);
  return idx === -1 ? ROUND_ORDER.length : idx;
};

const invertResult = (result) => {
  if (result === "win") return "loss";
  if (result === "loss") return "win";
  return "halved";
};

const formatPercent = (value) => `${(Math.max(0, Math.min(1, value)) * 100).toFixed(1)}%`;

const confidenceLabel = (count) => {
  if (count >= 8) return "High";
  if (count >= 3) return "Medium";
  return "Low";
};

const sortDirectMatches = (matches) =>
  matches
    .slice()
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const monthDiff = getMonthIndex(b.month) - getMonthIndex(a.month);
      if (monthDiff !== 0) return monthDiff;
      const eventDiff = getEventIndex(a.event) - getEventIndex(b.event);
      if (eventDiff !== 0) return eventDiff;
      return getRoundIndex(a.round) - getRoundIndex(b.round);
    });

const renderSuggestions = (value, listEl, currentSelection, otherSelection) => {
  if (!listEl) return;
  const query = normalize(value.trim());

  if (!playersLoaded) {
    listEl.innerHTML = `<div class="player-suggestion player-suggestion--muted">Loading players...</div>`;
    listEl.classList.add("is-open");
    return;
  }

  const pool = allPlayers.filter((name) => name !== currentSelection && name !== otherSelection);
  const results = (query ? pool.filter((name) => normalize(name).includes(query)) : pool).slice(0, 12);

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
    renderSuggestions(
      input.value,
      suggestionsEl,
      side === "A" ? selectedA : selectedB,
      side === "A" ? selectedB : selectedA
    );
  });

  input.addEventListener("input", () => {
    renderSuggestions(
      input.value,
      suggestionsEl,
      side === "A" ? selectedA : selectedB,
      side === "A" ? selectedB : selectedA
    );
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
    if (target.dataset.name) {
      selectPlayer(side, target.dataset.name);
    }
  });
};

const getDirectMatchesForPlayers = (nameA, nameB) => {
  const filtered = uniqueMatches.filter((match) => {
    const pair = [match.player, match.opponent];
    return pair.includes(nameA) && pair.includes(nameB);
  });

  return filtered.map((match) => {
    const fromAPerspective = match.player === nameA;
    const result = fromAPerspective ? match.result : invertResult(match.result);
    let winner = "Draw";
    if (result === "win") winner = nameA;
    if (result === "loss") winner = nameB;

    return {
      year: match.year,
      month: match.month,
      event: match.event,
      round: match.round,
      score: match.score,
      result,
      winner
    };
  });
};

const renderProbabilities = (nameA, nameB, counts) => {
  if (!headtoheadProbabilities) return;

  const playerA = ratingsByName.get(nameA);
  const playerB = ratingsByName.get(nameB);
  if (!playerA || !playerB || !MODEL) {
    headtoheadProbabilities.hidden = true;
    headtoheadProbabilities.innerHTML = "";
    return;
  }

  const baseline = MODEL.getCalibratedOutcomeProbability(playerA.rating, playerB.rating, calibration, {
    calibrationBin: 25,
    calibrationMinMatches: 8
  });
  const blended = MODEL.blendWithHeadToHead(baseline, counts, 12);

  const modelSource = baseline.source === "calibrated" ? "Elo calibrated + head-to-head blend" : "Elo + head-to-head blend";
  const confidence = confidenceLabel(counts.total);

  headtoheadProbabilities.hidden = false;
  headtoheadProbabilities.innerHTML = `
    <article class="probability-card">
      <h4>${nameA} Win</h4>
      <p>${formatPercent(blended.win)}</p>
    </article>
    <article class="probability-card">
      <h4>Draw</h4>
      <p>${formatPercent(blended.draw)}</p>
    </article>
    <article class="probability-card">
      <h4>${nameB} Win</h4>
      <p>${formatPercent(blended.loss)}</p>
    </article>
    <p class="headtohead__probability-meta">${modelSource}. Confidence: ${confidence} (${counts.total} direct matches).</p>
  `;
};

const renderHeadToHead = () => {
  if (!headtoheadSummary || !headtoheadMatchesBody) return;

  if (!selectedA || !selectedB) {
    headtoheadSummary.classList.remove("is-filled");
    headtoheadSummary.classList.add("empty-state");
    headtoheadSummary.innerHTML = `
      <h3>Build a matchup</h3>
      <p>Select two different players to compare their matchplay history.</p>
    `;
    headtoheadMatchesBody.innerHTML = `
      <tr>
        <td colspan="6" class="muted">Select two players to see direct matches.</td>
      </tr>
    `;
    if (headtoheadProbabilities) {
      headtoheadProbabilities.hidden = true;
      headtoheadProbabilities.innerHTML = "";
    }
    return;
  }

  if (selectedA === selectedB) {
    headtoheadSummary.classList.remove("is-filled");
    headtoheadSummary.classList.add("empty-state");
    headtoheadSummary.innerHTML = `
      <h3>Invalid matchup</h3>
      <p>Please select two different players.</p>
    `;
    headtoheadMatchesBody.innerHTML = `
      <tr>
        <td colspan="6" class="muted">Choose two different players.</td>
      </tr>
    `;
    if (headtoheadProbabilities) {
      headtoheadProbabilities.hidden = true;
      headtoheadProbabilities.innerHTML = "";
    }
    return;
  }

  const direct = sortDirectMatches(getDirectMatchesForPlayers(selectedA, selectedB));
  const counts = direct.reduce(
    (acc, match) => {
      if (match.result === "win") acc.wins += 1;
      else if (match.result === "loss") acc.losses += 1;
      else acc.draws += 1;
      acc.total += 1;
      return acc;
    },
    { wins: 0, draws: 0, losses: 0, total: 0 }
  );

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
        <span>${counts.wins} Wins</span>
        <span>${counts.draws} Draws</span>
        <span>${counts.losses} Losses</span>
        <span>${counts.total} Matches</span>
      </div>
    </div>
  `;

  renderProbabilities(selectedA, selectedB, counts);

  if (!direct.length) {
    headtoheadMatchesBody.innerHTML = `
      <tr>
        <td colspan="6" class="muted">No direct matches found in the archive.</td>
      </tr>
    `;
    return;
  }

  headtoheadMatchesBody.innerHTML = "";
  direct.forEach((match) => {
    const row = document.createElement("tr");
    const dateText = match.month ? `${match.month} ${match.year}` : `${match.year}`;
    const resultLabel = match.result === "win" ? "Win" : match.result === "loss" ? "Loss" : "Draw";
    row.innerHTML = `
      <td>${dateText}</td>
      <td>${match.event || ""}</td>
      <td>${match.round || ""}</td>
      <td>${match.winner}</td>
      <td>${match.score || ""}</td>
      <td>${resultLabel}</td>
    `;
    headtoheadMatchesBody.appendChild(row);
  });
};

const initHeadToHead = async () => {
  if (!playerSearchA || !playerSearchB) return;

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

  try {
    const response = await fetch("data.json");
    const data = await response.json();
    allMatches = Array.isArray(data.matches) ? data.matches : [];
    uniqueMatches = MODEL ? MODEL.dedupeMatches(allMatches) : allMatches.slice();

    const computed = MODEL
      ? MODEL.computeRatingsAndCalibration(allMatches, {
          eventOrder: EVENT_ORDER,
          monthOrder: MONTH_ORDER,
          roundOrder: ROUND_ORDER,
          baseRating: 1000,
          yearDecay: 0.99,
          calibrationBin: 25,
          calibrationPrior: 1
        })
      : { ratingsByName: new Map(), calibration: null };

    ratingsByName = computed.ratingsByName || new Map();
    calibration = computed.calibration || null;

    const names = new Set();
    uniqueMatches.forEach((match) => {
      if (match.player) names.add(match.player);
      if (match.opponent) names.add(match.opponent);
    });
    allPlayers = Array.from(names).sort((a, b) => a.localeCompare(b));
    playersLoaded = true;
    renderHeadToHead();
  } catch (error) {
    if (headtoheadSummary) {
      headtoheadSummary.classList.add("empty-state");
      headtoheadSummary.innerHTML = `
        <h3>Unable to load player data</h3>
        <p>Refresh the page and try again.</p>
      `;
    }
  }
};

initHeadToHead();
