const linealBody = document.getElementById("linealBody");
const linealSummary = document.getElementById("linealSummary");

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
  ordered.forEach((match) => {
    if (match.player !== champion && match.opponent !== champion) return;

    const championBefore = champion;
    let championAfter = champion;

    if (match.result === "win" && match.player === champion) {
      championAfter = champion;
    } else if (match.result === "loss" && match.player === champion) {
      championAfter = match.opponent;
    } else if (match.result === "win" && match.opponent === champion) {
      championAfter = match.player;
    } else if (match.result === "loss" && match.opponent === champion) {
      championAfter = champion;
    }

    timeline.push({
      year: match.year,
      event: match.event,
      round: match.round || "Singles",
      championBefore,
      opponent: match.player === champion ? match.opponent : match.player,
      result: match.result === "halved" ? "Halved" : match.result === "win" ? "Win" : "Loss",
      score: match.score || "",
      championAfter
    });

    champion = championAfter;
  });

  return { champion, timeline };
};

const renderTimeline = ({ champion, timeline }) => {
  if (linealSummary) {
    linealSummary.textContent = `Current lineal champion: ${champion} • ${timeline.length} title matches tracked`;
  }

  if (!linealBody) return;
  linealBody.innerHTML = "";
  timeline.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.year}</td>
      <td>${entry.event}</td>
      <td>${entry.round}</td>
      <td>${entry.championBefore}</td>
      <td>${entry.opponent}</td>
      <td>${entry.result}</td>
      <td>${entry.score}</td>
      <td>${entry.championAfter}</td>
    `;
    linealBody.append(row);
  });
};

fetch("data.json")
  .then((res) => res.json())
  .then((data) => {
    const matches = (data.matches || []).filter((match) => match.result !== "not played");
    const result = buildLinealTimeline(matches);
    renderTimeline(result);
  });
