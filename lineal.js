const linealMatches = document.getElementById("linealMatches");
const linealChampionName = document.getElementById("linealChampionName");
const linealChampionMeta = document.getElementById("linealChampionMeta");
const linealChampionStats = document.getElementById("linealChampionStats");

const EVENT_ORDER = ["WGC Match Play", "Presidents Cup", "Ryder Cup"];
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

const LINEAL_RETIREMENTS = [
  {
    player: "Constantino Rocca",
    lastYear: 1997,
    resetChampion: "Tiger Woods",
    resetYear: 1998
  }
];

const getRoundIndex = (round) => {
  const idx = ROUND_ORDER.indexOf(round);
  return idx === -1 ? ROUND_ORDER.length : idx;
};

const getEventIndex = (event) => {
  const idx = EVENT_ORDER.indexOf(event);
  return idx === -1 ? EVENT_ORDER.length : idx;
};

const uniqueMatches = (matches) => {
  const seen = new Set();
  const result = [];
  matches.forEach((match) => {
    const players = [match.player, match.opponent].sort().join(" vs ");
    const key = `${match.event}|${match.year}|${match.round}|${players}|${match.score}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(match);
  });
  return result;
};

const getOpponent = (match, champion) =>
  match.player === champion ? match.opponent : match.player;

const getChampionResult = (match, champion) => {
  if (match.result === "halved") return "Halved";
  const championIsPlayer = match.player === champion;
  const playerWon = match.result === "win";
  if (championIsPlayer) {
    return playerWon ? "Win" : "Loss";
  }
  return playerWon ? "Loss" : "Win";
};

const buildLinealTimeline = (matches) => {
  const ordered = uniqueMatches(matches)
    .slice()
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const eventDiff = getEventIndex(a.event) - getEventIndex(b.event);
      if (eventDiff !== 0) return eventDiff;
      const roundDiff = getRoundIndex(a.round) - getRoundIndex(b.round);
      if (roundDiff !== 0) return roundDiff;
      return a.player.localeCompare(b.player);
    });

  let champion = "Tiger Woods";
  const timeline = [];
  const retirementsApplied = new Set();
  ordered.forEach((match) => {
    const retirement = LINEAL_RETIREMENTS.find(
      (entry) => entry.player === champion && match.year > entry.lastYear
    );
    if (retirement && !retirementsApplied.has(retirement.player)) {
      timeline.push({
        year: retirement.resetYear,
        event: "Lineal Reset",
        round: "—",
        championBefore: champion,
        opponent: "—",
        championResult: "Vacated",
        score: "—",
        championAfter: retirement.resetChampion,
        titleChange: true,
        isVacate: true
      });
      retirementsApplied.add(retirement.player);
      champion = retirement.resetChampion;
    }

    if (match.player !== champion && match.opponent !== champion) return;

    const championBefore = champion;
    const opponent = getOpponent(match, champion);
    const championResult = getChampionResult(match, champion);
    const championAfter = championResult === "Loss" ? opponent : champion;
    const titleChange = championAfter !== championBefore;

    timeline.push({
      year: match.year,
      event: match.event,
      round: match.round || "Singles",
      championBefore,
      opponent,
      championResult,
      score: match.score || "",
      championAfter,
      titleChange,
      isVacate: false
    });

    champion = championAfter;
  });

  return { champion, timeline };
};

const formatMatchLabel = (entry) =>
  `${entry.year} | ${entry.event}${entry.round ? ` | ${entry.round}` : ""}`;

const renderChampionCard = (reigns) => {
  if (!linealChampionName || !linealChampionMeta || !linealChampionStats || reigns.length === 0) return;
  const current = reigns[reigns.length - 1];
  linealChampionName.textContent = current.champion;
  const startLabel = current.startLabel || (current.startEntry ? formatMatchLabel(current.startEntry) : "Inaugural");
  linealChampionMeta.textContent = `Champion since ${startLabel}`;
  linealChampionStats.innerHTML = `
    <span>${current.matches} matches</span>
    <span>${current.defenses} defenses</span>
    <span>${current.wins}-${current.halves}-${current.losses} W-H-L</span>
  `;
};

const isRenderableMatch = (entry) => !entry.isVacate;

const buildReigns = (timeline, inauguralChampion) => {
  const reigns = [];
  let current = {
    champion: inauguralChampion,
    startEntry: null,
    startLabel: "Inaugural",
    endEntry: null,
    matches: 0,
    defenses: 0,
    wins: 0,
    halves: 0,
    losses: 0,
    lostTo: "-"
  };

  timeline.forEach((entry) => {
    if (entry.championBefore !== current.champion) {
      current = {
        champion: entry.championBefore,
        startEntry: null,
        startLabel: "Inaugural",
        endEntry: null,
        matches: 0,
        defenses: 0,
        wins: 0,
        halves: 0,
        losses: 0,
        lostTo: "-"
      };
    }

    current.matches += 1;
    if (entry.championResult === "Win") {
      current.wins += 1;
      current.defenses += 1;
    } else if (entry.championResult === "Halved") {
      current.halves += 1;
      current.defenses += 1;
    } else {
      current.losses += 1;
    }

    if (entry.titleChange) {
      current.endEntry = entry;
      current.lostTo = entry.isVacate ? "Vacated" : entry.opponent;
      reigns.push(current);
      current = {
        champion: entry.championAfter,
        startEntry: entry,
        startLabel: null,
        endEntry: null,
        matches: 0,
        defenses: 0,
        wins: 0,
        halves: 0,
        losses: 0,
        lostTo: "-"
      };
    }
  });

  reigns.push(current);
  return reigns;
};

const renderMatchLog = (timeline) => {
  if (!linealMatches) return;
  linealMatches.innerHTML = "";
  timeline.filter(isRenderableMatch).forEach((entry) => {
    const row = document.createElement("tr");
    row.classList.add("lineal-row", `lineal-row--${entry.championResult.toLowerCase()}`);
    row.innerHTML = `
      <td>${entry.year}</td>
      <td>${entry.event}</td>
      <td>${entry.round}</td>
      <td>${entry.championBefore}</td>
      <td>${entry.opponent}</td>
      <td><span class="lineal-result lineal-result--${entry.championResult.toLowerCase()}">${entry.championResult}</span></td>
      <td>${entry.score || "-"}</td>
    `;
    linealMatches.append(row);
  });
};

fetch("data.json")
  .then((res) => res.json())
  .then((data) => {
    const matches = (data.matches || []).filter((match) => match.result !== "not played");
    const result = buildLinealTimeline(matches);
    const reigns = buildReigns(result.timeline, "Tiger Woods");
    renderMatchLog(result.timeline);
    renderChampionCard(reigns);
  });
