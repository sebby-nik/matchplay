(function attachPlayerStats(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MatchplayStats = api;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  const EVENT_ORDER = [
    "WGC Match Play",
    "The World Match Play Championship",
    "World Match Play Championship",
    "Paul Lawrie Match Play",
    "Olympics",
    "PGA Championship",
    "Presidents Cup",
    "Seve Trophy",
    "Eurasia Cup",
    "The Royal Trophy",
    "Ryder Cup"
  ];
  const MONTH_ORDER = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
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

  const BASE_RATING = 1000;
  const YEAR_DECAY = 0.99;
  const MOV_MARGIN_CAP = 10;
  const MOV_MULTIPLIER_MIN = 0.75;
  const MOV_MULTIPLIER_MAX = 1.8;
  const MOV_NEUTRAL_SCORES = new Set(["ret", "wd", "won", "by default", "conceded"]);
  const FEATURED_EVENT_LABELS = ["Ryder Cup", "Presidents Cup", "WGC / Dell Match Play", "Seve Trophy"];

  const asText = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text || fallback;
  };

  const getIndex = (list, value) => {
    const index = list.indexOf(value);
    return index === -1 ? list.length : index;
  };

  const normalizeEventLabel = (event) => {
    const label = asText(event, "Unknown event");
    if (/\b(wgc|dell)\b/i.test(label) && /match play/i.test(label)) {
      return "WGC / Dell Match Play";
    }
    return label;
  };

  const sortEventRecords = (a, b) => {
    const eventOrder = EVENT_ORDER.map(normalizeEventLabel);
    const featuredDiff = getIndex(FEATURED_EVENT_LABELS, a.event) - getIndex(FEATURED_EVENT_LABELS, b.event);
    if (featuredDiff !== 0) return featuredDiff;
    const orderDiff = getIndex(eventOrder, a.event) - getIndex(eventOrder, b.event);
    if (orderDiff !== 0) return orderDiff;
    return a.event.localeCompare(b.event);
  };

  const getRecordRates = (record) => {
    const matches = Number(record?.matches) || 0;
    const points = Number(record?.points) || 0;
    const wins = Number(record?.wins) || 0;
    return {
      pointsPerMatch: matches ? points / matches : null,
      pointsPercentage: matches ? (points / matches) * 100 : null,
      winPercentage: matches ? (wins / matches) * 100 : null
    };
  };

  const uniqueMatches = (matches) => {
    const seen = new Set();
    const result = [];
    (Array.isArray(matches) ? matches : []).forEach((match) => {
      if (!match?.player || !match?.opponent) return;
      const players = [match.player, match.opponent].sort().join(" vs ");
      const key = `${match.event}|${match.year}|${match.round}|${players}|${match.score}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(match);
    });
    return result;
  };

  const sortMatches = (matches) =>
    uniqueMatches(matches)
      .slice()
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        const monthDiff = getIndex(MONTH_ORDER, a.month) - getIndex(MONTH_ORDER, b.month);
        if (monthDiff !== 0) return monthDiff;
        const eventDiff = getIndex(EVENT_ORDER, a.event) - getIndex(EVENT_ORDER, b.event);
        if (eventDiff !== 0) return eventDiff;
        const roundDiff = getIndex(ROUND_ORDER, a.round) - getIndex(ROUND_ORDER, b.round);
        if (roundDiff !== 0) return roundDiff;
        return asText(a.player).localeCompare(asText(b.player));
      });

  const expectedScore = (rating, opponentRating) =>
    1 / (1 + Math.pow(10, (opponentRating - rating) / 400));

  const kFactor = (matchesPlayed) => {
    if (matchesPlayed < 10) return 40;
    if (matchesPlayed < 30) return 30;
    return 20;
  };

  const normalizeScoreText = (value) =>
    (value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  const parseMarginFromScore = (scoreText) => {
    const score = normalizeScoreText(scoreText);
    if (!score || score === "halved" || MOV_NEUTRAL_SCORES.has(score)) return null;
    if (/^\d+h$/.test(score)) return 1;
    const andMatch = score.match(/^(\d+)\s*(?:&|and)\s*(\d+)$/);
    if (andMatch) return Number(andMatch[1]);
    const andUpMatch = score.match(/^(\d+)\s+and\s+up$/);
    if (andUpMatch) return Number(andUpMatch[1]);
    const upMatch = score.match(/^(\d+)\s*-?\s*up(?:\s*\(\d+\))?$/);
    if (upMatch) return Number(upMatch[1]);
    return null;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const computeMovMultiplier = (result, scoreText, playerRating, opponentRating) => {
    if (result === "halved") return 1;
    const parsedMargin = parseMarginFromScore(scoreText);
    if (!Number.isFinite(parsedMargin) || parsedMargin <= 0) return 1;
    const margin = clamp(parsedMargin, 1, MOV_MARGIN_CAP);
    const winnerRating = result === "win" ? playerRating : opponentRating;
    const loserRating = result === "win" ? opponentRating : playerRating;
    const winnerDelta = winnerRating - loserRating;
    const rawMultiplier = Math.log(margin + 1) * (2.2 / (winnerDelta * 0.001 + 2.2));
    if (!Number.isFinite(rawMultiplier) || rawMultiplier <= 0) return 1;
    return clamp(rawMultiplier, MOV_MULTIPLIER_MIN, MOV_MULTIPLIER_MAX);
  };

  const ensureRatingPlayer = (ratings, name, country) => {
    if (!ratings.has(name)) {
      ratings.set(name, {
        name,
        country: country || "",
        rating: BASE_RATING,
        peak: BASE_RATING,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        lastYear: null
      });
    } else if (country && !ratings.get(name).country) {
      ratings.get(name).country = country;
    }
    return ratings.get(name);
  };

  const deriveRatingTimeline = (matches, playerName) => {
    const ratings = new Map();
    const timeline = [];
    let currentYear = null;

    sortMatches(matches).forEach((match) => {
      if (currentYear === null) currentYear = match.year;
      if (match.year !== currentYear) {
        ratings.forEach((entry) => {
          entry.rating = BASE_RATING + (entry.rating - BASE_RATING) * YEAR_DECAY;
        });
        currentYear = match.year;
      }

      const player = ensureRatingPlayer(ratings, match.player, match.player_country);
      const opponent = ensureRatingPlayer(ratings, match.opponent, match.opponent_country);
      const playerBefore = player.rating;
      const opponentBefore = opponent.rating;
      const playerExpected = expectedScore(player.rating, opponent.rating);
      const opponentExpected = expectedScore(opponent.rating, player.rating);
      let score = 0.5;
      if (match.result === "win") score = 1;
      if (match.result === "loss") score = 0;

      const multiplier = computeMovMultiplier(match.result, match.score, player.rating, opponent.rating);
      player.rating += kFactor(player.matches) * multiplier * (score - playerExpected);
      opponent.rating += kFactor(opponent.matches) * multiplier * ((1 - score) - opponentExpected);

      player.matches += 1;
      opponent.matches += 1;
      player.lastYear = match.year;
      opponent.lastYear = match.year;
      if (score === 1) {
        player.wins += 1;
        opponent.losses += 1;
      } else if (score === 0) {
        player.losses += 1;
        opponent.wins += 1;
      } else {
        player.draws += 1;
        opponent.draws += 1;
      }
      if (player.rating > player.peak) player.peak = player.rating;
      if (opponent.rating > opponent.peak) opponent.peak = opponent.rating;

      if (match.player === playerName || match.opponent === playerName) {
        const isPlayerSide = match.player === playerName;
        const before = isPlayerSide ? playerBefore : opponentBefore;
        const after = isPlayerSide ? player.rating : opponent.rating;
        const opponentBeforeRating = isPlayerSide ? opponentBefore : playerBefore;
        const result = isPlayerSide
          ? match.result
          : match.result === "win"
            ? "loss"
            : match.result === "loss"
              ? "win"
              : "halved";
        timeline.push({
          event: match.event,
          year: match.year,
          month: match.month,
          round: match.round,
          opponent: isPlayerSide ? match.opponent : match.player,
          opponentCountry: isPlayerSide ? match.opponent_country : match.player_country,
          result,
          score: match.score,
          ratingBefore: before,
          ratingAfter: after,
          ratingDelta: after - before,
          opponentRatingBefore: opponentBeforeRating
        });
      }
    });

    const allRatings = Array.from(ratings.values())
      .filter((entry) => entry.matches > 0 && Number.isFinite(entry.rating))
      .sort((a, b) => b.rating - a.rating || b.peak - a.peak || b.matches - a.matches || a.name.localeCompare(b.name));

    return { rating: ratings.get(playerName) || null, timeline, allRatings };
  };

  const calculateOverallRecord = (matches, playerName) => {
    const record = { matches: 0, points: 0, wins: 0, draws: 0, losses: 0, lastYear: 0 };
    (Array.isArray(matches) ? matches : [])
      .filter((match) => match.player === playerName)
      .forEach((match) => {
        record.matches += 1;
        record.points += Number(match.points || 0);
        if (match.result === "win") record.wins += 1;
        if (match.result === "halved") record.draws += 1;
        if (match.result === "loss") record.losses += 1;
        record.lastYear = Math.max(record.lastYear, Number(match.year) || 0);
      });
    return { ...record, ...getRecordRates(record) };
  };

  const buildEventRecords = (matches, playerName) => {
    const eventTypes = new Set((Array.isArray(matches) ? matches : []).map((match) => normalizeEventLabel(match.event)));
    const breakdown = new Map(
      Array.from(eventTypes).map((event) => [
        event,
        { event, matches: 0, wins: 0, draws: 0, losses: 0, points: 0 }
      ])
    );

    (Array.isArray(matches) ? matches : [])
      .filter((match) => match.player === playerName)
      .forEach((match) => {
        const event = normalizeEventLabel(match.event);
        if (!breakdown.has(event)) {
          breakdown.set(event, { event, matches: 0, wins: 0, draws: 0, losses: 0, points: 0 });
        }
        const split = breakdown.get(event);
        split.matches += 1;
        split.points += Number(match.points || 0);
        if (match.result === "win") split.wins += 1;
        if (match.result === "halved") split.draws += 1;
        if (match.result === "loss") split.losses += 1;
      });

    return Array.from(breakdown.values())
      .map((record) => ({ ...record, ...getRecordRates(record) }))
      .sort(sortEventRecords);
  };

  const formatMatchDate = (match) => {
    const month = asText(match.month);
    const year = asText(match.year);
    return month && year ? `${month} ${year}` : year || "Date unavailable";
  };

  const getMatchSortValue = (match) => {
    const year = Number(match.year) || 0;
    return year * 100 + getIndex(MONTH_ORDER, match.month);
  };

  const buildHeadToHeadRecords = (timeline) => {
    const records = new Map();

    (Array.isArray(timeline) ? timeline : []).forEach((match) => {
      const opponent = asText(match.opponent);
      if (!opponent) return;
      if (!records.has(opponent)) {
        records.set(opponent, {
          opponent,
          opponentCountry: match.opponentCountry || "",
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          latestMeeting: "",
          latestSortValue: 0
        });
      }

      const record = records.get(opponent);
      record.matches += 1;
      if (match.result === "win") {
        record.wins += 1;
        record.points += 1;
      } else if (match.result === "loss") {
        record.losses += 1;
      } else {
        record.draws += 1;
        record.points += 0.5;
      }

      const sortValue = getMatchSortValue(match);
      if (sortValue >= record.latestSortValue) {
        record.latestSortValue = sortValue;
        record.latestMeeting = formatMatchDate(match);
      }
    });

    return Array.from(records.values()).map((record) => ({
      ...record,
      ...getRecordRates(record)
    }));
  };

  const buildBestWins = (timeline, limit = 5) =>
    (Array.isArray(timeline) ? timeline : [])
      .filter((match) => match.result === "win" && Number.isFinite(match.opponentRatingBefore))
      .slice()
      .sort((a, b) => b.opponentRatingBefore - a.opponentRatingBefore || b.ratingDelta - a.ratingDelta)
      .slice(0, limit);

  const buildWorstLosses = (timeline, limit = 5) =>
    (Array.isArray(timeline) ? timeline : [])
      .filter((match) => match.result === "loss" && Number.isFinite(match.opponentRatingBefore))
      .slice()
      .sort((a, b) => a.ratingDelta - b.ratingDelta || a.opponentRatingBefore - b.opponentRatingBefore)
      .slice(0, limit);

  const getCurrentRating = (ratingProfile) =>
    Number.isFinite(ratingProfile?.rating?.rating) ? ratingProfile.rating.rating : null;

  const getPeakRating = (ratingProfile) =>
    Number.isFinite(ratingProfile?.rating?.peak) ? ratingProfile.rating.peak : null;

  const getCurrentRanking = (allRatings, playerName, activeCutoff = 0) => {
    const currentRatings = (Array.isArray(allRatings) ? allRatings : []).filter(
      (entry) => !activeCutoff || entry.lastYear >= activeCutoff
    );
    const index = currentRatings.findIndex((entry) => entry.name === playerName);
    return index === -1 ? null : index + 1;
  };

  const buildPlayerProfileStats = (matches, playerName, options = {}) => {
    const record = calculateOverallRecord(matches, playerName);
    const ratingProfile = deriveRatingTimeline(matches, playerName);
    const currentRanking = getCurrentRanking(ratingProfile.allRatings, playerName, options.activeCutoff || 0);
    const eventRecords = buildEventRecords(matches, playerName);
    const headToHeadRecords = buildHeadToHeadRecords(ratingProfile.timeline);

    return {
      record,
      rating: ratingProfile.rating,
      timeline: ratingProfile.timeline,
      allRatings: ratingProfile.allRatings,
      currentRating: getCurrentRating(ratingProfile),
      peakRating: getPeakRating(ratingProfile),
      currentRanking,
      eventRecords,
      headToHeadRecords,
      bestWins: buildBestWins(ratingProfile.timeline),
      worstLosses: buildWorstLosses(ratingProfile.timeline)
    };
  };

  return {
    constants: {
      EVENT_ORDER,
      MONTH_ORDER,
      ROUND_ORDER,
      BASE_RATING,
      YEAR_DECAY,
      FEATURED_EVENT_LABELS
    },
    asText,
    getRecordRates,
    normalizeEventLabel,
    sortEventRecords,
    uniqueMatches,
    sortMatches,
    deriveRatingTimeline,
    computePlayerRatingProfile: deriveRatingTimeline,
    calculateOverallRecord,
    calculateRecord: calculateOverallRecord,
    buildEventRecords,
    buildEventBreakdown: buildEventRecords,
    buildHeadToHeadRecords,
    buildBestWins,
    buildWorstLosses,
    formatMatchDate,
    getCurrentRating,
    getPeakRating,
    getCurrentRanking,
    buildPlayerProfileStats
  };
});
