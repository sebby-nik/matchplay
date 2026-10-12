# Matchplay Rankings

A lightweight static site for browsing matchplay history and ratings across major events. The site is designed as a clean, fast archive that can expand with richer historical data and metadata.

## Features
- Player ratings table with filters and sorting
- Player records with head-to-head summaries
- Lineal Championship tracker
- Events schedule page with Upcoming/Results toggle
- Results cards with winner badges and event metadata
- Mobile-friendly navigation and filters

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
```

## Next Steps
- Add player headshots for WGC Match Play winners and expand to other events
- Extend venue/date metadata to more events
- Continue enriching match data coverage
