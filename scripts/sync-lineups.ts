// scripts/sync-lineups.ts
// Yaklaşan maçların kadrolarını çeker (tahmini veya kesin). Analiz maçın kendi kadrosunu önceliklendirir.
// Kesin kadro da maç başlayana kadar her çalıştırmada yeniden çekilir: BSD "confirmed" dediği kadroyu
// sonradan düzeltebiliyor (Trabzonspor – Beşiktaş, 19 Ekim: 3 oyuncu kesin kadroda olduğu hâlde oynamadı).
// Kullanım:
//   npx tsx scripts/sync-lineups.ts --hours 48   (günlük: tahmini kadrolar)
//   npx tsx scripts/sync-lineups.ts --hours 2    (30 dakikada bir: kesinleşen kadrolar)
import { prisma } from "../src/lib/prisma";
import { bsd } from "../src/lib/bsd/client";
import { runJob } from "./lib/run-job";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const hours = Number(arg("hours") ?? 2);

runJob("lineups", async () => {
  const now = new Date();
  const until = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: {
      status: "notstarted",
      eventDate: { gte: now, lt: until },
      league: { isTracked: true, playerStatsEnabled: true },
    },
    select: { id: true },
    orderBy: { eventDate: "asc" },
  });
  console.log(`${matches.length} maçın kadrosu kontrol edilecek (önümüzdeki ${hours} saat)`);

  const counts = { confirmed: 0, predicted: 0, none: 0, changed: 0 };
  for (const m of matches) {
    const lu = await bsd.eventLineups(m.id);
    if (!lu.lineups || lu.lineup_status === "unavailable") {
      counts.none++;
      continue;
    }

    // B8: id'siz oyuncular atlanır
    const entries = (["home", "away"] as const)
      .flatMap((side) => {
        const t = lu.lineups![side];
        return [
          ...t.players.map((p) => ({ player: p, teamId: t.team_id, isStarter: true })),
          ...t.substitutes.map((p) => ({ player: p, teamId: t.team_id, isStarter: false })),
        ];
      })
      .filter((e) => e.player.id != null);
    const status = lu.lineup_status === "confirmed" ? "CONFIRMED" : "PREDICTED";

    // Kesin kadro sonradan değişti mi (log için)
    const before = await prisma.matchLineup.findMany({
      where: { matchId: m.id, isStarter: true, lineupStatus: "CONFIRMED" },
      select: { playerId: true },
    });
    if (before.length) {
      const now11 = new Set(entries.filter((e) => e.isStarter).map((e) => e.player.id));
      if (before.some((b) => !now11.has(b.playerId))) {
        counts.changed++;
        console.log(`Maç ${m.id}: kesin kadro değişti`);
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const e of entries) {
        await tx.player.upsert({
          where: { id: e.player.id! },
          update: { name: e.player.name, position: e.player.position },
          create: { id: e.player.id!, name: e.player.name, position: e.player.position },
        });
      }
      await tx.matchLineup.deleteMany({ where: { matchId: m.id } });
      await tx.matchLineup.createMany({
        skipDuplicates: true,
        data: entries.map((e) => ({
          matchId: m.id,
          teamId: e.teamId,
          playerId: e.player.id!,
          isStarter: e.isStarter,
          lineupStatus: status,
        })),
      });
    });
    counts[status === "CONFIRMED" ? "confirmed" : "predicted"]++;
  }

  console.log(
    `Kesin: ${counts.confirmed} · tahmini: ${counts.predicted} · kadro yok: ${counts.none}` +
      (counts.changed ? ` · kesin kadrosu değişen: ${counts.changed}` : ""),
  );
});
