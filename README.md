# Matchplay Rankings

A lightweight static site for browsing matchplay history and ratings across major events. The site is designed as a clean, fast archive that can expand with richer historical data and metadata.

## Features
- Player ratings table with filters and sorting
- Player records with head-to-head summaries
- Lineal Championship tracker
- Events schedule page with Upcoming/Results toggle
- Results cards with winner badges and event metadata
- Mobile-friendly navigation and filters
- 12–0: a daily singles-team draft, with unlimited practice and shareable scorecards

## Structure
- `index.html` — player ratings
- `records.html` — player records
- `lineal.html` — lineal championship
- `events.html` — upcoming/results schedule
- `faq.html`, `about.html` — supporting content
- `styles.css` — site styles
- `site-ui.js` — shared navigation, mobile filter sheets, keyboard behaviour, and responsive tables; loaded by the page scripts
- `app.js` — shared UI logic + filtering
- `data.json` — match data source and upcoming events
- `games/12-0/` — self-contained static golf game; simulation never changes the match archive

## Run Locally
Serve this directory over HTTP (the archive loads JSON files):

```sh
python3 -m http.server 4181 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4181/` in your browser.

## Tests
Run the lightweight player profile test suite with:

```sh
node tests/player-profile.test.js
node tests/twelve-zero.test.js
```

## 12–0 Card Collection

The game ships a frozen `games/12-0/cards-v1.json` snapshot derived from the existing singles Elo timeline. Each card represents the final recorded rating of a year, after at least ten matches. Daily seeds use the UTC date and card version; draft, opponent and simulation random streams are separate. Practice seeds come from browser crypto. Daily progress and separate personal bests live in local storage, with in-memory fallback when saving is unavailable. There are no accounts or verified leaderboards.

Run `node scripts/build-twelve-zero-data.js` to verify that the source archive still reproduces the snapshot. It refuses to overwrite an existing snapshot with different data. Future updates must ship a new version alongside v1 and retain the old engine/data for saved sessions; never change v1 cards, simulation rules or seeding in place. The current game remains pinned to v1.

The dedicated test suite also exercises the UI's loading, storage and recovery paths without dependencies, and reports outcomes across 1,000 fixed practice challenges.

## Next Steps
- Add player headshots for WGC Match Play winners and expand to other events
- Extend venue/date metadata to more events
- Continue enriching match data coverage
