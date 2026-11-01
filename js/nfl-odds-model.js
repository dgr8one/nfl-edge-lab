
(function () {
  "use strict";

  const norm = s => String(s || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const marketOf = base =>
    base === "player_rush_yds" ? "rushing" :
    base === "player_reception_yds" ? "receiving" : null;

  const pct = n => (100 * n).toFixed(1) + "%";
  const oddsText = n => n > 0 ? "+" + n : String(n);

  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>NFL Model vs Sportsbook Odds</h2>
    <p id="modelOddsStatus">Waiting for projections and odds...</p>
    <div id="modelOddsResults"></div>
    <p class="muted">
      Experimental model estimates. 50,000 simulations per market.
      Variance is not calibrated; injuries and projected playing
      time are not fully accounted for. Positive estimated ROI
      does not establish a profitable bet.
    </p>
  `;
  document.querySelector("main").appendChild(panel);

  function update() {
    const status = document.getElementById("modelOddsStatus");
    const results = document.getElementById("modelOddsResults");

    const projections = window.nflCombinedProjections;
    const offers = window.NFLEdgeOddsOffers;
    const engine = window.NFLEdgeSimulations;

    if (!Array.isArray(projections) || !Array.isArray(offers) || !engine) {
      status.textContent = "Waiting for projections and odds...";
      return;
    }

    if (!offers.length) {
      status.textContent =
        projections.length +
        " projections ready. No sportsbook odds loaded yet. " +
        "Import a saved odds snapshot or run a scan.";
      results.innerHTML = "";
      return;
    }

    const lookup = new Map();

    for (const p of projections) {
      if (!p.matchup_available || !Number.isFinite(p.adjusted_yards)) continue;
      const key = norm(p.player_name) + "|" + p.market;
      if (!lookup.has(key)) lookup.set(key, []);
      lookup.get(key).push(p);
    }

    const rows = [];
    let unmatched = 0;
    let ambiguous = 0;

    for (const offer of offers) {
      const market = marketOf(offer.base);
      if (!market) continue;

      const key = norm(offer.player) + "|" + market;
      const candidates = lookup.get(key) || [];

      // Never silently match an ambiguous player.
      if (candidates.length > 1) {
        ambiguous++;
        continue;
      }

      if (!candidates.length) {
        unmatched++;
        continue;
      }

      const projection = candidates[0];

      // Verify that the sportsbook offer belongs to
      // the same matchup as the player projection.
      const game = String(offer.game || "").toLowerCase();
      const opponent = String(projection.opponent || "").toLowerCase();

      const teamNames = {
        ari: "arizona cardinals",
        atl: "atlanta falcons",
        bal: "baltimore ravens",
        buf: "buffalo bills",
        car: "carolina panthers",
        chi: "chicago bears",
        cin: "cincinnati bengals",
        cle: "cleveland browns",
        dal: "dallas cowboys",
        den: "denver broncos",
        det: "detroit lions",
        gb: "green bay packers",
        hou: "houston texans",
        ind: "indianapolis colts",
        jac: "jacksonville jaguars",
        jax: "jacksonville jaguars",
        kc: "kansas city chiefs",
        la: "los angeles rams",
        lar: "los angeles rams",
        lac: "los angeles chargers",
        lv: "las vegas raiders",
        mia: "miami dolphins",
        min: "minnesota vikings",
        ne: "new england patriots",
        no: "new orleans saints",
        nyg: "new york giants",
        nyj: "new york jets",
        phi: "philadelphia eagles",
        pit: "pittsburgh steelers",
        sea: "seattle seahawks",
        sf: "san francisco 49ers",
        tb: "tampa bay buccaneers",
        ten: "tennessee titans",
        was: "washington commanders"
      };

      const expectedOpponent = teamNames[opponent];
      const expectedTeam = teamNames[
        String(projection.team || "").toLowerCase()
      ];

      const gameTeams = game.split(" @ ").map(s => s.trim());

      if (
        !expectedOpponent ||
        !expectedTeam ||
        gameTeams.length !== 2 ||
        !gameTeams.includes(expectedOpponent) ||
        !gameTeams.includes(expectedTeam)
      ) {
        unmatched++;
        continue;
      }

      const simulation = engine.simulateOver(
        projection, offer.line, 50000
      );

      if (!simulation ||
          !Number.isFinite(simulation.over_probability)) continue;

      const probability = simulation.over_probability;
      const estimatedROI = engine.expectedROI(probability, offer.price);

      if (!Number.isFinite(estimatedROI)) continue;

      rows.push({
        offer,
        projection,
        probability,
        estimatedROI
      });
    }

    rows.sort((a, b) => b.estimatedROI - a.estimatedROI);

    status.textContent =
      rows.length + " sportsbook offers modeled · " +
      unmatched + " unmatched · " +
      ambiguous + " ambiguous · " +
      "50,000 simulations per matched offer.";

    const table = document.createElement("table");
    table.style.minWidth = "900px";

    const headings = [
      "Player", "Market", "Projected Yards", "Over Line",
      "Sportsbook", "Odds", "Model Over %", "Model ROI"
    ];

    const header = document.createElement("tr");
    for (const heading of headings) {
      const th = document.createElement("th");
      th.textContent = heading;
      header.appendChild(th);
    }
    table.appendChild(header);

    for (const row of rows) {
      const tr = document.createElement("tr");
      const values = [
        row.offer.player,
        row.projection.market,
        row.projection.adjusted_yards.toFixed(1),
        row.offer.line,
        row.offer.bookTitle,
        oddsText(row.offer.price),
        pct(row.probability),
        (row.estimatedROI >= 0 ? "+" : "") + pct(row.estimatedROI)
      ];

      for (const value of values) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      }

      table.appendChild(tr);
    }

    results.replaceChildren();

    if (!rows.length) {
      results.textContent = "No sportsbook offers matched the projections.";
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "tablewrap";
    wrapper.appendChild(table);
    results.appendChild(wrapper);
  }

  window.addEventListener("nfl-odds-updated", update);
  window.addEventListener("nfl-projections-updated", update);
  update();
})();
