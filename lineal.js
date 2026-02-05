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

const LINEAL_PLAN = [
  { type: "grant", year: 1998, event: "Presidents Cup", champion: "Tiger Woods" },
  { type: "match", year: 1998, event: "Presidents Cup", champion: "Tiger Woods", opponent: "Greg Norman", outcome: "win" },
  { type: "match", year: 1999, event: "WGC Match Play", champion: "Tiger Woods", opponent: "Jeff Maggert", outcome: "loss" },
  { type: "defend", count: 2 },
  { type: "match", year: 1999, event: "Ryder Cup", champion: "Jeff Maggert", opponent: "Paul Lawrie", outcome: "loss" },
  { type: "match", year: 2000, event: "WGC Match Play", champion: "Paul Lawrie", opponent: "Tiger Woods", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2000, event: "WGC Match Play", champion: "Tiger Woods", opponent: "Darren Clarke", outcome: "loss" },
  { type: "match", year: 2002, event: "WGC Match Play", champion: "Darren Clarke", opponent: "Matt Gogel", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2002, event: "WGC Match Play", champion: "Matt Gogel", opponent: "Tom Lehman", outcome: "loss" },
  { type: "match", year: 2002, event: "WGC Match Play", champion: "Tom Lehman", opponent: "Scott McCarron", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2002, event: "WGC Match Play", champion: "Scott McCarron", opponent: "Kevin Sutherland", outcome: "loss" },
  { type: "defend", count: 2 },
  { type: "match", year: 2003, event: "WGC Match Play", champion: "Kevin Sutherland", opponent: "Adam Scott", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2003, event: "WGC Match Play", champion: "Adam Scott", opponent: "Tiger Woods", outcome: "loss" },
  { type: "defend", count: 10 },
  { type: "match", year: 2005, event: "WGC Match Play", champion: "Tiger Woods", opponent: "Nick O'Hern", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2005, event: "WGC Match Play", champion: "Nick O'Hern", opponent: "Ian Poulter", outcome: "loss" },
  { type: "match", year: 2005, event: "WGC Match Play", champion: "Ian Poulter", opponent: "David Toms", outcome: "loss" },
  { type: "defend", count: 4 },
  { type: "match", year: 2006, event: "WGC Match Play", champion: "David Toms", opponent: "Tom Lehman", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2006, event: "WGC Match Play", champion: "Tom Lehman", opponent: "Geoff Ogilvy", outcome: "loss" },
  { type: "defend", count: 6 },
  { type: "match", year: 2007, event: "WGC Match Play", champion: "Geoff Ogilvy", opponent: "Henrik Stenson", outcome: "loss" },
  { type: "defend", count: 4 },
  { type: "match", year: 2008, event: "WGC Match Play", champion: "Henrik Stenson", opponent: "Tiger Woods", outcome: "loss" },
  { type: "defend", count: 3 },
  { type: "match", year: 2009, event: "WGC Match Play", champion: "Tiger Woods", opponent: "Tim Clark", outcome: "loss" },
  { type: "match", year: 2009, event: "WGC Match Play", champion: "Tim Clark", opponent: "Rory McIlroy", outcome: "loss" },
  { type: "match", year: 2009, event: "WGC Match Play", champion: "Rory McIlroy", opponent: "Geoff Ogilvy", outcome: "loss" },
  { type: "defend", count: 3 },
  { type: "match", year: 2010, event: "WGC Match Play", champion: "Geoff Ogilvy", opponent: "Camilo Villegas", outcome: "loss" },
  { type: "defend", count: 2 },
  { type: "match", year: 2010, event: "WGC Match Play", champion: "Camilo Villegas", opponent: "Paul Casey", outcome: "loss" },
  { type: "match", year: 2010, event: "WGC Match Play", champion: "Paul Casey", opponent: "Ian Poulter", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2011, event: "WGC Match Play", champion: "Ian Poulter", opponent: "Stewart Cink", outcome: "loss" },
  { type: "match", year: 2011, event: "WGC Match Play", champion: "Stewart Cink", opponent: "Yang Yong-eun", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2011, event: "WGC Match Play", champion: "Yang Yong-eun", opponent: "Matt Kuchar", outcome: "loss" },
  { type: "match", year: 2011, event: "WGC Match Play", champion: "Matt Kuchar", opponent: "Luke Donald", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2012, event: "WGC Match Play", champion: "Luke Donald", opponent: "Ernie Els", outcome: "loss" }
];

const ALIASES = {
  "Yang Yong-eun": ["Y.E. Yang"]
};

const normalizeName = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const getNameVariants = (name) => {
  const variants = [name];
  if (ALIASES[name]) {
    variants.push(...ALIASES[name]);
  }
  return variants.map(normalizeName);
};

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

