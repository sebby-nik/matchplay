// The shipped v1 snapshot is immutable: rebuilding must reproduce it exactly.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const stats = require('../player-stats.js');
const engine = require('../games/12-0/game-engine.js');
const matches = JSON.parse(fs.readFileSync(path.join(root, 'data.json'))).matches.filter(m => m.result !== 'not played');
const players = JSON.parse(fs.readFileSync(path.join(root, 'players-data.json'))).players;
const site = JSON.parse(fs.readFileSync(path.join(root, 'site-data.json')));
const legends = new Set(['Walter Hagen', 'Gene Sarazen', 'Byron Nelson', 'Sam Snead', 'Ben Hogan', 'Arnold Palmer', 'Jack Nicklaus', 'Gary Player', 'Lee Trevino', 'Tony Jacklin', 'Billy Casper']);
const cards = [];
for (const player of players) {
  if (player.matchRows < 10) continue;
  const timeline = stats.deriveRatingTimeline(matches, player.name).timeline;
  const annual = new Map();
  timeline.forEach((entry, i) => { if (i >= 9) annual.set(entry.year, entry.ratingAfter); });
  for (const [year, rating] of annual) {
    if (year < 1990 && !legends.has(player.name)) continue;
    cards.push({ id: `${player.id}:${year}`, playerId: player.id, name: player.name, country: player.country || '', year, rating, group: year >= 1990 ? 'modern' : 'legend' });
  }
}
cards.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const data = engine.validateData({ version: 'v1', sourceDate: site.dataUpdatedAt, minimumMatches: 10, cards });
const output = `${JSON.stringify(data, null, 2)}\n`;
const destination = path.join(root, 'games/12-0/cards-v1.json');
if (fs.existsSync(destination)) {
  assert.equal(fs.readFileSync(destination, 'utf8'), output, 'The archive has changed. Keep cards-v1.json frozen; publish future cards under a new version.');
  console.log(`Verified the frozen v1 collection (${cards.length} cards).`);
} else {
  fs.writeFileSync(destination, output);
  console.log(`Created cards-v1.json (${cards.length} cards).`);
}
