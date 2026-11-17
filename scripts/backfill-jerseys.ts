// scripts/backfill-jerseys.ts
// Bitmiş maçların kesin kadrolarına forma numarası doldurur (numara alanı eklenmeden önce çekilmiş kadrolar için).
// Kadro yeniden çekilir ama yalnızca numaralar güncellenir. Maç başına 1 istek; en yeni maçtan başlar.
// Milli takımlarda forma numarası yalnızca kesin kadrolardan okunduğu için önce milli maçlar doldurulmalı.
// Kullanım:
//   npx tsx scripts/backfill-jerseys.ts --days 120 --national --dry   (yalnızca sayı)
//   npx tsx scripts/backfill-jerseys.ts --days 30 --limit 500
import { prisma } from "../src/lib/prisma";
import { bsd } from "../src/lib/bsd/client";
import { NATIONAL_TEAM_LEAGUES } from "../src/lib/engine/leagues";
import { runJob } from "./lib/run-job";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const days = Number(arg("days") ?? 30);
const limit = Number(arg("limit") ?? 500);
const nationalOnly = flag("national");
const dry = flag("dry");

runJob("backfill-jerseys", async () => {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: {
      status: "finished",
      eventDate: { gte: from },
      league: { isTracked: true, playerStatsEnabled: true },
      ...(nationalOnly ? { leagueId: { in: [...NATIONAL_TEAM_LEAGUES] } } : {}),
      lineups: { some: { jerseyNumber: null } },
    },
    orderBy: { eventDate: "desc" },
    select: { id: true },
  });
  console.log(`${matches.length} maçın kadrosunda forma numarası eksik, ${Math.min(limit, matches.length)} işlenecek`);
  if (dry) return;

  let updated = 0;
  for (const [i, m] of matches.slice(0, limit).entries()) {
    const lu = await bsd.eventLineups(m.id);
    if (!lu.lineups) continue;
    const numbers = (["home", "away"] as const).flatMap((side) =>
      [...lu.lineups![side].players, ...lu.lineups![side].substitutes].filter((p) => p.id != null && p.jersey_number != null),
    );
    await prisma.$transaction(
      numbers.map((p) =>
        prisma.matchLineup.updateMany({ where: { matchId: m.id, playerId: p.id! }, data: { jerseyNumber: p.jersey_number } }),
      ),
    );
    updated += numbers.length;
    if ((i + 1) % 100 === 0) console.log(`${i + 1} maç`);
  }
  console.log(`${updated} oyuncunun forma numarası yazıldı`);
});
