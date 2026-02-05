const linealMatches = document.getElementById("linealMatches");
const linealChampions = document.getElementById("linealChampions");
const linealChampionsToggle = document.getElementById("linealChampionsToggle");
const linealChampionsBody = document.getElementById("linealChampionsBody");
const linealLogToggle = document.getElementById("linealLogToggle");
const linealLogBody = document.getElementById("linealLogBody");
const linealChampionName = document.getElementById("linealChampionName");
const linealChampionMeta = document.getElementById("linealChampionMeta");
const linealChampionStats = document.getElementById("linealChampionStats");
const linealChampionRecord = document.getElementById("linealChampionRecord");

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
  { type: "match", year: 2012, event: "WGC Match Play", champion: "Luke Donald", opponent: "Ernie Els", outcome: "loss" },
  { type: "match", year: 2012, event: "WGC Match Play", champion: "Ernie Els", opponent: "Peter Hanson", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2012, event: "WGC Match Play", champion: "Peter Hanson", opponent: "Mark Wilson", outcome: "loss" },
  { type: "match", year: 2012, event: "WGC Match Play", champion: "Mark Wilson", opponent: "Hunter Mahan", outcome: "loss" },
  { type: "defend", count: 7 },
  { type: "match", year: 2013, event: "WGC Match Play", champion: "Hunter Mahan", opponent: "Matt Kuchar", outcome: "loss" },
  { type: "defend", count: 2 },
  { type: "match", year: 2014, event: "WGC Match Play", champion: "Matt Kuchar", opponent: "Jordan Spieth", outcome: "loss" },
  { type: "match", year: 2014, event: "WGC Match Play", champion: "Jordan Spieth", opponent: "Ernie Els", outcome: "loss" },
  { type: "match", year: 2014, event: "WGC Match Play", champion: "Ernie Els", opponent: "Victor Dubuisson", outcome: "loss" },
  { type: "match", year: 2014, event: "WGC Match Play", champion: "Victor Dubuisson", opponent: "Jason Day", outcome: "loss" },
  { type: "match", year: 2015, event: "WGC Match Play", champion: "Jason Day", opponent: "Charley Hoffman", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2015, event: "WGC Match Play", champion: "Charley Hoffman", opponent: "Branden Grace", outcome: "loss" },
  { type: "match", year: 2015, event: "WGC Match Play", champion: "Branden Grace", opponent: "Tommy Fleetwood", outcome: "loss" },
  { type: "match", year: 2015, event: "WGC Match Play", champion: "Tommy Fleetwood", opponent: "Danny Willett", outcome: "loss" },
  { type: "match", year: 2015, event: "WGC Match Play", champion: "Danny Willett", opponent: "Gary Woodland", outcome: "loss" },
  { type: "match", year: 2015, event: "WGC Match Play", champion: "Gary Woodland", opponent: "Rory McIlroy", outcome: "loss" },
  { type: "defend", count: 5 },
  { type: "match", year: 2016, event: "WGC Match Play", champion: "Rory McIlroy", opponent: "Jason Day", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2017, event: "WGC Match Play", champion: "Jason Day", opponent: "Pat Perez", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2017, event: "WGC Match Play", champion: "Pat Perez", opponent: "Lee Westwood", outcome: "loss" },
  { type: "match", year: 2019, event: "WGC Match Play", champion: "Lee Westwood", opponent: "Xander Schauffele", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2019, event: "WGC Match Play", champion: "Xander Schauffele", opponent: "Rafa Cabrera-Bello", outcome: "loss" },
  { type: "retire", player: "Rafa Cabrera-Bello", year: 2019 },
  { type: "grant", year: 2019, event: "WGC Match Play", champion: "Kevin Kisner" },
  { type: "defend", count: 2 },
  { type: "match", year: 2021, event: "WGC Match Play", champion: "Kevin Kisner", opponent: "Matt Kuchar", outcome: "loss" },
  { type: "defend", count: 2 },
  { type: "match", year: 2021, event: "WGC Match Play", champion: "Matt Kuchar", opponent: "Scottie Scheffler", outcome: "loss" },
  { type: "match", year: 2021, event: "WGC Match Play", champion: "Scottie Scheffler", opponent: "Billy Horschel", outcome: "loss" },
  { type: "defend", count: 3 },
  { type: "match", year: 2022, event: "WGC Match Play", champion: "Billy Horschel", opponent: "Scottie Scheffler", outcome: "loss" },
  { type: "defend", count: 8 },
  { type: "match", year: 2023, event: "WGC Match Play", champion: "Scottie Scheffler", opponent: "Sam Burns", outcome: "loss" },
  { type: "defend", count: 1 },
  { type: "match", year: 2023, event: "Ryder Cup", champion: "Sam Burns", opponent: "Rory McIlroy", outcome: "loss" },
  { type: "match", year: 2025, event: "Ryder Cup", champion: "Rory McIlroy", opponent: "Scottie Scheffler", outcome: "loss" }
];

