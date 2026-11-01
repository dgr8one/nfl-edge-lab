
(function () {
  "use strict";

  const n = v => v === null || v === undefined || v === ""
    ? NaN : Number(v);

  const avg = a => a.length
    ? a.reduce((s, v) => s + v, 0) / a.length : 0;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const team = x => ({
    JAX: "JAC", LA: "LAR", WSH: "WAS"
  }[String(x || "").toUpperCase()] ||
    String(x || "").toUpperCase());

  const valid = r =>
    Number(r.season) === 2026 &&
    String(r.season_type || "").toUpperCase() === "REG" &&
    Number.isInteger(Number(r.week)) &&
    Number(r.week) > 0;

  function weighted(a) {
    return 0.40 * avg(a) +
      0.25 * avg(a.slice(-5)) +
      0.35 * avg(a.slice(-3));
  }

  function buildUsage(records) {
    const groups = new Map();

    for (const r of records || []) {
      if (!valid(r) || !r.player_id) continue;

      const id = String(r.player_id);
      if (!groups.has(id)) groups.set(id, new Map());

      const weeks = groups.get(id);
      const week = Number(r.week);

      if (!weeks.has(week)) weeks.set(week, r);
    }

    const out = [];

    for (const [id, weeks] of groups) {
      const games = [...weeks.values()].sort(
        (a, b) => Number(a.week) - Number(b.week)
      );

      if (games.length < 3) continue;

      const last = games[games.length - 1];

      const arr = f => games.map(g => {
        const x = n(g[f]);
        return Number.isFinite(x) ? Math.max(0, x) : 0;
      });

      const carries = arr("carries");
      const targets = arr("targets");
      const rush = arr("rushing_yards");
      const rec = arr("receiving_yards");
      const catches = arr("receptions");

      const sum = a => a.reduce((s, v) => s + v, 0);

      const pc = weighted(carries);
      const pt = weighted(targets);

      const totalC = sum(carries);
      const totalT = sum(targets);
      const totalR = sum(catches);

      const ypc = totalC ? sum(rush) / totalC : 0;
      const ypt = totalT ? sum(rec) / totalT : 0;

      const catchRate = totalT
        ? clamp(totalR / totalT, 0, 1) : 0;

      const ypr = totalR ? sum(rec) / totalR : 0;

      const rushPrior = totalC
        ? avg(rush) / Math.max(avg(carries), 1) : 0;

      const recPrior = totalT
        ? avg(rec) / Math.max(avg(targets), 1) : 0;

      const rushEff = clamp(
        (totalC * ypc + 20 * rushPrior) / (totalC + 20),
        0, 12
      );

      const recEff = clamp(
        (totalT * ypt + 25 * recPrior) / (totalT + 25),
        0, 20
      );

      out.push({
        player_id: id,
        player_name:
          last.player_display_name || last.player_name,
        team: team(last.recent_team || last.team),
        position: last.position,
        games_played: games.length,

        projected_carries: pc,
        projected_targets: pt,

        yards_per_carry: rushEff,
        catch_rate: catchRate,
        yards_per_reception: ypr,
        yards_per_target: recEff,

        projected_rushing_yards: pc * rushEff,
        projected_receiving_yards: pt * recEff,

        season_usage_average: avg(carries),
        recent_usage_average: avg(carries.slice(-3)),

        projection_method:
          "opportunity_x_shrunk_efficiency_v2"
      });
    }

    return out;
  }

  window.NFLEdgeUsage = {
    buildUsage,
    version: "2.0"
  };
})();
