"""
audit_pickem_score.py
─────────────────────
Queries PostgreSQL (via DATABASE_URL in .env / .env.local) and exports
pickem_score_audit.csv for every PredictionPick row where score = 0 but a
selection exists.

Requires: psycopg2-binary
  pip install psycopg2-binary
"""

import csv
import io
import os
import re
import sys
from collections import Counter
from pathlib import Path

# Force UTF-8 output on Windows terminals
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── 1. Locate & parse DATABASE_URL ────────────────────────────────────────────

def load_env(base: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for name in (".env.local", ".env"):
        p = base / name
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env

root = Path(__file__).resolve().parents[1]      # project root
env  = load_env(root)
db_url = os.environ.get("DATABASE_URL") or env.get("DATABASE_URL", "")

if not db_url:
    sys.exit("❌  DATABASE_URL not found. Set it in .env or export it first.")

# ── 2. Connect ────────────────────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("❌  Missing psycopg2. Run:  pip install psycopg2-binary")

try:
    conn = psycopg2.connect(db_url)
    cur  = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    print("✅  Connected to PostgreSQL")
except Exception as e:
    sys.exit(f"❌  Connection failed: {e}")

# ── 3. Query all prediction picks with joined context ─────────────────────────

QUERY = """
SELECT
    u.id                        AS user_id,
    u.username,
    u.nickname,
    m."matchNumber"             AS match_id,
    m."roundName"               AS round_name,

    -- seeded / resolved team names for this match
    COALESCE(rt1.name, t1.name) AS team_top_name,
    COALESCE(rt1.code, t1.code) AS team_top_code,
    COALESCE(rt2.name, t2.name) AS team_bottom_name,
    COALESCE(rt2.code, t2.code) AS team_bottom_code,

    pw.code                     AS selected_team_code,
    pw.name                     AS selected_team_name,

    aw.code                     AS actual_winner_code,
    aw.name                     AS actual_winner_name,

    pp."isCorrect"              AS is_correct,
    pp."pointsAwarded"          AS points_awarded

FROM   "PredictionPick"  pp
JOIN   "Prediction"      pred ON pp."predictionId"  = pred.id
JOIN   "User"            u    ON pred."userId"       = u.id
JOIN   "Match"           m    ON pp."matchNumber"    = m."matchNumber"

LEFT JOIN "Team" pw   ON pp."predictedWinnerTeamId" = pw.id
LEFT JOIN "Team" aw   ON m."actualWinnerTeamId"     = aw.id
LEFT JOIN "Team" t1   ON m."team1Id"                = t1.id
LEFT JOIN "Team" t2   ON m."team2Id"                = t2.id
LEFT JOIN "Team" rt1  ON m."resolvedTeam1Id"        = rt1.id
LEFT JOIN "Team" rt2  ON m."resolvedTeam2Id"        = rt2.id

ORDER BY u.username, m."matchNumber"
"""

try:
    cur.execute(QUERY)
    rows = cur.fetchall()
    print(f"   Fetched {len(rows):,} prediction-pick rows")
except Exception as e:
    conn.close()
    sys.exit(f"❌  Query failed: {e}")

conn.close()

# ── 4. Normalization ──────────────────────────────────────────────────────────

_BRACKET_RE = re.compile(r"\[.*?\]")   # strips [#1], [1-0], [any bracket text]
_MULTI_SPACE = re.compile(r" {2,}")

def normalize(s: str | None) -> str:
    if not s:
        return ""
    s = s.strip()
    s = _BRACKET_RE.sub("", s)         # remove [...] suffixes
    s = _MULTI_SPACE.sub(" ", s)       # collapse multiple spaces
    s = s.strip()
    s = s.lower()
    return s

# ── 5. Build audit records ────────────────────────────────────────────────────

audit_rows: list[dict] = []

missing_actual_winner   = 0
missing_selected_team   = 0
selection_not_in_match  = 0
winner_not_in_match     = 0
mismatch_pairs: Counter = Counter()

for r in rows:
    selected_code = r["selected_team_code"] or ""
    selected_name = r["selected_team_name"] or ""
    actual_code   = r["actual_winner_code"]  or ""
    actual_name   = r["actual_winner_name"]  or ""

    top_code    = r["team_top_code"]    or ""
    bottom_code = r["team_bottom_code"] or ""
    top_name    = r["team_top_name"]    or ""
    bottom_name = r["team_bottom_name"] or ""

    # Use the richer of code vs name for comparison
    # (codes are canonical; names may carry bracket junk)
    norm_sel = normalize(selected_code) or normalize(selected_name)
    norm_act = normalize(actual_code)   or normalize(actual_name)

    norm_top    = normalize(top_code)    or normalize(top_name)
    norm_bottom = normalize(bottom_code) or normalize(bottom_name)

    # ── Stats counters ──────────────────────────────────────────────────────
    if not actual_code and not actual_name:
        missing_actual_winner += 1

    if not selected_code and not selected_name:
        missing_selected_team += 1

    if selected_code or selected_name:
        if norm_sel not in (norm_top, norm_bottom):
            selection_not_in_match += 1

    if actual_code or actual_name:
        if norm_act not in (norm_top, norm_bottom):
            winner_not_in_match += 1

    # ── Expected score (normalization-aware) ───────────────────────────────
    if norm_sel and norm_act:
        expected_score = 1 if norm_sel == norm_act else 0
    else:
        expected_score = 0

    actual_score = r["points_awarded"] if r["points_awarded"] is not None else 0
    # Treat "scored at all" as 1, "0 points" as 0 for the binary match column
    scored_binary = 1 if actual_score > 0 else 0

    selected_matches_winner = norm_sel == norm_act if (norm_sel and norm_act) else False

    # ── Reason ─────────────────────────────────────────────────────────────
    if not (selected_code or selected_name):
        reason = "no_selection"
    elif not (actual_code or actual_name):
        reason = "no_actual_winner_set"
    elif selected_matches_winner and actual_score == 0:
        reason = "names_match_after_normalization_but_score_is_0"
    elif not selected_matches_winner and actual_score == 0:
        reason = "wrong_prediction"
    elif not selected_matches_winner and actual_score > 0:
        reason = "names_differ_but_points_awarded_check_manually"
    else:
        reason = "correct"

    # ── Mismatch pairs ─────────────────────────────────────────────────────
    if actual_score == 0 and (selected_code or selected_name) and (actual_code or actual_name):
        if not selected_matches_winner:
            pair = f"selected='{selected_code or selected_name}' | winner='{actual_code or actual_name}'"
            mismatch_pairs[pair] += 1

    # ── Match title ────────────────────────────────────────────────────────
    if top_code and bottom_code:
        match_title = f"{top_code} vs {bottom_code}"
    elif top_name and bottom_name:
        match_title = f"{top_name} vs {bottom_name}"
    else:
        match_title = f"Match {r['match_id']}"

    # ── Emit only rows where score=0 AND a selection exists ───────────────
    if actual_score == 0 and (selected_code or selected_name):
        audit_rows.append({
            "user_id":                   r["user_id"],
            "match_id":                  r["match_id"],
            "match_title":               match_title,
            "selected_team":             selected_code or selected_name,
            "actual_winner":             actual_code or actual_name or "(not set)",
            "normalized_selected_team":  norm_sel,
            "normalized_actual_winner":  norm_act or "(not set)",
            "selected_matches_winner":   selected_matches_winner,
            "score":                     actual_score,
            "reason":                    reason,
        })

# ── 6. Write audit CSV ────────────────────────────────────────────────────────

OUT_CSV = root / "pickem_score_audit.csv"
FIELDNAMES = [
    "user_id", "match_id", "match_title",
    "selected_team", "actual_winner",
    "normalized_selected_team", "normalized_actual_winner",
    "selected_matches_winner", "score", "reason",
]

with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
    writer.writeheader()
    writer.writerows(audit_rows)

# ── 7. Print summary ──────────────────────────────────────────────────────────

total = len(rows)
zero_with_sel = len(audit_rows)

print()
print("═" * 60)
print("  PICK'EM SCORE AUDIT SUMMARY")
print("═" * 60)
print(f"  Total prediction-pick rows           : {total:>8,}")
print(f"  Rows with score=0 AND selection      : {zero_with_sel:>8,}  ← exported")
print()
print(f"  Missing actual_winner                : {missing_actual_winner:>8,}")
print(f"  Missing selected_team                : {missing_selected_team:>8,}")
print(f"  selected_team ∉ {{team_top, team_bottom}}        : {selection_not_in_match:>8,}")
print(f"  actual_winner ∉ {{team_top, team_bottom}}        : {winner_not_in_match:>8,}")
print()
print("  Top-20 mismatched selected_team vs actual_winner pairs:")
if mismatch_pairs:
    for pair, cnt in mismatch_pairs.most_common(20):
        print(f"    {cnt:>5}×  {pair}")
else:
    print("    (none)")
print()
print(f"  ✅  Audit CSV written → {OUT_CSV}")
print("═" * 60)
