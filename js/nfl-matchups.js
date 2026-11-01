
(function () {
  "use strict";

  const num = x =>
    Number.isFinite(Number(x)) ? Number(x) : 0;

  const avg = a => a.length
    ? a.reduce((s, x) => s + x, 0) / a.length : 0;

  const clamp = (x, a, b) =>
    Math.max(a, Math.min(b, x));

  const normalizeTeam = x => ({
    JAX: "JAC",
    LA: "LAR",
    STL: "LAR",
    SD: "LAC",
    OAK: "LV",
    WSH: "WAS"
  }[String(x || "").toUpperCase()] ||
    String(x || "").toUpperCase());

  function buildDefenseRatings(records) {
    const games = new Map();
    const seen = new Set();

    for (const r of records || []) {
      if (
        Number(r.season) !== 2026 ||
        String(r.season_type || "").toUpperCase() !== "REG"
      ) continue;

      const opp = normalizeTeam(r.opponent_team);
      const off = normalizeTeam(r.recent_team || r.team);
      const week = Number(r.week);

      if (
        !opp || !off ||
        !Number.isInteger(week) ||
        week < 1 || !r.player_id
      ) continue;

      const dedup = String(r.player_id) + "|" + week;

      if (seen.has(dedup)) continue;
      seen.add(dedup);

      const key = week + "|" + opp + "|" + off;

      if (!games.has(key)) {
        games.set(key, {
          opponent: opp,
          week,
          rushing: 0,
          receiving: 0,
          players: 0
        });
      }

      const g = games.get(key);

      g.rushing += Math.max(0, num(r.rushing_yards));
      g.receiving += Math.max(0, num(r.receiving_yards));
      g.players++;
    }

    const all = [...games.values()];

    const league = {
      rushing: avg(all.map(x => x.rushing)),
      receiving: avg(all.map(x => x.receiving))
    };

    const grouped = {};

    for (const g of all) {
      (grouped[g.opponent] ??= []).push(g);
    }

    const ratings = {};

    for (const [t, rows] of Object.entries(grouped)) {
      ratings[t] = {};

      for (const market of ["rushing", "receiving"]) {
        const allowed = avg(rows.map(x => x[market]));
        const weight = rows.length / (rows.length + 12);

        const factor = league[market] > 0
          ? clamp(
              1 + 0.5 * weight *
                (allowed / league[market] - 1),
              0.93,
              1.07
            )
          : 1;

        ratings[t][market] = {
          games: rows.length,
          yards_allowed_per_game: allowed,
          league_average: league[market],
          factor
        };
      }
    }

    return ratings;
  }

  function adjustProjection(p, opponent, ratings) {
    const team = normalizeTeam(opponent);
    const d = ratings?.[team]?.[p.market];
    const factor = d?.factor ?? 1;

    return {
      ...p,
      opponent: team,
      matchup_factor: factor,
      matchup_available: !!d,
      defensive_games: d?.games ?? 0,
      adjusted_yards: p.projected_yards * factor
    };
  }

  function usageTrend(p) {
    const season = num(p.season_usage_average);
    const recent = num(p.recent_usage_average);

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
    version: "2.0"
  };
})();
