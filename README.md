# Ryder Cup Matchplay Database

A lightweight, static MVP for browsing Ryder Cup matchplay results. This project is designed to grow into a complete historical archive, starting with a clean data model and a simple, fast UI.

## Features
- Filter by year, session, and winning team
- Search by player name
- Seed dataset (easy to expand)

## Structure
- `index.html` — main page layout
- `styles.css` — site styles
- `app.js` — UI logic + filtering
- `data.json` — match data source

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