const orderMatches = (matches) =>
  uniqueMatches(matches)
    .slice()
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const eventDiff = getEventIndex(a.event) - getEventIndex(b.event);
      if (eventDiff !== 0) return eventDiff;
      const roundDiff = getRoundIndex(a.round) - getRoundIndex(b.round);
      if (roundDiff !== 0) return roundDiff;
      return a.player.localeCompare(b.player);
    });

const matchPlayers = (match, champion, opponent) => {
  const championVariants = new Set(getNameVariants(champion));
  const opponentVariants = new Set(getNameVariants(opponent));
  const playerNorm = normalizeName(match.player);
  const opponentNorm = normalizeName(match.opponent);
  return (
    (championVariants.has(playerNorm) && opponentVariants.has(opponentNorm)) ||
    (championVariants.has(opponentNorm) && opponentVariants.has(playerNorm))
  );
};

const findMatchIndex = (orderedMatches, year, event, champion, opponent) => {
  for (let i = 0; i < orderedMatches.length; i += 1) {
    const match = orderedMatches[i];
    if (match.year !== year || match.event !== event) continue;
    if (matchPlayers(match, champion, opponent)) return i;
  }
  return -1;
};

const findEventStartIndex = (orderedMatches, year, event) => {
  for (let i = 0; i < orderedMatches.length; i += 1) {
    const match = orderedMatches[i];
    if (match.year === year && match.event === event) return i;
  }
  return -1;
};

const buildLinealLog = (matches) => {
  const orderedMatches = orderMatches(matches);
  const log = [];
  let currentChampion = null;
  let currentIndex = -1;

  LINEAL_PLAN.forEach((step) => {
    if (step.type === "grant") {
      currentChampion = step.champion;
      if (step.year && step.event) {
        const eventStart = findEventStartIndex(orderedMatches, step.year, step.event);
        if (eventStart !== -1) currentIndex = eventStart - 1;
      }
      return;
    }

    if (step.type === "retire") {
      currentChampion = null;
      return;
    }

    if (step.type === "defend") {
      let added = 0;
      for (let i = currentIndex + 1; i < orderedMatches.length && added < step.count; i += 1) {
        const match = orderedMatches[i];
        if (match.player !== currentChampion && match.opponent !== currentChampion) continue;
        const championResult = getChampionResult(match, currentChampion);
        if (championResult === "Loss") continue;
        log.push({
          year: match.year,
          event: match.event,
          round: match.round || "Singles",
          championBefore: currentChampion,
          opponent: getOpponent(match, currentChampion),
          championResult,
          score: match.score || "-",
          titleChange: false,
          isVacate: false
        });
        currentIndex = i;
        added += 1;
      }
      return;
    }

    if (step.type === "match") {
      currentChampion = step.champion;
      const matchIndex = findMatchIndex(
        orderedMatches,
        step.year,
        step.event,
        step.champion,
        step.opponent
      );
      const match = matchIndex >= 0 ? orderedMatches[matchIndex] : null;
      const outcome = step.outcome === "win" ? "Win" : step.outcome === "halved" ? "Halved" : "Loss";

      log.push({
        year: step.year,
        event: step.event,
        round: match?.round || "-",
        championBefore: step.champion,
        opponent: step.opponent,
        championResult: outcome,
        score: match?.score || "-",
        titleChange: outcome === "Loss",
        isVacate: false
      });

      if (matchIndex >= 0) {
        currentIndex = matchIndex;
      }

      if (outcome === "Loss") {
        currentChampion = step.opponent;
      }
    }
  });

  return { log, champion: currentChampion || "" };
};

const formatMatchLabel = (entry) =>
  `${entry.year} | ${entry.event}${entry.round ? ` | ${entry.round}` : ""}`;

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
      current.lostTo = entry.opponent;
      reigns.push(current);
      current = {
        champion: entry.opponent,
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

const renderMatchLog = (entries) => {
  if (!linealMatches) return;
  linealMatches.innerHTML = "";
  entries.forEach((entry, index) => {
    const isStart = index === 0 || entries[index - 1].titleChange;
    const isEnd = entry.titleChange || index === entries.length - 1;
    const row = document.createElement("tr");
    row.classList.add("lineal-row", "lineal-group-row", `lineal-row--${entry.championResult.toLowerCase()}`);
    if (isStart) row.classList.add("lineal-group-start");
    if (isEnd) row.classList.add("lineal-group-end");
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
    const { log } = buildLinealLog(matches);
    const reigns = buildReigns(log, "Tiger Woods");
    renderMatchLog(log);
    renderChampionCard(reigns);
  });
