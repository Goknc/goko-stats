// scripts/check-duplicates.ts
// Aynı iki takımın aynı gün birden fazla kaydı olan maçları listeler (tanı amaçlı, hiçbir şeyi değiştirmez).
// Çalıştırma: npx tsx --env-file=.env scripts/check-duplicates.ts
import { prisma } from "../src/lib/prisma";

async function main() {
  const from = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: { eventDate: { gte: from } },
    select: {
      id: true, eventDate: true, status: true, replacedBy: true, leagueId: true, seasonId: true,
      homeScore: true, awayScore: true, detailsSyncedAt: true, createdAt: true,
      homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
      _count: { select: { lineups: true } },
    },
    orderBy: { eventDate: "asc" },
  });

  const groups = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = `${m.homeTeam.name}|${m.awayTeam.name}|${m.eventDate.toISOString().slice(0, 10)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const dups = [...groups.values()].filter((g) => g.length > 1);
  console.log(`Son 60 gün + gelecek: ${matches.length} maç, ${dups.length} çift kayıt grubu\n`);
  for (const g of dups) {
    console.log(`${g[0].homeTeam.name} – ${g[0].awayTeam.name}`);
    for (const m of g) {
      console.log(
        `  id ${m.id} · lig ${m.leagueId} · sezon ${m.seasonId} · ${m.eventDate.toISOString()} · ${m.status}` +
          ` · skor ${m.homeScore ?? "-"}-${m.awayScore ?? "-"} · replacedBy ${m.replacedBy ?? "-"}` +
          ` · kadro ${m._count.lineups} · eklendi ${m.createdAt.toISOString().slice(0, 16)}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
