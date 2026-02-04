# Ryder Cup Matchplay Database

A lightweight, static MVP for browsing Ryder Cup results by edition. This project is designed to grow into a complete historical archive, starting with a clean data model and a simple, fast UI.

## Features
- Filter by year and outcome
- Search by venue or location
- Event-level dataset from 1927 onward (1939 canceled)

## Structure
- `index.html` — main page layout
- `styles.css` — site styles
- `app.js` — UI logic + filtering
- `data.json` — event data source

## Run Locally
Open `index.html` in your browser.

## GitHub Pages
After the first push, enable GitHub Pages in the repo settings:
- Settings → Pages → Source: GitHub Actions

Once enabled, the site will deploy automatically on every push to `main`.

## Next Steps
- Expand `data.json` with additional years
- Add richer metadata (captains, courses, scores)
- Split into per-year pages or a database-backed app
