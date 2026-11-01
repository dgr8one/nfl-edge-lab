
(function () {
  "use strict";

  function randomNormal() {
    const u = Math.max(Math.random(), 1e-12);
    const v = Math.random();

    return Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v);
  }

  function gamma(shape) {
    if (shape < 1) {
      return gamma(shape + 1) *
        Math.pow(
          Math.max(Math.random(), 1e-12),
          1 / shape
        );
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    for (;;) {
      const x = randomNormal();
      const v = 1 + c * x;

      if (v <= 0) continue;

      const cube = v * v * v;
      const u = Math.random();

      if (
        u < 1 - 0.0331 * x * x * x * x ||
        Math.log(u) <
          0.5 * x * x +
          d * (1 - cube + Math.log(cube))
      ) {
        return d * cube;
      }
    }
  }

  function sampleSD(a) {
    if (a.length < 2) return null;

    const mean =
      a.reduce((s, x) => s + x, 0) / a.length;

    return Math.sqrt(
      a.reduce(
        (s, x) => s + (x - mean) ** 2,
        0
      ) / (a.length - 1)
    );
  }

  function uncertainty(p, mean) {
    const hist = Array.isArray(p.weekly_yards)
      ? p.weekly_yards
          .map(Number)
          .filter(x => Number.isFinite(x) && x >= 0)
      : [];

    const fallback = Math.max(
      10,
      mean * (p.market === "rushing" ? 0.55 : 0.65)
    );

    const sd = sampleSD(hist);

    const w = hist.length >= 3
      ? hist.length / (hist.length + 12)
      : 0;

    const blended = Math.sqrt(
      w * (sd || 0) ** 2 +
      (1 - w) * fallback ** 2
    );

    return {
      sd: Math.max(8, blended),
      games: hist.length,
      source: w ? "historical_blend" : "fallback"
    };
  }

  function simulateOver(
    p,
    line,
    simulations = 50000
  ) {
    const mean = Number(p.adjusted_yards);
    const threshold = Number(line);

    if (
      !Number.isFinite(mean) ||
      mean <= 0 ||
      !Number.isFinite(threshold) ||
      !Number.isInteger(simulations) ||
      simulations < 1
    ) {
      return null;
    }

    const u = uncertainty(p, mean);

    // Nonnegative, right-skewed distribution.
    // Parameters are heuristic, not backtested.

    const shape = Math.max(
      0.3,
      (mean / u.sd) ** 2
    );

    const scale = mean / shape;

    let wins = 0;

    for (let i = 0; i < simulations; i++) {
      const yards = gamma(shape) * scale;

      if (yards > threshold) wins++;
    }

    return {
      player_name: p.player_name,
      market: p.market,
      line: threshold,
      projected_yards: mean,
      standard_deviation: u.sd,
      variance_source: u.source,
      historical_games: u.games,
      distribution: "gamma_heuristic",
      simulations,
      over_probability: wins / simulations
    };
  }

  function expectedROI(prob, odds) {
    const o = Number(odds);

    if (
      !Number.isFinite(prob) ||
      prob < 0 ||
      prob > 1 ||
      !Number.isFinite(o) ||
      o === 0
    ) {
      return null;
    }

    const decimal = o > 0
      ? 1 + o / 100
      : 1 + 100 / Math.abs(o);

    return prob * decimal - 1;
  }

  window.NFLEdgeSimulations = {
    simulateOver,
    expectedROI,
    version: "2.0"
  };
})();
