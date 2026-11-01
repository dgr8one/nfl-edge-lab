
/*
 * NFL Edge Lab — Matchup and Usage Engine v1
 * Historical defensive adjustments.
 * No odds API calls.
 */

(function () {
  "use strict";

  const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const avg = values =>
    values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;

  const clamp = (x, lo, hi) =>
    Math.max(lo, Math.min(hi, x));

  const normalizeTeam = team => {
    const aliases = {
      JAX: "JAC",
      LA: "LAR",
      STL: "LAR",
      SD: "LAC",
      OAK: "LV",
      WSH: "WAS"
    };

    const key = String(team || "").toUpperCase();
    return aliases[key] || key;
  };

  function buildDefenseRatings(records) {
    const games = new Map();

    for (const row of records) {
      const opponent = normalizeTeam(row.opponent_team);
      const offense = normalizeTeam(
        row.recent_team || row.team
      );
      const week = num(row.week);

      if (!opponent || !offense || !week) continue;

      const key = [week, opponent, offense].join("|");

      if (!games.has(key)) {
        games.set(key, {
          opponent,
          week,
          rushing: 0,
          receiving: 0
        });
      }

      const game = games.get(key);

      game.rushing += num(row.rushing_yards);
      game.receiving += num(row.receiving_yards);
    }

    const allGames = [...games.values()];

    const league = {
      rushing: avg(allGames.map(g => g.rushing)),
      receiving: avg(allGames.map(g => g.receiving))
    };

    const defenses = {};

    for (const game of allGames) {
      if (!defenses[game.opponent]) {
        defenses[game.opponent] = [];
      }
      defenses[game.opponent].push(game);
    }

    const ratings = {};

    for (const [team, rows] of Object.entries(defenses)) {
      ratings[team] = {};

      for (const market of ["rushing", "receiving"]) {
        const allowed = avg(rows.map(g => g[market]));
        const leagueAverage = league[market];

        // Shrink small samples toward league average.
        const sampleWeight = rows.length / (rows.length + 8);

        const rawFactor = leagueAverage > 0
          ? allowed / leagueAverage
          : 1;

        const factor = clamp(
          1 + sampleWeight * (rawFactor - 1),
          0.85,
          1.15
        );

        ratings[team][market] = {
          games: rows.length,
          yards_allowed_per_game: allowed,
          league_average: leagueAverage,
          factor
        };
      }
    }

    return ratings;
  }

  function adjustProjection(projection, opponent, ratings) {
    const team = normalizeTeam(opponent);
    const market = projection.market;
    const defense = ratings[team]?.[market];

    if (!defense) {
      return {
        ...projection,
        opponent: team,
        matchup_factor: 1,
        matchup_available: false,
        adjusted_yards: projection.projected_yards
      };
    }

    return {
      ...projection,
      opponent: team,
      matchup_factor: defense.factor,
      matchup_available: true,
      defensive_games: defense.games,
      adjusted_yards:
        projection.projected_yards * defense.factor
    };
  }

  function usageTrend(projection) {
    const season = num(projection.season_usage_average);
    const recent = num(projection.recent_usage_average);

    if (season <= 0) {
      return {
        usage_change: null,
        usage_direction: "Unknown"
      };
    }

    const change = recent / season - 1;

    return {
      usage_change: change,
      usage_direction:
        change > 0.10 ? "Increasing" :
        change < -0.10 ? "Decreasing" :
        "Stable"
    };
  }

  window.NFLEdgeMatchups = {
    buildDefenseRatings,
    adjustProjection,
    usageTrend,
    version: "1.0"
  };
})();
