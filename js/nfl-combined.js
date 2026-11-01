
(function () {
  "use strict";

  function buildCombinedProjections(records, schedule) {
    const usage = window.NFLEdgeUsage.buildUsage(records);

    const ratings =
      window.NFLEdgeMatchups.buildDefenseRatings(records);

    const games =
      window.NFLEdgeUpcoming.upcomingGames(schedule);

    // Index weekly player statistics by player ID.
    const historyByPlayer = new Map();

    for (const record of records) {
      if (String(record.season_type).toUpperCase() !== "REG") {
        continue;
      }

      if (Number(record.season) !== 2026) continue;

      const id = String(record.player_id || "");
      if (!id) continue;

      if (!historyByPlayer.has(id)) {
        historyByPlayer.set(id, []);
      }

      historyByPlayer.get(id).push(record);
    }

    // Ensure historical games are in chronological order.
    for (const history of historyByPlayer.values()) {
      history.sort((a, b) =>
        Number(a.week) - Number(b.week)
      );
    }

    const output = [];

    const aliases = {
      LA: "LAR",
      JAX: "JAC",
      WSH: "WAS"
    };

    const normalize = code =>
      aliases[String(code || "").toUpperCase()] ||
      String(code || "").toUpperCase();

    for (const player of usage) {
      const game =
        window.NFLEdgeUpcoming.nextGameForTeam(
          player.team, games
        );

      if (!game) continue;

      const team = normalize(player.team);
      const home = normalize(game.home_team);
      const away = normalize(game.away_team);

      // Do not assign a matchup to the wrong team.
      if (team !== home && team !== away) continue;

      const opponent = team === home
        ? game.away_team
        : game.home_team;

      const history =
        historyByPlayer.get(String(player.player_id)) || [];

      // Only games preceding the projected matchup.
      const currentWeek = Number(
        String(game.game_id || "").split("_")[1]
      );

      const priorHistory = history.filter(record =>
        !Number.isFinite(currentWeek) ||
        Number(record.week) < currentWeek
      );

      for (const market of ["rushing", "receiving"]) {
        const projectedYards =
          market === "rushing"
            ? player.projected_rushing_yards
            : player.projected_receiving_yards;

        const projectedUsage =
          market === "rushing"
            ? player.projected_carries
            : player.projected_targets;

        if (market === "rushing" && projectedUsage < 5) {
          continue;
        }

        if (market === "receiving" && projectedUsage < 3) {
          continue;
        }

        if (!Number.isFinite(projectedYards) ||
            projectedYards <= 0) {
          continue;
        }

        const field = market === "rushing"
          ? "rushing_yards"
          : "receiving_yards";

        // Include zero-yard games, not just productive games.
        const weeklyYards = priorHistory
          .map(record => Number(record[field]))
          .filter(value => Number.isFinite(value));

        const projection = {
          ...player,
          market,
          projected_yards: projectedYards,
          projected_usage: projectedUsage,
          weekly_yards: weeklyYards
        };

        const adjusted =
          window.NFLEdgeMatchups.adjustProjection(
            projection, opponent, ratings
          );

        output.push({
          ...adjusted,
          weekly_yards: weeklyYards,
          kickoff: game.kickoff,
          game_id: game.game_id
        });
      }
    }

    return output;
  }

  window.NFLEdgeCombined = {
    buildCombinedProjections,
    version: "1.1"
  };
})();
