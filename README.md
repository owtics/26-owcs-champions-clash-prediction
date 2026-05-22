# OWTICS.GG Pick'Ems — Champions Clash

Full-stack Overwatch esports tournament prediction app built with Next.js 14, PostgreSQL (Prisma), and NextAuth.

---

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **PostgreSQL** + **Prisma ORM**
- **NextAuth v4** (username/password sessions)
- **Tailwind CSS** (dark esports theme)

---

## Pages

| Route | Description |
|---|---|
| `/` | Home — tournament info, teams, top predictors, gallery |
| `/predict` | Bracket prediction (double-elimination, 14 matches) |
| `/leaderboard` | Full leaderboard with search & pagination |
| `/pickems` | **Pick'em Predictions** — CSV-driven pick rate analytics |
| `/prediction/[userId]` | View another user's bracket |
| `/settings` | Profile, avatar, privacy settings |
| `/admin` | Set results, deadline, recalculate scores |

---

## Pick'em Predictions Page (`/pickems`)

A separate analytics dashboard visualising fan selection-rate data from a CSV file.
**This page does not use hero pick/ban data** — it shows fan prediction selection rates before matches are played.

> **Important:** These are Pick'em selection rates before the matches are played. They do not represent actual winners or official win probabilities.

### Data source

Place your CSV at:

```
public/data/predictionpick.csv
```

### Expected CSV columns

| Column | Description |
|---|---|
| `tournament_sheet` | Tournament name/identifier |
| `match_id` | Unique match identifier (e.g. M1) |
| `match_title` | Display title (e.g. "TM vs WBG") |
| `team_top` | Top team in the bracket slot |
| `team_bottom` | Bottom team in the bracket slot |
| `selected_team` | Team with the given pick rate (the most-selected team) |
| `pick_count` | Number of users who picked `selected_team` |
| `total_picks` | Total picks cast for this match |
| `pick_rate` | `pick_count / total_picks` (0–1 or 0–100, auto-normalised) |
| `actual_winner` | Team that actually won (leave blank if not yet played) |
| `advanced_team` | Team that advanced to the next stage |
| `next_match_id` | ID of the next match this team appeared in |
| `next_match_pick_count` | Pick count for `advanced_team` in the next match |
| `next_match_total_picks` | Total picks in the next match |
| `next_match_pick_rate` | Pick rate for `advanced_team` in the next match |

### Computed values

| Value | Formula |
|---|---|
| `selection_rate` | = `pick_rate` (normalised to 0–1) |
| `later_pick_rate` | = `next_match_pick_rate` (normalised to 0–1) |
| `pick_rate_change` | = `later_pick_rate − selection_rate` |

### Current state

The page shows **pre-match selection rates only** — the percentage of fans who picked each team before matches are played. No actual results are shown.

Result-dependent UI is hidden until match data is available:

| Feature | Shown now | Shown after results added |
|---|---|---|
| Selection rate bars | ✓ | ✓ |
| Bracket layout by round | ✓ | ✓ |
| Summary: Total Matches, Avg Selection Rate, Most One-Sided, Closest Match | ✓ | ✓ |
| Bracket card: "Pre-match" label | ✓ | — |
| Table columns: Round, Match, Top, Bottom, Most Selected Team, Selection Rate | ✓ | ✓ |
| Winner highlight (green ✓) / loser dimming | — | ✓ |
| Correct / Wrong badge on cards | — | ✓ |
| Green / red card borders | — | ✓ |
| Result filter | — | ✓ |
| Later pick rate footer on bracket cards | — | ✓ (when `next_match_pick_rate` present) |
| Pick-rate change charts (Increase / Drop) | — | ✓ |

To unlock result features: populate `actual_winner` (and optionally `next_match_pick_rate`) in `predictionpick.csv` and redeploy.

### Features

- **Summary cards** (4): Total Matches · Avg Selection Rate · Most One-Sided · Closest Match
- **Filters**: Tournament · Round/Stage · Team · Format (if in CSV) · Close Matches only (±10%) · Result (shown only when `actual_winner` data exists)
- **Bracket view** *(default)*: horizontal columns grouped by inferred round — each card shows both teams' selection rates as bars with a "Pre-match" label until results arrive
- **Table view**: 6-column table — Round, Match, Top, Bottom, Most Selected Team, Selection Rate
- **Cards view**: expanded pick-rate bars per match; actual winner and later-rate sections appear when data is present
- **Charts view**: Top 10 most one-sided and closest predictions always shown; pick-rate change charts appear when later-rate data is present

### Bracket view — round inference

Rounds are inferred automatically in this priority order:

1. **Explicit CSV column** — if `round`, `stage`, `bracket_round`, `bracket_type`, or `phase` is present, it is used directly
2. **Title keyword matching** — scans `match_title` for keywords: *grand final*, *semifinals*, *quarterfinals*, *upper bracket*, *lower bracket*, *round N*, etc.
3. **Graph-depth inference** — builds an advancement graph from `next_match_id` links, computes topological depth from tournament roots, and labels columns *Round 1 → Quarterfinals → Semifinals → Finals → Grand Final*
4. **Fallback** — "Unknown Round"

### Important: prediction pick rate vs hero pick rate

> Pick'em selection rates are **fan prediction rates before matches are played** — how often fans picked each team. They do not represent actual winners or official win probabilities. They are completely separate from hero pick/ban rates and must never be mixed with hero usage data.

---

## Setup

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Environment variables required in `.env`:

```
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
```

---

## Scoring

| Round | Points |
|---|---|
| M1–4 (WB/LB Round 1) | 5 pts |
| M5–6 (LB Round 1) | 5 pts |
| M7–8 (WB Semis) | 6 pts |
| M9–11 (LB Round 2–3) | 8 pts |
| M12–13 (WB/LB Finals) | 10 pts |
| M14 (Grand Final) | 20 pts |
| **Max total** | **106 pts** |

Tiebreaker order: Total score → Grand Final pick → Champion pick → Earlier submission.
