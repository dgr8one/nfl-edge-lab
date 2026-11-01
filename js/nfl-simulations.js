
(function () {
  "use strict";

  function normalRandom() {
    const u = Math.max(Math.random(), 1e-12);
    const v = Math.random();

    return Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v);
  }

  function simulateOver(projection, line, simulations = 50000) {
    const mean = Number(projection.adjusted_yards);
    const market = projection.market;

    if (!Number.isFinite(mean) ||
        !Number.isFinite(Number(line)) ||
        mean <= 0) {
      return null;
    }

    // Preliminary uncertainty assumptions.
    // These must be calibrated using historical results.
    const variation = market === "rushing" ? 0.42 : 0.48;
    const standardDeviation = Math.max(8, mean * variation);

    let wins = 0;

    for (let i = 0; i < simulations; i++) {
      const yards = Math.max(
        0,
        mean + normalRandom() * standardDeviation
      );

      if (yards > Number(line)) wins++;
    }

    return {
      player_name: projection.player_name,
      market,
      line: Number(line),
      projected_yards: mean,
      standard_deviation: standardDeviation,
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

    if (decimal === null ||
        !Number.isFinite(probability)) {
      return null;
    }

    return probability * decimal - 1;
  }

  window.NFLEdgeSimulations = {
    simulateOver,
    expectedROI,
    version: "1.0"
  };
})();
