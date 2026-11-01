
(function () {
  "use strict";

  function buildCombinedProjections(records, schedule) {
    const usage = window.NFLEdgeUsage.buildUsage(records);

    const ratings =
      window.NFLEdgeMatchups.buildDefenseRatings(records);

    const games =
      window.NFLEdgeUpcoming.upcomingGames(schedule);

    const output = [];

    for (const player of usage) {
      const game =
        window.NFLEdgeUpcoming.nextGameForTeam(
          player.team, games
        );

      if (!game) continue;

      const team = String(player.team || "").toUpperCase();

      const home = String(game.home_team || "").toUpperCase();
      const away = String(game.away_team || "").toUpperCase();

      // Account for common NFL team-code differences.
      const aliases = {
        LA: "LAR",
        JAX: "JAC",
        WSH: "WAS"
      };

      const normalize = code => aliases[code] || code;

      const opponent =
        normalize(team) === normalize(home)
          ? away
          : home;

      for (const market of ["rushing", "receiving"]) {
        const projectedYards =
          market === "rushing"
            ? player.projected_rushing_yards
            : player.projected_receiving_yards;

        const projectedUsage =
          market === "rushing"
            ? player.projected_carries
            : player.projected_targets;

        // Exclude markets with insufficient projected volume.
        if (market === "rushing" && projectedUsage < 5) continue;
        if (market === "receiving" && projectedUsage < 3) continue;

        // Avoid negative yardage projections from tiny samples.
        if (!Number.isFinite(projectedYards) ||
            projectedYards <= 0) continue;

        const projection = {
          ...player,
          market,
          projected_yards: projectedYards,
          projected_usage: projectedUsage
        };

        const adjusted =
          window.NFLEdgeMatchups.adjustProjection(
            projection, opponent, ratings
          );

        output.push({
          ...adjusted,
          kickoff: game.kickoff,
          game_id: game.game_id
        });
      }
    }

    return output;
  }

  window.NFLEdgeCombined = {
    buildCombinedProjections,
    version: "1.0"
  };
})();
