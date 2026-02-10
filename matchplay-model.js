(function () {
  const DEFAULT_EVENT_ORDER = ["WGC Match Play", "Olympics", "Presidents Cup", "Seve Trophy", "Ryder Cup", "PGA Championship"];
  const DEFAULT_MONTH_ORDER = [
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
  const DEFAULT_ROUND_ORDER = [
    "Pool Play",
    "Round of 128",
    "Round of 64",
    "Round of 32",
    "Round of 16",
    "Fourth Round",
    "Third Round",
    "Quarterfinals",
    "Semifinals",
    "Third Place",
    "Final",
    "Singles"
  ];

  const normalizeName = (value) => {
    if (!value) return "";
    const map = {
      ø: "o",
      Ø: "O",
      æ: "ae",
      Æ: "AE",
      å: "a",
      Å: "A",
      ñ: "n",
      Ñ: "N",
      ç: "c",
      Ç: "C",
      á: "a",
      Á: "A",
      é: "e",
      É: "E",
      í: "i",
      Í: "I",
      ß: "ss",
      ẞ: "SS"
    };
    const mapped = value.replace(/[øØæÆåÅñÑçÇáÁéÉíÍßẞ]/g, (char) => map[char] || char);
    return mapped
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const getIndex = (list, value) => {
    const idx = list.indexOf(value);
    return idx === -1 ? list.length : idx;
  };

  const dedupeMatches = (matches) => {
    const seen = new Set();
    const unique = [];

    (matches || []).forEach((match) => {
      if (!match || !match.player || !match.opponent) return;
      const [left, right] = [match.player, match.opponent].sort();
      const key = [
        match.event || "",
        match.year || "",
        match.month || "",
        match.round || "",
        left,
        right,
        match.score || ""
      ].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(match);
    });

    return unique;
  };

  const sortMatchesByChronology = (matches, options = {}) => {
    const eventOrder = options.eventOrder || DEFAULT_EVENT_ORDER;
    const monthOrder = options.monthOrder || DEFAULT_MONTH_ORDER;
    const roundOrder = options.roundOrder || DEFAULT_ROUND_ORDER;

    return dedupeMatches(matches)
      .slice()
      .sort((a, b) => {
        if ((a.year || 0) !== (b.year || 0)) return (a.year || 0) - (b.year || 0);
        const monthDiff = getIndex(monthOrder, a.month) - getIndex(monthOrder, b.month);
        if (monthDiff !== 0) return monthDiff;
        const eventDiff = getIndex(eventOrder, a.event) - getIndex(eventOrder, b.event);
        if (eventDiff !== 0) return eventDiff;
        const roundDiff = getIndex(roundOrder, a.round) - getIndex(roundOrder, b.round);
        if (roundDiff !== 0) return roundDiff;
        return String(a.player).localeCompare(String(b.player));
      });
  };

  const expectedScore = (rating, opponentRating) =>
    1 / (1 + Math.pow(10, (opponentRating - rating) / 400));

  const getCalibrationBin = (delta, calibrationBin) =>
    Math.round(delta / calibrationBin) * calibrationBin;

  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  const getKFactor = (matchesPlayed) => {
    if (matchesPlayed < 10) return 40;
    if (matchesPlayed < 30) return 30;
    return 20;
  };

  const ensurePlayer = (ratings, name, country, baseRating) => {
    if (!ratings.has(name)) {
      ratings.set(name, {
        name,
        country: country || "",
        rating: baseRating,
        peak: baseRating,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        lastYear: null,
        matchList: [],
        history: []
      });
    } else if (country && !ratings.get(name).country) {
      ratings.get(name).country = country;
    }
    return ratings.get(name);
  };

  const addMatchToPlayer = (player, match, opponent, result, delta) => {
    player.matchList.push({
      event: match.event,
      year: match.year,
      month: match.month,
      round: match.round,
      opponent,
      result,
      score: match.score,
      delta
    });
  };

  const computeRatingsAndCalibration = (matches, options = {}) => {
    const baseRating = options.baseRating ?? 1000;
    const yearDecay = options.yearDecay ?? 0.99;
    const calibrationBin = options.calibrationBin ?? 25;
    const calibrationPrior = options.calibrationPrior ?? 1;

    const ordered = sortMatchesByChronology(matches, options);
    const ratings = new Map();
    const calibrationMap = new Map();
    let calibrationTotal = 0;
    let currentYear = null;

    ordered.forEach((match) => {
      if (currentYear === null) currentYear = match.year;
      if (match.year !== currentYear) {
        ratings.forEach((entry) => {
          entry.rating = baseRating + (entry.rating - baseRating) * yearDecay;
        });
        currentYear = match.year;
      }

      const player = ensurePlayer(ratings, match.player, match.player_country, baseRating);
      const opponent = ensurePlayer(ratings, match.opponent, match.opponent_country, baseRating);

      const playerExpected = expectedScore(player.rating, opponent.rating);
      const opponentExpected = expectedScore(opponent.rating, player.rating);

      let score = 0.5;
      if (match.result === "win") score = 1;
      if (match.result === "loss") score = 0;

      const playerK = getKFactor(player.matches);
      const opponentK = getKFactor(opponent.matches);

      const playerBefore = player.rating;
      const opponentBefore = opponent.rating;

      const bin = getCalibrationBin(player.rating - opponent.rating, calibrationBin);
      if (!calibrationMap.has(bin)) {
        calibrationMap.set(bin, { wins: 0, draws: 0, losses: 0, total: 0 });
      }
      const bucket = calibrationMap.get(bin);
      if (match.result === "win") bucket.wins += 1;
      else if (match.result === "loss") bucket.losses += 1;
      else bucket.draws += 1;
      bucket.total += 1;
      calibrationTotal += 1;

      player.rating = player.rating + playerK * (score - playerExpected);
      opponent.rating = opponent.rating + opponentK * ((1 - score) - opponentExpected);

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
      player.history.push(player.rating);
      opponent.history.push(opponent.rating);

      const opponentResult =
        match.result === "win" ? "loss" : match.result === "loss" ? "win" : "halved";
      const playerDelta = player.rating - playerBefore;
      const opponentDelta = opponent.rating - opponentBefore;
      addMatchToPlayer(player, match, match.opponent, match.result, playerDelta);
      addMatchToPlayer(opponent, match, match.player, opponentResult, opponentDelta);
    });

    const calibrationBins = {};
    calibrationMap.forEach((bucket, bin) => {
      const total = bucket.total + calibrationPrior * 3;
      calibrationBins[bin] = {
        wins: (bucket.wins + calibrationPrior) / total,
        draws: (bucket.draws + calibrationPrior) / total,
        losses: (bucket.losses + calibrationPrior) / total,
        total: bucket.total
      };
    });

    return {
      ratings: Array.from(ratings.values()),
      ratingsByName: ratings,
      calibration: {
        bins: calibrationBins,
        total: calibrationTotal
      }
    };
  };

  const getCalibratedOutcomeProbability = (
    rating,
    opponentRating,
    calibration,
    options = {}
  ) => {
    const calibrationBin = options.calibrationBin ?? 25;
    const calibrationMinMatches = options.calibrationMinMatches ?? 8;
    const delta = rating - opponentRating;
    const baseWin = expectedScore(rating, opponentRating);
    const baseLoss = 1 - baseWin;

    if (!calibration || !calibration.bins) {
      return { win: baseWin, draw: 0, loss: baseLoss, source: "elo" };
    }

    const bin = getCalibrationBin(delta, calibrationBin);
    const bucket = calibration.bins[String(bin)];
    if (!bucket || bucket.total < calibrationMinMatches) {
      return { win: baseWin, draw: 0, loss: baseLoss, source: "elo" };
    }

    const win = clamp01(bucket.wins);
    const draw = clamp01(bucket.draws);
    const loss = clamp01(1 - win - draw);
    return { win, draw, loss, source: "calibrated", bin };
  };

  const blendWithHeadToHead = (baseline, h2hCounts, k = 12) => {
    const total = h2hCounts?.total || 0;
    if (!total) {
      return {
        win: clamp01(baseline.win || 0),
        draw: clamp01(baseline.draw || 0),
        loss: clamp01(baseline.loss || 0),
        weight: 0,
        sample: 0
      };
    }

    const empirical = {
      win: (h2hCounts.wins || 0) / total,
      draw: (h2hCounts.draws || 0) / total,
      loss: (h2hCounts.losses || 0) / total
    };

    const w = total / (total + k);
    let win = (1 - w) * (baseline.win || 0) + w * empirical.win;
    let draw = (1 - w) * (baseline.draw || 0) + w * empirical.draw;
    let loss = (1 - w) * (baseline.loss || 0) + w * empirical.loss;
    const sum = win + draw + loss;

    if (sum > 0) {
      win /= sum;
      draw /= sum;
      loss /= sum;
    }

    return {
      win: clamp01(win),
      draw: clamp01(draw),
      loss: clamp01(loss),
      weight: w,
      sample: total
    };
  };

  window.MatchplayModel = {
    normalizeName,
    dedupeMatches,
    sortMatchesByChronology,
    computeRatingsAndCalibration,
    getCalibratedOutcomeProbability,
    blendWithHeadToHead
  };
})();
