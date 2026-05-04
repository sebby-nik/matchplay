const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.resolve(__dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(rootDir, file), "utf8"));
const playerStats = require(path.join(rootDir, "player-stats.js"));

const playersData = readJson("players-data.json");
const matchData = readJson("data.json");
const siteData = readJson("site-data.json");
const playableMatches = (matchData.matches || []).filter((match) => match && match.result !== "not played");

const exposePlayerApi = `
globalThis.__profileTestApi = {
  buildPlayerSlugMap,
  getPlayerProfileHref,
  computePlayerRatingProfile,
  calculateRecord,
  buildEventBreakdown,
  buildHeadToHeadRecords,
  buildBestWins,
  buildWorstLosses,
  renderRatingTimelineSection,
  renderNotFound,
  renderProfile,
  normalizeEventLabel
};
`;

const loadPlayerApi = (slug = "rory-mcilroy") => {
  const root = { innerHTML: "" };
  const elements = new Map([["playerProfileRoot", root]]);
  const document = {
    body: { dataset: { playerSlug: slug } },
    getElementById: (id) => elements.get(id) || null,
    querySelector: () => null
  };
  const window = {
    innerWidth: 1024,
    addEventListener: () => {}
  };
  const fetch = () => Promise.resolve({ ok: false, json: async () => ({}) });
  const context = vm.createContext({
    console,
    document,
    window,
    fetch,
    Intl,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Set,
    Map,
    Array,
    Object,
    JSON,
    RegExp,
    Promise,
    Error
  });
  const statsSource = fs.readFileSync(path.join(rootDir, "player-stats.js"), "utf8");
  const source = fs.readFileSync(path.join(rootDir, "player.js"), "utf8");
  vm.runInContext(statsSource, context, { filename: "player-stats.js" });
  vm.runInContext(`${source}\n${exposePlayerApi}`, context, { filename: "player.js" });
  root.innerHTML = "";
  return { api: context.__profileTestApi, root };
};

