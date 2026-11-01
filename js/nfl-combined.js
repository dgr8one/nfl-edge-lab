
(function () {
  "use strict";

  const normalize = x => ({
    LA: "LAR",
    JAX: "JAC",
    WSH: "WAS"
  }[String(x || "").toUpperCase()] ||
    String(x || "").toUpperCase());

  function buildCombinedProjections(records, schedule) {
    const clean = [];
    const seen = new Set();

    for (const r of records || []) {
      if (
        Number(r.season) !== 2026 ||
        String(r.season_type || "").toUpperCase() !== "REG" ||
        !r.player_id
      ) continue;

      const week = Number(r.week);

      if (!Number.isInteger(week) || week < 1) continue;

      const key = String(r.player_id) + "|" + week;

      if (seen.has(key)) continue;
      seen.add(key);
      clean.push(r);
    }

    const usage = window.NFLEdgeUsage.buildUsage(clean);

    const ratings =
      window.NFLEdgeMatchups.buildDefenseRatings(clean);

    const upcoming =
      window.NFLEdgeUpcoming.upcomingGames(schedule);

    const history = new Map();

    for (const r of clean) {
      const id = String(r.player_id);

      if (!history.has(id)) history.set(id, []);
      history.get(id).push(r);
    }

    for (const rows of history.values()) {
      rows.sort(
        (a, b) => Number(a.week) - Number(b.week)
      );
    }

    const output = [];

    for (const p of usage) {
      const game =
        window.NFLEdgeUpcoming.nextGameForTeam(
          p.team, upcoming
        );

      if (!game) continue;

      const team = normalize(p.team);
      const home = normalize(game.home_team);
      const away = normalize(game.away_team);

      if (team !== home && team !== away) continue;

      const opponent = team === home ? away : home;

      const match = String(game.game_id || "")
        .match(/^2026_(\d{1,2})(?:_|$)/);

      const currentWeek = match
        ? Number(match[1])
        : null;

      const rows = (
        history.get(String(p.player_id)) || []
      ).filter(r =>
        currentWeek === null ||
        Number(r.week) < currentWeek
      );

      for (const market of ["rushing", "receiving"]) {
        const projected = market === "rushing"
          ? p.projected_rushing_yards
          : p.projected_receiving_yards;

        const opportunities = market === "rushing"
          ? p.projected_carries
          : p.projected_targets;

        if (
          opportunities < (market === "rushing" ? 5 : 3) ||
          !Number.isFinite(projected) ||
          projected <= 0
        ) continue;

        const field = market === "rushing"
          ? "rushing_yards"
          : "receiving_yards";

        const weekly = rows
          .map(r => Number(r[field]))
          .filter(v => Number.isFinite(v) && v >= 0);

        if (weekly.length < 3) continue;

        const projection = {
          ...p,
          market,
          projected_yards: projected,
          projected_usage: opportunities,
          weekly_yards: weekly
        };

        const adjusted =
          window.NFLEdgeMatchups.adjustProjection(
            projection, opponent, ratings
          );

        output.push({
          ...adjusted,
          kickoff: game.kickoff,
          game_id: game.game_id,
          history_games: weekly.length
        });
      }
    }

    return output;
  }

  window.NFLEdgeCombined = {
    buildCombinedProjections,
    version: "2.0"
  };
})();
