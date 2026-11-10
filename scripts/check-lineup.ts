// scripts/check-lineup.ts
// Bir maçın kayıtlı kadrosunu ve maçta gerçekten oynayanları yan yana gösterir (tanı amaçlı, değiştirmez).
// Çalıştırma: npx tsx --env-file=.env scripts/check-lineup.ts Trabzonspor 2026-10-19
import { prisma } from "../src/lib/prisma";

async function main() {
  const [team, day] = process.argv.slice(2);
  if (!team || !day) throw new Error("Kullanım: check-lineup.ts <takım adı> <YYYY-MM-DD>");
  const start = new Date(`${day}T00:00:00+03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const matches = await prisma.match.findMany({
    where: {
      eventDate: { gte: start, lt: end },
      OR: [
        { homeTeam: { name: { contains: team, mode: "insensitive" } } },
        { awayTeam: { name: { contains: team, mode: "insensitive" } } },
      ],
    },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!matches.length) console.log("Maç bulunamadı");

  for (const m of matches) {
    console.log(`\n${m.homeTeam.name} – ${m.awayTeam.name} · id ${m.id} · ${m.status} · detay: ${m.detailsSyncedAt?.toISOString() ?? "çekilmedi"}`);
    const [lineup, stats] = await Promise.all([
      prisma.matchLineup.findMany({ where: { matchId: m.id }, include: { player: true }, orderBy: [{ teamId: "asc" }, { isStarter: "desc" }] }),
      prisma.playerMatchStat.findMany({ where: { matchId: m.id }, select: { playerId: true, minutesPlayed: true } }),
    ]);
    const minutes = new Map(stats.map((s) => [s.playerId, s.minutesPlayed]));
    for (const t of [m.homeTeam, m.awayTeam]) {
      const rows = lineup.filter((l) => l.teamId === t.id);
      console.log(`  ${t.name}: ${rows.filter((r) => r.isStarter).length} ilk 11 kaydı · durum ${[...new Set(rows.map((r) => r.lineupStatus))].join(", ") || "-"}`);
      for (const r of rows.filter((r) => r.isStarter)) {
        const min = minutes.get(r.playerId);
        console.log(`    ${r.player.name.padEnd(28)} ${r.lineupStatus.padEnd(10)} güncellendi ${r.updatedAt.toISOString().slice(0, 16)} · oynadı ${min ?? "-"} dk`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
