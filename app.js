const yearSelect = document.getElementById("yearSelect");
const sessionSelect = document.getElementById("sessionSelect");
const teamSelect = document.getElementById("teamSelect");
const searchInput = document.getElementById("searchInput");
const summary = document.getElementById("summary");
const matchesContainer = document.getElementById("matches");

let allEvents = [];

const normalize = (value) => value.toLowerCase();

const render = () => {
  const year = Number(yearSelect.value);
  const session = sessionSelect.value;
  const team = teamSelect.value;
  const query = normalize(searchInput.value.trim());

  const event = allEvents.find((item) => item.year === year);
  if (!event) return;

  const sessions = event.sessions
    .filter((item) => session === "all" || item.name === session)
    .flatMap((item) =>
      item.matches.map((match) => ({
        session: item.name,
        ...match
      }))
    )
    .filter((match) => (team === "all" ? true : match.winner === team))
    .filter((match) => {
      if (!query) return true;
      return Object.values(match.teams)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

  summary.textContent = `${event.year} • ${event.location} • ${sessions.length} matches`;
  matchesContainer.innerHTML = "";

  sessions.forEach((match) => {
    const card = document.createElement("article");
    card.className = "match-card";

    const header = document.createElement("div");
    header.className = "match-header";
    header.innerHTML = `Match ${match.match} <span class="match-result">${match.result}</span>`;

    const meta = document.createElement("div");
    meta.className = "match-meta";
    meta.textContent = `${match.session} • ${match.winner} win`;

    const teams = document.createElement("div");
    teams.innerHTML = `
      <strong>Europe:</strong> ${match.teams.Europe || "—"}<br />
      <strong>USA:</strong> ${match.teams.USA || "—"}
    `;

    card.append(header, meta, teams);
    matchesContainer.append(card);
  });

  if (sessions.length === 0) {
    matchesContainer.innerHTML = "<p class=\"muted\">No matches for these filters.</p>";
  }
};

const populate = () => {
  yearSelect.innerHTML = "";
  sessionSelect.innerHTML = "<option value=\"all\">All Sessions</option>";

  allEvents
    .sort((a, b) => b.year - a.year)
    .forEach((event, index) => {
      const option = document.createElement("option");
      option.value = event.year;
      option.textContent = event.year;
      if (index === 0) option.selected = true;
      yearSelect.append(option);
    });

  const latestEvent = allEvents[0];
  latestEvent.sessions.forEach((session) => {
    const option = document.createElement("option");
    option.value = session.name;
    option.textContent = session.name;
    sessionSelect.append(option);
  });

  render();
};

const refreshSessions = () => {
  const year = Number(yearSelect.value);
  const event = allEvents.find((item) => item.year === year);
  if (!event) return;

  sessionSelect.innerHTML = "<option value=\"all\">All Sessions</option>";
  event.sessions.forEach((session) => {
    const option = document.createElement("option");
    option.value = session.name;
    option.textContent = session.name;
    sessionSelect.append(option);
  });
};

fetch("data.json")
  .then((res) => res.json())
  .then((data) => {
    allEvents = data.events;
    populate();
  });

[yearSelect, sessionSelect, teamSelect].forEach((input) => {
  input.addEventListener("change", () => {
    if (input === yearSelect) refreshSessions();
    render();
  });
});

searchInput.addEventListener("input", render);
