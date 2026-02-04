const yearSelect = document.getElementById("yearSelect");
const outcomeSelect = document.getElementById("outcomeSelect");
const searchInput = document.getElementById("searchInput");
const summary = document.getElementById("summary");
const matchesContainer = document.getElementById("matches");

let allEvents = [];

const normalize = (value) => value.toLowerCase();

const render = () => {
  const yearValue = yearSelect.value;
  const outcome = outcomeSelect.value;
  const query = normalize(searchInput.value.trim());

  let events = [...allEvents];

  if (yearValue !== "all") {
    events = events.filter((event) => event.year === Number(yearValue));
  }

  if (outcome !== "all") {
    events = events.filter((event) => event.winner === outcome);
  }

  if (query) {
    events = events.filter((event) =>
      [event.site, event.location, event.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  events.sort((a, b) => b.year - a.year);

  const years = allEvents.map((event) => event.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const rangeLabel = yearValue === "all" ? `${minYear}-${maxYear}` : yearValue;

  summary.textContent = `${events.length} edition${events.length === 1 ? "" : "s"} • ${rangeLabel}`;
  matchesContainer.innerHTML = "";

  events.forEach((event) => {
    const card = document.createElement("article");
    card.className = "match-card";

    const header = document.createElement("div");
    header.className = "match-header";
    const resultLabel = event.winner === "Canceled" ? "Canceled" : event.score || "";
    header.innerHTML = `${event.year} <span class="match-result">${resultLabel}</span>`;

    const meta = document.createElement("div");
    meta.className = "match-meta";
    const venue = [event.site, event.location].filter(Boolean).join(" • ");
    meta.textContent = venue || "Venue TBD";

    const details = document.createElement("div");
    if (event.winner === "Tie") {
      details.innerHTML = `
        <strong>Outcome:</strong> Tie<br />
        <strong>Note:</strong> ${event.note || "Retained by previous holder"}
      `;
    } else if (event.winner === "Canceled") {
      details.innerHTML = `
        <strong>Status:</strong> Canceled<br />
        <strong>Note:</strong> ${event.note || ""}
      `;
    } else {
      details.innerHTML = `
        <strong>Winner:</strong> ${event.winner}<br />
        <strong>Opponent:</strong> ${event.loser || ""}
      `;
    }

    card.append(header, meta, details);
    matchesContainer.append(card);
  });

  if (events.length === 0) {
    matchesContainer.innerHTML = "<p class=\"muted\">No editions for these filters.</p>";
  }
};

const populate = () => {
  yearSelect.innerHTML = "<option value=\"all\">All Years</option>";
  allEvents
    .slice()
    .sort((a, b) => b.year - a.year)
    .forEach((event, index) => {
      const option = document.createElement("option");
      option.value = event.year;
      option.textContent = event.year;
      if (index === 0) option.selected = true;
      yearSelect.append(option);
    });

  render();
};

fetch("data.json")
  .then((res) => res.json())
  .then((data) => {
    allEvents = data.events;
    populate();
  });

[yearSelect, outcomeSelect].forEach((input) => {
  input.addEventListener("change", render);
});

searchInput.addEventListener("input", render);
