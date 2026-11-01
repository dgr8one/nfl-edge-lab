
/*
 * NFL Edge Lab — Upcoming Opponent Connector
 * Uses schedule dates and existing projection/defense engines.
 * No odds API requests.
 */
(function () {
  "use strict";

  const aliases = {
    LA: "LAR",
    JAX: "JAC",
    WSH: "WAS",
    OAK: "LV",
    SD: "LAC",
    STL: "LAR"
  };

  function teamCode(value) {
    const code = String(value || "").trim().toUpperCase();
    return aliases[code] || code;
  }

  function kickoffTime(game) {
    const date = String(game.gameday || "");
    const time = String(game.gametime || "13:00");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NaN;
    }

    // NFL schedule times are Eastern. Determine the
    // applicable UTC offset, including daylight saving.
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);

    if (!Number.isInteger(hour) ||
        !Number.isInteger(minute) ||
        hour > 23 || minute > 59) {
      return NaN;
    }

    const candidate = Date.UTC(year, month - 1, day, hour, minute);

    const easternHour = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hourCycle: "h23"
    });

    for (const offset of [4, 5]) {
      const instant = candidate + offset * 3600000;
      const formatted = easternHour.format(new Date(instant));

      if (Number(formatted) === hour) {
        return instant;
      }
    }

    return candidate + 5 * 3600000;
  }

  function upcomingGames(schedule, now = Date.now()) {
    const games = Array.isArray(schedule)
      ? schedule
      : schedule.games;

    if (!Array.isArray(games)) {
      throw new Error("Schedule games array missing");
    }

    return games
      .filter(g => g.game_type === "REG")
      .map(g => ({
        ...g,
        kickoff: kickoffTime(g)
      }))
      .filter(g =>
        Number.isFinite(g.kickoff) &&
        g.kickoff > now
      )
      .sort((a, b) => a.kickoff - b.kickoff);
  }

  function nextGameForTeam(team, games) {
    const code = teamCode(team);

    return games.find(game =>
      teamCode(game.home_team) === code ||
      teamCode(game.away_team) === code
    ) || null;
  }

  function matchupProjections(projections, schedule, ratings) {
    const games = upcomingGames(schedule);
    const output = [];

    for (const projection of projections) {
      const game = nextGameForTeam(projection.team, games);
      if (!game) continue;

      const home = teamCode(game.home_team);
      const away = teamCode(game.away_team);
      const playerTeam = teamCode(projection.team);
      const opponent = playerTeam === home ? away : home;

      const adjusted = window.NFLEdgeMatchups
        .adjustProjection(projection, opponent, ratings);

      const usage = window.NFLEdgeMatchups
        .usageTrend(projection);

      output.push({
        ...adjusted,
        ...usage,
        game_id: game.game_id,
        kickoff: game.kickoff,
        home_team: home,
        away_team: away
      });
    }

    return output;
  }

  window.NFLEdgeUpcoming = {
    upcomingGames,
    nextGameForTeam,
    matchupProjections,
    version: "1.0"
  };
})();
