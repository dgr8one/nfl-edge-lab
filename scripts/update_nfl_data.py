
import csv
import io
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SEASON = 2026

SOURCE = (
    "https://github.com/nflverse/nflverse-data/"
    f"releases/download/stats_player/stats_player_week_{SEASON}.csv"
)

OUTPUT = Path("data/player_stats.json")

SCHEDULE_SOURCE = (
    "https://github.com/nflverse/nfldata/"
    "raw/refs/heads/master/data/games.csv"
)

SCHEDULE_OUTPUT = Path("data/nfl_schedule.json")

def update_schedule():
    print("Downloading NFL schedule...")

    request = urllib.request.Request(
        SCHEDULE_SOURCE,
        headers={"User-Agent": "NFL-Edge-Lab/1.0"}
    )

    with urllib.request.urlopen(request, timeout=90) as response:
        content = response.read().decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(content))
    required = {
        "season", "week", "home_team", "away_team"
    }

    if not reader.fieldnames or not required.issubset(reader.fieldnames):
        raise RuntimeError("NFL schedule missing required columns")

    games = [
        row for row in reader
        if row.get("season") == str(SEASON)
    ]

    if not games:
        raise RuntimeError("No 2026 NFL games found")

    SCHEDULE_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    SCHEDULE_OUTPUT.write_text(
        json.dumps({
            "season": SEASON,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source": SCHEDULE_SOURCE,
            "games": games
        }, separators=(",", ":")),
        encoding="utf-8"
    )

    print(f"Saved {len(games)} scheduled games.")

FIELDS = [
    "player_id",
    "player_name",
    "player_display_name",
    "position",
    "team",
    "recent_team",
    "opponent_team",
    "season",
    "week",
    "season_type",
    "carries",
    "rushing_yards",
    "targets",
    "receptions",
    "receiving_yards",
    "receiving_air_yards",
    "receiving_yards_after_catch",
]

def main():
    print(f"Downloading {SEASON} NFL player statistics...")

    request = urllib.request.Request(
        SOURCE,
        headers={"User-Agent": "NFL-Edge-Lab/1.0"}
    )

    with urllib.request.urlopen(request, timeout=90) as response:
        content = response.read().decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(content))

    if not reader.fieldnames:
        raise RuntimeError("Source has no CSV columns.")

    required = {
        "player_id", "week",
        "rushing_yards", "receiving_yards"
    }

    missing = required - set(reader.fieldnames)
    if missing:
        raise RuntimeError(f"Missing required columns: {missing}")

    rows = []
    for row in reader:
        if row.get("season_type") not in ("REG", ""):
            continue

        record = {
            field: row.get(field, "")
            for field in FIELDS
        }

        rows.append(record)

    if not rows:
        raise RuntimeError("No player statistics returned.")

    output = {
        "season": SEASON,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE,
        "games": len(rows),
        "players": rows,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(output, separators=(",", ":")),
        encoding="utf-8"
    )

    print(f"Saved {len(rows)} player-week records.")
    print(f"Output: {OUTPUT}")

if __name__ == "__main__":
    main()
    update_schedule()
