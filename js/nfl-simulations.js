
(function () {
  "use strict";

  function normalRandom() {
    const u = Math.max(Math.random(), 1e-12);
    const v = Math.random();

    return Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v);
  }

  function sampleStandardDeviation(values) {
    if (values.length < 2) return null;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    const variance = values.reduce(
      (sum, value) => sum + Math.pow(value - mean, 2),
      0
    ) / (values.length - 1);

    return Math.sqrt(variance);
  }

  function estimateStandardDeviation(projection, mean) {
    const market = projection.market;

    // Fallback only; these assumptions still require backtesting.
    const variation = market === "rushing" ? 0.42 : 0.48;
    const fallbackSD = Math.max(8, mean * variation);

    const history = Array.isArray(projection.weekly_yards)
      ? projection.weekly_yards
          .map(Number)
          .filter(v => Number.isFinite(v) && v >= 0)
      : [];

    if (history.length < 3) {
      return {
        sd: fallbackSD,
        source: "fallback",
        games: history.length
      };
    }

    const historicalSD = sampleStandardDeviation(history);

    if (!Number.isFinite(historicalSD)) {
      return {
        sd: fallbackSD,
        source: "fallback",
        games: history.length
      };
    }

    // Shrink small samples toward the fallback.
    // This is a provisional heuristic, not a calibrated parameter.
    const weight = history.length / (history.length + 8);

    const blendedVariance =
      weight * historicalSD * historicalSD +
      (1 - weight) * fallbackSD * fallbackSD;

    return {
      sd: Math.max(5, Math.sqrt(blendedVariance)),
      source: "historical_blend",
      games: history.length
    };
  }

  function simulateOver(projection, line, simulations = 50000) {
    const mean = Number(projection.adjusted_yards);
    const threshold = Number(line);
    const market = projection.market;

    if (
      !Number.isFinite(mean) ||
      !Number.isFinite(threshold) ||
      mean <= 0 ||
      !Number.isInteger(simulations) ||
      simulations <= 0
    ) {
      return null;
    }

    const uncertainty = estimateStandardDeviation(projection, mean);
    const standardDeviation = uncertainty.sd;

    let wins = 0;

    for (let i = 0; i < simulations; i++) {
      const yards = Math.max(
        0,
        mean + normalRandom() * standardDeviation
      );

      if (yards > threshold) wins++;
    }

    return {
      player_name: projection.player_name,
      market,
      line: threshold,
      projected_yards: mean,
      standard_deviation: standardDeviation,
      variance_source: uncertainty.source,
      historical_games: uncertainty.games,
      simulations,
      over_probability: wins / simulations
    };
  }

  function americanToDecimal(odds) {
    const value = Number(odds);

    if (!Number.isFinite(value) || value === 0) return null;

    return value > 0
      ? 1 + value / 100
      : 1 + 100 / Math.abs(value);
  }

  function expectedROI(probability, americanOdds) {
    const decimal = americanToDecimal(americanOdds);

    if (
      decimal === null ||
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      return null;
    }

    return probability * decimal - 1;
  }

  window.NFLEdgeSimulations = {
    simulateOver,
    expectedROI,
    version: "1.1"
  };
})();
