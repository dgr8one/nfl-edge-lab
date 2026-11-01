
(function () {
  "use strict";

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function weightedAverage(values) {
    if (!values.length) return 0;

    const season = average(values);
    const last5 = average(values.slice(-5));
    const last3 = average(values.slice(-3));

    return 0.40 * season + 0.25 * last5 + 0.35 * last3;
  }

  function buildUsage(records) {
    const players = new Map();

    for (const row of records) {
      if (!row.player_id || !row.week) continue;

      const key = row.player_id;

      if (!players.has(key)) {
        players.set(key, []);
      }

      players.get(key).push(row);
    }

    const output = [];

    for (const [playerId, games] of players) {
      games.sort((a, b) => Number(a.week) - Number(b.week));

      if (games.length < 3) continue;

      const latest = games[games.length - 1];

      const carries = games.map(g => Number(g.carries) || 0);
      const targets = games.map(g => Number(g.targets) || 0);
      const rushYards = games.map(g => Number(g.rushing_yards) || 0);
      const receivingYards = games.map(g => Number(g.receiving_yards) || 0);
      const receptions = games.map(g => Number(g.receptions) || 0);

      const projectedCarries = weightedAverage(carries);
      const projectedTargets = weightedAverage(targets);

      const totalCarries = carries.reduce((a, b) => a + b, 0);
      const totalTargets = targets.reduce((a, b) => a + b, 0);

      const yardsPerCarry = totalCarries
        ? rushYards.reduce((a, b) => a + b, 0) / totalCarries
        : 0;

      const catchRate = totalTargets
        ? receptions.reduce((a, b) => a + b, 0) / totalTargets
        : 0;

      const totalReceptions = receptions.reduce((a, b) => a + b, 0);

      const yardsPerReception = totalReceptions
        ? receivingYards.reduce((a, b) => a + b, 0) / totalReceptions
        : 0;

      output.push({
        player_id: playerId,
        player_name: latest.player_display_name || latest.player_name,
        team: latest.recent_team || latest.team,
        position: latest.position,
        games_played: games.length,

        projected_carries: projectedCarries,
        projected_targets: projectedTargets,

        yards_per_carry: yardsPerCarry,
        catch_rate: catchRate,
        yards_per_reception: yardsPerReception,

        projected_rushing_yards:
          projectedCarries * yardsPerCarry,

        projected_receiving_yards:
          projectedTargets * catchRate * yardsPerReception
      });
    }

    return output;
  }

  window.NFLEdgeUsage = {
    buildUsage,
    version: "1.0"
  };
})();
