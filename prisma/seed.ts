import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Teams ───────────────────────────────────────────────
  const teams = [
    { code: "TM",   name: "Team Miracles",   seed: 1, logoUrl: "/logos/teams/tm.png"   },
    { code: "WBG",  name: "World BG",        seed: 2, logoUrl: "/logos/teams/wbg.png"  },
    { code: "ZETA", name: "ZETA Division",   seed: 3, logoUrl: "/logos/teams/zeta.png" },
    { code: "DAL",  name: "Dallas",          seed: 4, logoUrl: "/logos/teams/dal.png"  },
    { code: "CR",   name: "Crazy Raccoon",   seed: 5, logoUrl: "/logos/teams/cr.png"   },
    { code: "SSG",  name: "Steven's Snakes", seed: 6, logoUrl: "/logos/teams/ssg.png"  },
    { code: "VP",   name: "Virtus.pro",      seed: 7, logoUrl: "/logos/teams/vp.png"   },
    { code: "AG",   name: "Acend Gaming",    seed: 8, logoUrl: "/logos/teams/ag.png"   },
  ];

  const teamMap = new Map<string, string>(); // code → id

  for (const t of teams) {
    const team = await prisma.team.upsert({
      where: { code: t.code },
      update: { name: t.name, seed: t.seed, logoUrl: t.logoUrl },
      create: { code: t.code, name: t.name, seed: t.seed, logoUrl: t.logoUrl },
    });
    teamMap.set(t.code, team.id);
    console.log(`  Team: ${t.code} (${team.id})`);
  }

  // ─── Matches ──────────────────────────────────────────────
  // Bracket advancement mapping (see src/lib/bracket.ts for full commentary):
  //
  // WB Round 1 (M1-M4) → WB Semifinals (M7, M8) for winners
  //                     → LB Round 1   (M5, M6) for losers
  // LB Round 1 (M5-M6) → LB Round 2   (M9, M10) team2 slots
  // WB Semifinals (M7-M8) → WB Final  (M12) for winners
  //                       → LB Round 2 (M9,M10) team1 slots for losers
  // LB Round 2 (M9-M10) → LB Round 3  (M11)
  // LB Round 3 (M11)    → LB Final    (M13) team1
  // WB Final (M12)      → Grand Final (M14) team1 (winner)
  //                     → LB Final    (M13) team2 (loser)
  // LB Final (M13)      → Grand Final (M14) team2
  // Grand Final (M14)   → Champion

  const matchDefs = [
    // WB Round 1
    // WB Round 1 — slot 1=top, slot 2=bottom
    // M1/M2 (bottom half) → WB Semi M8 | losers → LB R1 M5
    // M3/M4 (top half)    → WB Semi M7 | losers → LB R1 M6
    {
      matchNumber: 1, roundName: "WB Round 1",   bracketType: "WB", orderIndex: 1,
      team1Code: "WBG", team2Code: "VP",
      winnerToMatch: 8, winnerSlot: 1,   // → M8 top
      loserToMatch:  5, loserSlot:  1,   // → M5 top
    },
    {
      matchNumber: 2, roundName: "WB Round 1",   bracketType: "WB", orderIndex: 2,
      team1Code: "ZETA", team2Code: "SSG",
      winnerToMatch: 8, winnerSlot: 2,   // → M8 bottom
      loserToMatch:  5, loserSlot:  2,   // → M5 bottom
    },
    {
      matchNumber: 3, roundName: "WB Round 1",   bracketType: "WB", orderIndex: 3,
      team1Code: "DAL", team2Code: "CR",
      winnerToMatch: 7, winnerSlot: 1,   // → M7 top
      loserToMatch:  6, loserSlot:  1,   // → M6 top
    },
    {
      matchNumber: 4, roundName: "WB Round 1",   bracketType: "WB", orderIndex: 4,
      team1Code: "TM", team2Code: "AG",
      winnerToMatch: 7, winnerSlot: 2,   // → M7 bottom
      loserToMatch:  6, loserSlot:  2,   // → M6 bottom
    },
    // LB Round 1 — winners enter LB R2 from the bottom slot
    {
      matchNumber: 5, roundName: "LB Round 1",   bracketType: "LB", orderIndex: 5,
      winnerToMatch: 9,  winnerSlot: 2,  // → M9 bottom
    },
    {
      matchNumber: 6, roundName: "LB Round 1",   bracketType: "LB", orderIndex: 6,
      winnerToMatch: 10, winnerSlot: 2,  // → M10 bottom
    },
    // WB Semifinals — losers drop to LB R2 top slot
    {
      matchNumber: 7, roundName: "WB Semifinals", bracketType: "WB", orderIndex: 7,
      winnerToMatch: 12, winnerSlot: 1,  // → M12 top
      loserToMatch:   9, loserSlot:  1,  // → M9  top
    },
    {
      matchNumber: 8, roundName: "WB Semifinals", bracketType: "WB", orderIndex: 8,
      winnerToMatch: 12, winnerSlot: 2,  // → M12 bottom
      loserToMatch:  10, loserSlot:  1,  // → M10 top
    },
    // LB Round 2
    {
      matchNumber: 9,  roundName: "LB Round 2",  bracketType: "LB", orderIndex: 9,
      winnerToMatch: 11, winnerSlot: 1,  // → M11 top
    },
    {
      matchNumber: 10, roundName: "LB Round 2",  bracketType: "LB", orderIndex: 10,
      winnerToMatch: 11, winnerSlot: 2,  // → M11 bottom
    },
    // LB Round 3
    {
      matchNumber: 11, roundName: "LB Round 3",  bracketType: "LB", orderIndex: 11,
      winnerToMatch: 13, winnerSlot: 1,  // → M13 top
    },
    // WB Final
    {
      matchNumber: 12, roundName: "WB Final",    bracketType: "WB", orderIndex: 12,
      winnerToMatch: 14, winnerSlot: 1,  // → M14 top
      loserToMatch:  13, loserSlot:  2,  // → M13 bottom
    },
    // LB Final
    {
      matchNumber: 13, roundName: "LB Final",    bracketType: "LB", orderIndex: 13,
      winnerToMatch: 14, winnerSlot: 2,  // → M14 bottom
    },
    // Grand Final — winner is champion
    {
      matchNumber: 14, roundName: "Grand Final", bracketType: "GF", orderIndex: 14,
    },
  ];

  for (const m of matchDefs) {
    const sharedData = {
      matchNumber: m.matchNumber,
      roundName:   m.roundName,
      bracketType: m.bracketType,
      orderIndex:  m.orderIndex,
      team1Id:     m.team1Code ? (teamMap.get(m.team1Code) ?? null) : null,
      team2Id:     m.team2Code ? (teamMap.get(m.team2Code) ?? null) : null,
      winnerToMatch: m.winnerToMatch ?? null,
      winnerSlot:    m.winnerSlot    ?? null,
      loserToMatch:  m.loserToMatch  ?? null,
      loserSlot:     m.loserSlot     ?? null,
    };

    await prisma.match.upsert({
      where: { matchNumber: m.matchNumber },
      update: sharedData,
      create: sharedData,
    });
    console.log(`  Match ${m.matchNumber}: ${m.roundName}`);
  }

  // ─── Admin account ────────────────────────────────────────
  const adminHash = await bcrypt.hash("dhqxlrtmwlwl", 12);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { nickname: "관리자", avatarUrl: "/avatars/avatar-1.png" },
    create: {
      username:     "admin",
      nickname:     "관리자",
      passwordHash: adminHash,
      role:         "ADMIN",
      avatarUrl:    "/avatars/avatar-1.png",
    },
  });
  console.log("  User: admin  (password: dhqxlrtmwlwl, nickname: 관리자)");

  // ─── Sample user account ──────────────────────────────────
  const userHash = await bcrypt.hash("dhqxlrtm", 12);
  await prisma.user.upsert({
    where: { username: "demo" },
    update: { nickname: "데모유저", avatarUrl: "/avatars/avatar-2.png" },
    create: {
      username:     "demo",
      nickname:     "데모유저",
      passwordHash: userHash,
      role:         "USER",
      avatarUrl:    "/avatars/avatar-2.png",
    },
  });
  console.log("  User: demo   (password: dhqxlrtm, nickname: 데모유저)");

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