const slugifyName = (name) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const byName = new Map(playersData.players.map((player) => [player.name, player]));
const findPlayer = (name) => {
  const player = byName.get(name);
  assert.ok(player, `Expected ${name} to exist in players-data.json`);
  return player;
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("player slug generation matches the public slug policy", () => {
  const examples = [
    ["Tiger Woods", "tiger-woods"],
    ["Rory McIlroy", "rory-mcilroy"],
    ["Seve Ballesteros", "seve-ballesteros"],
    ["Adri\u00e1n Otaegui", "adrian-otaegui"],
    ["A.J. Chapman", "a-j-chapman"]
  ];

  examples.forEach(([name, expectedSlug]) => {
    assert.strictEqual(slugifyName(name), expectedSlug);
    assert.strictEqual(findPlayer(name).slug, expectedSlug);
  });
});

test("duplicate player names and slug collisions stay route-safe", () => {
  const slugs = playersData.players.map((player) => player.slug);
  assert.strictEqual(new Set(slugs).size, slugs.length, "Every generated player slug should be unique");

  const groupedByBaseSlug = new Map();
  playersData.players.forEach((player) => {
    const baseSlug = slugifyName(player.name);
    groupedByBaseSlug.set(baseSlug, [...(groupedByBaseSlug.get(baseSlug) || []), player]);
  });

  const collisionGroups = [...groupedByBaseSlug.values()].filter((group) => group.length > 1);
  assert.ok(collisionGroups.length > 0, "Fixture should include real-world slug collisions");
  collisionGroups.forEach((group) => {
    assert.strictEqual(new Set(group.map((player) => player.slug)).size, group.length);
    assert.ok(group.some((player) => player.slug !== slugifyName(player.name)));
  });

  assert.deepStrictEqual(
    playersData.players.filter((player) => player.name.replace(/\s/g, "") === "J.B.Holmes").map((player) => player.slug).sort(),
    ["j-b-holmes", "j-b-holmes-us"]
  );
});

test("known player profile pages are generated and render populated profile content", () => {
  const { api, root } = loadPlayerApi();
  const rory = findPlayer("Rory McIlroy");
  const profileHtml = fs.readFileSync(path.join(rootDir, "players", rory.slug, "index.html"), "utf8");

  assert.match(profileHtml, /data-player-slug="rory-mcilroy"/);
  assert.match(profileHtml, /Rory McIlroy Matchplay Record &amp; Ranking \| Matchplay Rankings/);
  assert.match(profileHtml, /src="\.\.\/\.\.\/player-stats\.js"/);
  assert.match(profileHtml, /src="\.\.\/\.\.\/player\.js"/);

  api.renderProfile(rory, playableMatches, siteData, playersData.players);
  assert.match(root.innerHTML, /Rory McIlroy/);
  assert.match(root.innerHTML, /Profile Summary/);
  assert.match(root.innerHTML, /Competition Records/);
  assert.match(root.innerHTML, /Head-to-Head Records/);
  assert.match(root.innerHTML, /Rating Timeline/);
  assert.match(root.innerHTML, /head-to-head\/rory-mcilroy\/vs\/scottie-scheffler\//);
  assert.match(root.innerHTML, /head-to-head-inline-link/);
  assert.match(root.innerHTML, /compare\/\?players=rory-mcilroy/);
  assert.match(root.innerHTML, /Compare this player/);
});

test("unknown player slugs show a useful not-found state", () => {
  const { api, root } = loadPlayerApi("unknown-player");
  api.renderNotFound();
  assert.match(root.innerHTML, /Player not found/);
  assert.match(root.innerHTML, /Back to player ratings/);
});

test("overall record calculations are correct for trust-critical players", () => {
  const { api } = loadPlayerApi();
  const rory = api.calculateRecord(playableMatches, "Rory McIlroy");
  assert.deepStrictEqual(
    {
      matches: rory.matches,
      wins: rory.wins,
      draws: rory.draws,
      losses: rory.losses,
      points: rory.points
    },
    { matches: 60, wins: 39, draws: 4, losses: 17, points: 41 }
  );

  const tiger = api.calculateRecord(playableMatches, "Tiger Woods");
  assert.deepStrictEqual(
    {
      matches: tiger.matches,
      wins: tiger.wins,
      draws: tiger.draws,
      losses: tiger.losses,
      points: tiger.points
    },
    { matches: 65, wins: 47, draws: 2, losses: 16, points: 48 }
  );
});

test("shared player stat helpers expose reusable profile calculations", () => {
  const profile = playerStats.buildPlayerProfileStats(playableMatches, "Rory McIlroy", { activeCutoff: 2020 });

  assert.deepStrictEqual(
    {
      matches: profile.record.matches,
      wins: profile.record.wins,
      draws: profile.record.draws,
      losses: profile.record.losses,
      points: profile.record.points,
      pointsPerMatch: Number(profile.record.pointsPerMatch.toFixed(2)),
      pointsPercentage: Math.round(profile.record.pointsPercentage)
    },
    {
      matches: 60,
      wins: 39,
      draws: 4,
      losses: 17,
      points: 41,
      pointsPerMatch: 0.68,
      pointsPercentage: 68
    }
  );
  assert.strictEqual(Math.round(profile.currentRating), 1176);
  assert.strictEqual(Math.round(profile.peakRating), 1243);
  assert.strictEqual(profile.currentRanking, 1);
  assert.ok(profile.eventRecords.some((event) => event.event === "WGC / Dell Match Play" && event.matches === 51));
  assert.ok(profile.headToHeadRecords.some((record) => record.opponent === "Scottie Scheffler" && record.matches === 2));
  assert.ok(profile.bestWins.length > 0);
  assert.ok(profile.worstLosses.length > 0);
  assert.strictEqual(profile.timeline.length, 60);
});

test("event-specific records include normalized marquee competitions", () => {
  const { api } = loadPlayerApi();
  const breakdown = api.buildEventBreakdown(playableMatches, "Tiger Woods");
  const byEvent = new Map(breakdown.map((event) => [event.event, event]));

  assert.ok(byEvent.has("Ryder Cup"));
  assert.ok(byEvent.has("Presidents Cup"));
  assert.ok(byEvent.has("WGC / Dell Match Play"));
  assert.ok(byEvent.has("Seve Trophy"));
  assert.strictEqual(api.normalizeEventLabel("Dell Match Play"), "WGC / Dell Match Play");

  assert.deepStrictEqual(
    {
      matches: byEvent.get("Ryder Cup").matches,
      wins: byEvent.get("Ryder Cup").wins,
      draws: byEvent.get("Ryder Cup").draws,
      losses: byEvent.get("Ryder Cup").losses,
      points: byEvent.get("Ryder Cup").points
    },
    { matches: 8, wins: 4, draws: 2, losses: 2, points: 5 }
  );
  assert.deepStrictEqual(
    {
      matches: byEvent.get("WGC / Dell Match Play").matches,
      wins: byEvent.get("WGC / Dell Match Play").wins,
      losses: byEvent.get("WGC / Dell Match Play").losses,
      points: byEvent.get("WGC / Dell Match Play").points
    },
    { matches: 48, wins: 36, losses: 12, points: 36 }
  );
});

test("head-to-head records are derived from player rating timeline", () => {
  const { api } = loadPlayerApi();
  const { timeline } = api.computePlayerRatingProfile(playableMatches, "Rory McIlroy");
  const headToHead = api.buildHeadToHeadRecords(timeline);
  const scottie = headToHead.find((record) => record.opponent === "Scottie Scheffler");

  assert.ok(scottie, "Expected Rory McIlroy vs Scottie Scheffler head-to-head record");
  assert.deepStrictEqual(
    {
      matches: scottie.matches,
      wins: scottie.wins,
      draws: scottie.draws,
      losses: scottie.losses,
      points: scottie.points,
      pointsPerMatch: scottie.pointsPerMatch,
      latestMeeting: scottie.latestMeeting
    },
    {
      matches: 2,
      wins: 1,
      draws: 0,
      losses: 1,
      points: 1,
      pointsPerMatch: 0.5,
      latestMeeting: "September 2025"
    }
  );
});

test("shared head-to-head helpers derive two-player pages consistently", () => {
  const matches = playerStats.buildHeadToHeadMatches(playableMatches, "Rory McIlroy", "Scottie Scheffler");
  const record = playerStats.calculateHeadToHeadRecord(playableMatches, "Rory McIlroy", "Scottie Scheffler");
  const events = playerStats.buildHeadToHeadEventBreakdown(playableMatches, "Rory McIlroy", "Scottie Scheffler");

  assert.strictEqual(matches.length, 2);
  assert.deepStrictEqual(
    {
      matches: record.matches,
      roryWins: record.playerA.wins,
      roryDraws: record.playerA.draws,
      roryLosses: record.playerA.losses,
      roryPoints: record.playerA.points,
      scottieWins: record.playerB.wins,
      scottiePoints: record.playerB.points
    },
    {
      matches: 2,
      roryWins: 1,
      roryDraws: 0,
      roryLosses: 1,
      roryPoints: 1,
      scottieWins: 1,
      scottiePoints: 1
    }
  );
  assert.ok(events.some((event) => event.event === "Ryder Cup" && event.matches === 1));
  assert.ok(events.some((event) => event.event === "WGC / Dell Match Play" && event.matches === 1));
});

test("head-to-head helpers handle players who have never faced each other", () => {
  const matches = playerStats.buildHeadToHeadMatches(playableMatches, "Tiger Woods", "Scottie Scheffler");
  const record = playerStats.calculateHeadToHeadRecord(playableMatches, "Tiger Woods", "Scottie Scheffler");
  const events = playerStats.buildHeadToHeadEventBreakdown(playableMatches, "Tiger Woods", "Scottie Scheffler");

  assert.deepStrictEqual(matches, []);
  assert.strictEqual(record.matches, 0);
  assert.strictEqual(record.playerA.points, 0);
  assert.strictEqual(record.playerB.points, 0);
  assert.deepStrictEqual(events, []);
});

test("generated head-to-head pages use canonical static routes", () => {
  const canonical = path.join(rootDir, "head-to-head", "rory-mcilroy", "vs", "scottie-scheffler", "index.html");
  const reverse = path.join(rootDir, "head-to-head", "scottie-scheffler", "vs", "rory-mcilroy", "index.html");
  const canonicalHtml = fs.readFileSync(canonical, "utf8");
  const reverseHtml = fs.readFileSync(reverse, "utf8");

  assert.match(canonicalHtml, /data-player-a="rory-mcilroy"/);
  assert.match(canonicalHtml, /data-player-b="scottie-scheffler"/);
  assert.match(canonicalHtml, /Rory McIlroy vs Scottie Scheffler Head-to-Head Matchplay Record \| Matchplay Rankings/);
  assert.match(
    canonicalHtml,
    /View the professional golf matchplay head-to-head record between Rory McIlroy and Scottie Scheffler, including results, events, scores, and match history\./
  );
  assert.match(canonicalHtml, /<link rel="canonical" href="https:\/\/www\.matchplayrankings\.com\/head-to-head\/rory-mcilroy\/vs\/scottie-scheffler\/" \/>/);
  assert.match(canonicalHtml, /src="\.\.\/\.\.\/\.\.\/\.\.\/player-stats\.js"/);
  assert.match(canonicalHtml, /src="\.\.\/\.\.\/\.\.\/\.\.\/head-to-head\.js"/);
  assert.match(reverseHtml, /noindex, follow/);
  assert.match(reverseHtml, /Rory McIlroy vs Scottie Scheffler Head-to-Head Matchplay Record \| Matchplay Rankings/);
  assert.match(reverseHtml, /url=\/head-to-head\/rory-mcilroy\/vs\/scottie-scheffler\//);
});

test("comparison tool page exists and reuses shared statistics", () => {
  const compareHtml = fs.readFileSync(path.join(rootDir, "compare", "index.html"), "utf8");
  const compareSource = fs.readFileSync(path.join(rootDir, "compare.js"), "utf8");

  assert.match(compareHtml, /Compare Players \| Matchplay Rankings/);
  assert.match(compareHtml, /id="comparePlayerA"/);
  assert.match(compareHtml, /id="comparePlayerB"/);
  assert.match(compareHtml, /src="\/player-stats\.js"/);
  assert.match(compareHtml, /src="\/compare\.js"/);
  assert.match(compareSource, /buildPlayerProfileStats/);
  assert.match(compareSource, /calculateHeadToHeadRecord/);
  assert.match(compareSource, /URLSearchParams/);
  assert.match(compareSource, /players/);
  assert.match(compareSource, /POPULAR_COMPARISONS/);
  assert.match(compareSource, /tiger-woods/);
  assert.match(compareSource, /rory-mcilroy/);
  assert.match(compareSource, /compare-suggestion-card/);

  const rory = playerStats.buildPlayerProfileStats(playableMatches, "Rory McIlroy", { activeCutoff: 2020 });
  const scottie = playerStats.buildPlayerProfileStats(playableMatches, "Scottie Scheffler", { activeCutoff: 2020 });
  const h2h = playerStats.calculateHeadToHeadRecord(playableMatches, "Rory McIlroy", "Scottie Scheffler");
  assert.strictEqual(Math.round(rory.currentRating), 1176);
  assert.ok(scottie.record.matches > 0);
  assert.strictEqual(h2h.matches, 2);
  assert.strictEqual(h2h.playerA.points, 1);
  assert.strictEqual(h2h.playerB.points, 1);
});

test("event series pages are generated from archive data", () => {
  const eventSeriesHtml = fs.readFileSync(path.join(rootDir, "events", "ryder-cup", "index.html"), "utf8");
  const eventSeriesSource = fs.readFileSync(path.join(rootDir, "event-series.js"), "utf8");
  const eventUtilsSource = fs.readFileSync(path.join(rootDir, "event-utils.js"), "utf8");
  const eventDiscoverySource = fs.readFileSync(path.join(rootDir, "events-discovery.js"), "utf8");
  const eventsHtml = fs.readFileSync(path.join(rootDir, "events.html"), "utf8");

  assert.match(eventSeriesHtml, /data-event-series-slug="ryder-cup"/);
  assert.match(eventSeriesHtml, /Ryder Cup Matchplay Records &amp; Rankings \| Matchplay Rankings/);
  assert.match(
    eventSeriesHtml,
    /Explore Ryder Cup singles matchplay records, player rankings, match results, and historical performance data\./
  );
  assert.match(eventSeriesHtml, /<link rel="canonical" href="https:\/\/www\.matchplayrankings\.com\/events\/ryder-cup\/" \/>/);
  assert.match(eventSeriesHtml, /<meta property="og:title" content="Ryder Cup Matchplay Records &amp; Rankings \| Matchplay Rankings" \/>/);
  assert.match(eventSeriesHtml, /<meta name="twitter:title" content="Ryder Cup Matchplay Records &amp; Rankings \| Matchplay Rankings" \/>/);
  assert.match(eventSeriesHtml, /src="\/player-stats\.js"/);
  assert.match(eventSeriesHtml, /src="\/event-utils\.js"/);
  assert.match(eventSeriesHtml, /src="\/event-series\.js"/);
  assert.match(eventSeriesSource, /SERIES_CONFIG/);
  assert.match(eventUtilsSource, /coverage: "In progress"/);
  assert.match(eventSeriesSource, /uniqueMatches/);
  assert.match(eventSeriesSource, /Top Performers/);
  assert.match(eventSeriesSource, /Best Records/);
  assert.match(eventSeriesSource, /Most Matches Played/);
  assert.match(eventSeriesSource, /Highest Points Per Match/);
  assert.match(eventSeriesSource, /View edition/);
  assert.match(eventsHtml, /Matchplay event discovery/);
  assert.match(eventsHtml, /id="eventDiscoveryRoot"/);
  assert.match(eventsHtml, /id="eventEditionDiscoveryRoot"/);
  assert.match(eventsHtml, /id="eventDiscoverySearch"/);
  assert.match(eventsHtml, /src="events-discovery\.js"/);
  assert.match(eventDiscoverySource, /buildSeries/);
  assert.match(eventDiscoverySource, /Coverage/);
  assert.match(eventDiscoverySource, /latestYear/);
  assert.match(eventDiscoverySource, /buildFeaturedEditions/);

  const ryderRows = playableMatches.filter((match) => match.event === "Ryder Cup");
  const ryderUniqueMatches = playerStats.uniqueMatches(ryderRows);
  const ryderPlayers = new Set();
  ryderRows.forEach((match) => {
    ryderPlayers.add(match.player);
    ryderPlayers.add(match.opponent);
  });
  assert.strictEqual(ryderUniqueMatches.length, 517);
  assert.strictEqual(ryderPlayers.size, 350);
});

test("event edition pages are generated from archive data", () => {
  const editionHtml = fs.readFileSync(path.join(rootDir, "events", "ryder-cup", "2023", "index.html"), "utf8");
  const editionSource = fs.readFileSync(path.join(rootDir, "event-edition.js"), "utf8");

  assert.match(editionHtml, /data-event-series-slug="ryder-cup"/);
  assert.match(editionHtml, /data-event-edition-year="2023"/);
  assert.match(editionHtml, /2023 Ryder Cup Matchplay Results \| Matchplay Rankings/);
  assert.match(
    editionHtml,
    /View singles matchplay results, player records, and rating changes from the 2023 Ryder Cup\./
  );
  assert.match(editionHtml, /<link rel="canonical" href="https:\/\/www\.matchplayrankings\.com\/events\/ryder-cup\/2023\/" \/>/);
  assert.match(editionHtml, /<meta property="og:title" content="2023 Ryder Cup Matchplay Results \| Matchplay Rankings" \/>/);
  assert.match(editionHtml, /<meta name="twitter:title" content="2023 Ryder Cup Matchplay Results \| Matchplay Rankings" \/>/);
  assert.match(editionHtml, /src="\/event-utils\.js"/);
  assert.match(editionHtml, /src="\/event-edition\.js"/);
  assert.match(editionSource, /Singles Match Results/);
  assert.match(editionSource, /Biggest Rating Gains/);
  assert.match(editionSource, /getHeadToHeadHref/);
  assert.match(editionSource, /computePlayerRatingProfile/);

  const ryder2023Rows = playableMatches.filter((match) => match.event === "Ryder Cup" && match.year === 2023);
  const ryder2023Players = new Set();
  ryder2023Rows.forEach((match) => {
    ryder2023Players.add(match.player);
    ryder2023Players.add(match.opponent);
  });
  assert.strictEqual(playerStats.uniqueMatches(ryder2023Rows).length, 12);
  assert.strictEqual(ryder2023Players.size, 24);
});

test("404 page can fall back to the head-to-head renderer for non-generated pairs", () => {
  const notFoundHtml = fs.readFileSync(path.join(rootDir, "404.html"), "utf8");
  assert.match(notFoundHtml, /head-to-head\\\/\(\[\^\/\]\+\)\\\/vs\\\/\(\[\^\/\]\+\)/);
  assert.match(notFoundHtml, /document\.body\.dataset\.playerA/);
  assert.match(notFoundHtml, /\/player-stats\.js/);
  assert.match(notFoundHtml, /\/head-to-head\.js/);
});

test("best wins and worst losses skip entries without opponent ratings", () => {
  const { api } = loadPlayerApi();
  assert.deepStrictEqual(api.buildBestWins([{ result: "win", opponent: "Missing Rating" }]), []);
  assert.deepStrictEqual(api.buildWorstLosses([{ result: "loss", opponent: "Missing Rating", ratingDelta: -10 }]), []);

  const { timeline } = api.computePlayerRatingProfile(playableMatches, "Rory McIlroy");
  const bestWins = api.buildBestWins(timeline);
  const worstLosses = api.buildWorstLosses(timeline);
  assert.ok(bestWins.length > 0);
  assert.ok(worstLosses.length > 0);
  assert.ok(bestWins.every((match) => Number.isFinite(match.opponentRatingBefore)));
  assert.ok(worstLosses.every((match) => Number.isFinite(match.opponentRatingBefore)));
});

test("rating timeline uses an unavailable state when rating history is insufficient", () => {
  const { api } = loadPlayerApi();
  const empty = api.renderRatingTimelineSection([], null);
  const singlePoint = api.renderRatingTimelineSection([{ ratingAfter: 1000, year: 2024 }], null);

  assert.match(empty, /Not enough match history is available/);
  assert.doesNotMatch(empty, /player-profile-chart__line/);
  assert.match(singlePoint, /Not enough match history is available/);
  assert.doesNotMatch(singlePoint, /player-profile-chart__line/);
});

test("rankings and records player links resolve to generated profile routes", () => {
  const { api } = loadPlayerApi();
  const playerSlugMap = api.buildPlayerSlugMap(playersData.players);
  assert.strictEqual(api.getPlayerProfileHref(playerSlugMap, "Rory McIlroy"), "../rory-mcilroy/");
  assert.ok(fs.existsSync(path.join(rootDir, "players", "rory-mcilroy", "index.html")));

  const ratingSource = fs.readFileSync(path.join(rootDir, "rating.js"), "utf8");
  const recordsSource = fs.readFileSync(path.join(rootDir, "app.js"), "utf8");
  const playerSource = fs.readFileSync(path.join(rootDir, "player.js"), "utf8");
  const linealSource = fs.readFileSync(path.join(rootDir, "lineal.js"), "utf8");
  const linealHtml = fs.readFileSync(path.join(rootDir, "lineal.html"), "utf8");
  assert.match(ratingSource, /renderPlayerLink/);
  assert.match(ratingSource, /class="player-link"/);
  assert.match(ratingSource, /renderHeadToHeadLink/);
  assert.match(ratingSource, /renderCompareLink/);
  assert.match(ratingSource, /head-to-head-inline-link/);
  assert.match(recordsSource, /renderPlayerLink/);
  assert.match(recordsSource, /class="player-link"/);
  assert.match(recordsSource, /renderHeadToHeadLink/);
  assert.match(recordsSource, /renderCompareLink/);
  assert.match(recordsSource, /head-to-head-inline-link/);
  assert.match(playerSource, /renderHeadToHeadInlineLink/);
  assert.match(playerSource, /renderCompareInlineLink/);
  assert.match(playerSource, /head-to-head-inline-link/);
  assert.match(linealSource, /renderHeadToHeadLink/);
  assert.match(linealHtml, /<th>Matchup<\/th>/);
  const indexHtml = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  assert.match(indexHtml, /href="compare\/">Compare Players/);
  assert.match(indexHtml, /href="compare\/">Compare players/);
});

(async () => {
  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`not ok - ${name}`);
      console.error(error.stack || error);
    }
  }

  if (failures > 0) {
    console.error(`${failures} test${failures === 1 ? "" : "s"} failed`);
    process.exitCode = 1;
    return;
  }

  console.log(`${tests.length} tests passed`);
})();
