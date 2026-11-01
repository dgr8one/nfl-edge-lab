
/*
 * NFL Edge Lab — Player Projection Engine v1
 * Uses 2026 weekly player statistics.
 * No sportsbook odds or API key required.
 */

(function () {
  "use strict";

  const NUMERIC_FIELDS = [
    "carries",
    "rushing_yards",
    "targets",
    "receptions",
    "receiving_yards"
  ];

  function number(value) {
    if (value === null || value === undefined || value === "") {
      return 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function standardDeviation(values) {
    if (values.length < 2) return 0;

    const mean = average(values);
    const variance = values.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0
    ) / (values.length - 1);

    return Math.sqrt(variance);
  }

  function normalCDF(x) {
    const z = x / Math.sqrt(2);
    const t = 1 / (1 + 0.3275911 * Math.abs(z));

    const erf = 1 - (
      (
        (
          (
            (1.061405429 * t - 1.453152027) * t
            + 1.421413741
          ) * t - 0.284496736
        ) * t + 0.254829592
      ) * t
    ) * Math.exp(-z * z);

    const signedErf = x < 0 ? -erf : erf;
    return 0.5 * (1 + signedErf);
  }

  function groupPlayers(records) {
    const groups = new Map();

    for (const row of records) {
      if (!row.player_id) continue;

      const week = Number(row.week);
      if (!Number.isInteger(week) || week < 1) continue;

      const key = String(row.player_id);

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    for (const games of groups.values()) {
      games.sort((a, b) => Number(a.week) - Number(b.week));
    }

    return groups;
  }

  function buildPlayerProjection(games, market) {
    const field = market === "rushing"
      ? "rushing_yards"
      : "receiving_yards";

    const usageField = market === "rushing"
      ? "carries"
      : "targets";

    const values = games.map(g => number(g[field]));
    const usage = games.map(g => number(g[usageField]));

    if (values.length < 3) return null;

    const last3 = values.slice(-3);
    const last5 = values.slice(-5);

    const seasonAverage = average(values);
    const recent3Average = average(last3);
    const recent5Average = average(last5);

    const projectedYards =
      0.40 * seasonAverage +
      0.35 * recent3Average +
      0.25 * recent5Average;

    const volatility = standardDeviation(values);

    return {
      player_id: games[games.length - 1].player_id,
      player_name:
        games[games.length - 1].player_display_name ||
        games[games.length - 1].player_name,
      team:
        games[games.length - 1].recent_team ||
        games[games.length - 1].team,
      market,
      games_played: values.length,
      season_average: seasonAverage,
      last3_average: recent3Average,
      last5_average: recent5Average,
      season_usage_average: average(usage),
      recent_usage_average: average(usage.slice(-3)),
      projected_yards: projectedYards,
      standard_deviation: volatility
    };
  }

  function buildProjections(records) {
    if (!Array.isArray(records)) {
      throw new Error("Expected an array of player records");
    }

    const groups = groupPlayers(records);
    const projections = [];

    for (const games of groups.values()) {
      for (const market of ["rushing", "receiving"]) {
        const result = buildPlayerProjection(games, market);
        if (result) projections.push(result);
      }
    }

    return projections;
  }

  function overProbability(projection, line) {
    const mean = Number(projection.projected_yards);
    const sd = Number(projection.standard_deviation);
    const threshold = Number(line);

    if (![mean, sd, threshold].every(Number.isFinite)) {
      return null;
    }

    if (sd <= 0) return null;

    return Math.max(
      0,
      Math.min(1, 1 - normalCDF((threshold - mean) / sd))
    );
  }

  window.NFLEdgeProjections = {
    buildProjections,
    overProbability,
    version: "1.0"
  };
})();