const ALIASES = {
  "Yang Yong-eun": ["Y.E. Yang"]
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
  if (match.result === "halved") return "Draw";
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
  const grants = [];
  const retirements = [];

  LINEAL_PLAN.forEach((step) => {
    if (step.type === "grant") {
      currentChampion = step.champion;
      grants.push({ champion: step.champion, year: step.year, event: step.event });
      if (step.year && step.event) {
        const eventStart = findEventStartIndex(orderedMatches, step.year, step.event);
        if (eventStart !== -1) currentIndex = eventStart - 1;
      }
      return;
    }

    if (step.type === "retire") {
      currentChampion = null;
      retirements.push({ champion: step.player, year: step.year });
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
      const outcome = step.outcome === "win" ? "Win" : step.outcome === "halved" ? "Draw" : "Loss";

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

  return { log, champion: currentChampion || "", grants, retirements };
};

const formatMatchLabel = (entry) =>
  `${entry.year} | ${entry.event}${entry.round ? ` | ${entry.round}` : ""}`;

const buildReigns = (timeline, grants, retirements) => {
  const grantsByChampion = new Map();
  grants.forEach((grant) => {
    const list = grantsByChampion.get(grant.champion) || [];
    list.push(grant);
    grantsByChampion.set(grant.champion, list);
  });

  const retirementByChampion = new Map();
  retirements.forEach((retire) => {
    retirementByChampion.set(retire.champion, retire);
  });

  const consumeGrantLabel = (champion, year) => {
    const list = grantsByChampion.get(champion) || [];
    if (!list.length) return null;
    const grant = list.find((entry) => entry.year <= year) || list[0];
    const idx = list.indexOf(grant);
    if (idx >= 0) list.splice(idx, 1);
    grantsByChampion.set(champion, list);
    return `Granted at ${grant.year} ${grant.event}`;
  };

  const reigns = [];
  let current = null;

  const startReign = (champion, startEntry, startLabel) => ({
    champion,
    startEntry: startEntry || null,
    startLabel: startLabel || null,
    endEntry: null,
    endLabel: null,
    matches: 0,
    defenses: 0,
    wins: 0,
    halves: 0,
    losses: 0,
    lostTo: "-"
  });

  timeline.forEach((entry) => {
    if (!current) {
      const grantLabel = consumeGrantLabel(entry.championBefore, entry.year);
      current = startReign(entry.championBefore, null, grantLabel);
    }

    if (entry.championBefore !== current.champion) {
      const retireInfo = retirementByChampion.get(current.champion);
      if (retireInfo) {
        current.endLabel = `Retired (${retireInfo.year})`;
      }
      reigns.push(current);
      const grantLabel = consumeGrantLabel(entry.championBefore, entry.year);
      current = startReign(entry.championBefore, null, grantLabel);
    }

    current.matches += 1;
    if (entry.championResult === "Win") {
      current.wins += 1;
      current.defenses += 1;
    } else if (entry.championResult === "Draw") {
      current.halves += 1;
      current.defenses += 1;
    } else {
      current.losses += 1;
    }

    if (entry.titleChange) {
      current.endEntry = entry;
      current.lostTo = entry.opponent;
      reigns.push(current);
      const winLabel = `Won title at ${entry.year} ${entry.event}`;
      const startEntry = { ...entry, defeated: entry.championBefore };
      current = startReign(entry.opponent, startEntry, winLabel);
    }
  });

  if (current) {
    const retireInfo = retirementByChampion.get(current.champion);
    if (retireInfo) {
      current.endLabel = `Retired (${retireInfo.year})`;
    }
    reigns.push(current);
  }
  return reigns;
};

const renderChampionCard = (reigns, overallStats) => {
  if (!linealChampionName || !linealChampionMeta || !linealChampionStats || reigns.length === 0) return;
  const current = reigns[reigns.length - 1];
  linealChampionName.textContent = current.champion;
  const titleEntry = current.startEntry;
  const sinceText = titleEntry
    ? `Champion since defeating ${titleEntry.defeated || titleEntry.opponent} at ${titleEntry.event}`
    : current.startLabel || "Champion since inaugural grant";
  linealChampionMeta.textContent = sinceText;

  const championReigns = reigns.filter((reign) => reign.champion === current.champion);
  const reignCount = championReigns.length;
  const totalMatches = championReigns.reduce((sum, reign) => sum + reign.matches, 0);
  const totalDefenses = championReigns.reduce((sum, reign) => {
    const titleWinAdjustment = reign.startEntry ? 1 : 0;
    return sum + Math.max(reign.wins - titleWinAdjustment, 0);
  }, 0);
  const overall = overallStats.get(current.champion) || { wins: 0, draws: 0, losses: 0 };
  if (linealChampionRecord) {
    linealChampionRecord.textContent = `${overall.wins}-${overall.draws}-${overall.losses} W-D-L`;
  }
  linealChampionStats.innerHTML = `
    <span>${reignCount} reigns</span>
    <span>${totalMatches} matches</span>
    <span>${totalDefenses} defenses</span>
  `;
};

const renderChampionsList = (reigns, countryMap) => {
  if (!linealChampions) return;
  linealChampions.innerHTML = "";
  const reignCounts = reigns.reduce((acc, reign) => {
    acc[reign.champion] = (acc[reign.champion] || 0) + 1;
    return acc;
  }, {});

  reigns.forEach((reign, index) => {
    const startLabel =
      reign.startLabel || (reign.startEntry ? `Won title at ${formatMatchLabel(reign.startEntry)}` : "Inaugural");
    const endLabel = reign.endEntry
      ? `Lost at ${formatMatchLabel(reign.endEntry)}`
      : reign.endLabel || "Present";
    const detail = `${reign.matches} matches · ${reign.defenses} defenses · ${reign.wins}-${reign.halves}-${reign.losses} W-D-L`;
    const reignCount = reignCounts[reign.champion] || 1;
    const reignLabel = reignCount > 1 ? `${reignCount} reigns` : "1 reign";
    const countryCode = countryMap.get(reign.champion) || "";
    const flag = flagFromCountry(countryCode);
    const countryName = countryNameFromCode(countryCode);

    const item = document.createElement("li");
    item.className = "lineal-champion";
    item.innerHTML = `
      <div class="lineal-champion__index">${index + 1}</div>
      <div class="lineal-champion__body">
        <div class="lineal-champion__header">
          <h3>${flag ? `<span class=\"lineal-champion__flag\" title=\"${countryName}\">${flag}</span>` : ""}${reign.champion}</h3>
          <div class="lineal-champion__meta">
            <span class="lineal-champion__range">${startLabel} → ${endLabel}</span>
            <span class="lineal-champion__reigns">${reignLabel}</span>
          </div>
        </div>
        <p class="lineal-champion__detail">${detail}</p>
      </div>
    `;
    linealChampions.append(item);
  });
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
    const countryMap = new Map();
    const overallStats = new Map();
    matches.forEach((match) => {
      if (match.player && match.player_country && !countryMap.has(match.player)) {
        countryMap.set(match.player, match.player_country);
      }
      if (match.opponent && match.opponent_country && !countryMap.has(match.opponent)) {
        countryMap.set(match.opponent, match.opponent_country);
      }

      const ensure = (name) => {
        if (!overallStats.has(name)) {
          overallStats.set(name, { wins: 0, draws: 0, losses: 0 });
        }
        return overallStats.get(name);
      };
      const playerStats = ensure(match.player);
      const opponentStats = ensure(match.opponent);

      if (match.result === "win") {
        playerStats.wins += 1;
        opponentStats.losses += 1;
      } else if (match.result === "halved") {
        playerStats.draws += 1;
        opponentStats.draws += 1;
      } else if (match.result === "loss") {
        playerStats.losses += 1;
        opponentStats.wins += 1;
      }
    });
    const { log, grants, retirements } = buildLinealLog(matches);
    const reigns = buildReigns(log, grants, retirements);
    renderMatchLog(log);
    renderChampionCard(reigns, overallStats);
    renderChampionsList(reigns, countryMap);
  });

if (linealChampionsToggle && linealChampionsBody) {
  linealChampionsToggle.addEventListener("click", () => {
    const isCollapsed = linealChampionsBody.classList.toggle("is-collapsed");
    linealChampionsToggle.classList.toggle("is-collapsed", isCollapsed);
  });
}

if (linealLogToggle && linealLogBody) {
  linealLogToggle.addEventListener("click", () => {
    const isCollapsed = linealLogBody.classList.toggle("is-collapsed");
    linealLogToggle.classList.toggle("is-collapsed", isCollapsed);
  });
}
