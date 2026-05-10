# Champions Clash — Tournament Prediction App

A full-stack double-elimination bracket prediction web app built with Next.js 14, TypeScript, Tailwind CSS, Prisma, and SQLite.

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

The `.env` file is already pre-configured for local development with sensible defaults:

```
NEXTAUTH_SECRET="champions-clash-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
DATABASE_URL="file:./dev.db"
```

For production, generate a real secret:
```bash
openssl rand -base64 32
```

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates prisma/dev.db)
npm run db:migrate

# Seed with teams, matches, and sample accounts
npm run db:seed
```

Or run all three steps at once:
```bash
npm run setup
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Sample Accounts

After seeding, two accounts are available:

| Role  | Email                        | Password   |
|-------|------------------------------|------------|
| Admin | admin@championsclash.gg      | admin1234  |
| User  | demo@championsclash.gg       | user1234   |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Landing page
│   ├── login/page.tsx          # Login form
│   ├── signup/page.tsx         # Registration form
│   ├── predict/page.tsx        # Interactive prediction bracket (auth required)
│   ├── leaderboard/page.tsx    # Public leaderboard
│   ├── prediction/[userId]/    # View any user's bracket
│   ├── admin/page.tsx          # Admin result input (admin only)
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth credentials handler
│       ├── signup/             # POST – create account
│       ├── predictions/        # GET/POST – user predictions
│       ├── matches/            # GET – all matches
│       ├── leaderboard/        # GET – ranked leaderboard
│       └── admin/
│           ├── results/        # POST – save actual results
│           └── recalculate/    # POST – force score recalculation
├── components/
│   ├── Bracket.tsx             # Main bracket layout (8 rounds)
│   ├── MatchCard.tsx           # Individual match card
│   ├── TeamRow.tsx             # Single team row inside a match card
│   ├── DeadlineBanner.tsx      # Countdown / closed banner
│   ├── LeaderboardTable.tsx    # Ranked table with tie-breaking
│   ├── AdminResultEditor.tsx   # Admin match result input UI
│   └── Navbar.tsx              # Top navigation
├── lib/
│   ├── bracket.ts              # Core bracket advancement logic (shared)
│   ├── scoring.ts              # Score calculation
│   ├── constants.ts            # Deadline, scoring weights, config
│   ├── auth.ts                 # NextAuth configuration
│   └── prisma.ts               # Prisma singleton
prisma/
├── schema.prisma               # Database schema
└── seed.ts                     # Seed script
```

---

## How Deadline Locking Works

The prediction deadline is defined in `src/lib/constants.ts`:

```ts
// May 22, 2026 00:00 KST = May 21, 2026 15:00:00 UTC
export const PREDICTION_DEADLINE = new Date("2026-05-21T15:00:00.000Z");
```

**Client-side:** The `DeadlineBanner` component polls every 5 seconds and disables the bracket UI when `now >= PREDICTION_DEADLINE`.

**Server-side:** The `POST /api/predictions` route explicitly checks the deadline before accepting any writes. Frontend bypass is impossible — the server rejects requests after the deadline regardless of how the client behaves.

### Changing the Deadline

Edit `src/lib/constants.ts` and update `PREDICTION_DEADLINE` to a new UTC time. The rest of the app adapts automatically.

---

## How Scoring Works

Scoring is calculated in `src/lib/scoring.ts` and triggered when:
- Admin saves results via `POST /api/admin/results`
- Admin clicks "Recalculate Scores" via `POST /api/admin/recalculate`

### Point values

| Match(es) | Round              | Points |
|-----------|--------------------|--------|
| M1–M4     | WB Round 1         | 1 pt each |
| M5–M10    | LB R1, WB Semis, LB R2 | 2 pts each |
| M11–M13   | LB R3, WB Final, LB Final | 3 pts each |
| M14       | Grand Final        | 5 pts |
| —         | Correct champion   | +5 pts bonus |

Maximum possible score: `4×1 + 6×2 + 3×3 + 1×5 + 5 = 4 + 12 + 9 + 5 + 5 = 35 pts`

### Tiebreaker rules (in order)

1. More correct Grand Final prediction
2. More correct champion prediction
3. Earlier prediction submission time

---

## Bracket Advancement Logic

The double-elimination bracket is fully defined in `src/lib/bracket.ts`. The same pure `propagateBracket()` function is used for:

1. **User prediction UI** — dynamically fills later match team slots as picks are made
2. **Admin result entry** — propagates actual results to resolve later matches
3. **Score calculation** — ensures team comparisons are consistent

```
WB Round 1 → WB Semifinals (winners) / LB Round 1 (losers)
LB Round 1 → LB Round 2 (as team2 slot)
WB Semifinals → WB Final (winners) / LB Round 2 (losers, as team1 slot)
LB Round 2 → LB Round 3
LB Round 3 → LB Final (slot 1)
WB Final → Grand Final (winner, slot 1) / LB Final (loser, slot 2)
LB Final → Grand Final (winner, slot 2)
Grand Final → Champion
```

---

## Prediction Visibility

Controlled by `PREDICTIONS_PUBLIC_AFTER_DEADLINE` in `src/lib/constants.ts`:

```ts
export const PREDICTIONS_PUBLIC_AFTER_DEADLINE = true;
```

- `true`: After the deadline, anyone can view any user's bracket via `/prediction/[userId]`
- `false`: Predictions remain private (only the owner can view)

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Connect to Vercel
3. Set environment variables:
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your production domain
   - `DATABASE_URL` — use a hosted database (e.g., PlanetScale, Turso, Neon)
4. Update `prisma/schema.prisma` to use the appropriate provider (e.g., `mysql` for PlanetScale)
5. Run `prisma migrate deploy` in the build step

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run db:generate && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:generate  # Regenerate Prisma client
npm run db:migrate   # Run pending migrations
npm run db:seed      # Seed database
npm run db:reset     # Reset DB and reseed
npm run db:studio    # Open Prisma Studio (visual DB browser)
```
