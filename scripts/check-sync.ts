// scripts/check-sync.ts
// Senkron teşhisi (hiçbir şeyi değiştirmez):
//  1) son görev çalışmaları (sync_runs): hangi adım ne zaman çalıştı, bitti mi, hata verdi mi
//  2) dünün ve bugünün maçları: durum ve detay çekilip çekilmediği
// Çalıştırma: npx tsx --env-file=.env scripts/check-sync.ts
import { prisma } from "../src/lib/prisma";

const TZ = "Europe/Istanbul";
const fmt = (d: Date | null) => (d ? d.toLocaleString("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-");

async function main() {
  // 1) Son çalışmalar
  const runs = await prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 40 });
  console.log("Son görev çalışmaları (en yeni üstte):");
  for (const r of runs) {
    const sec = r.finishedAt ? ((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000).toFixed(0) + " sn" : "bitmedi";
    console.log(`  ${fmt(r.startedAt)}  ${r.job.padEnd(9)} ${r.status.padEnd(8)} ${sec.padStart(7)}  ${r.error ? "HATA: " + r.error.slice(0, 120) : ""}`);
  }

  // 2) Dün ve bugün (Türkiye saatiyle) takip edilen liglerdeki maçlar
  const now = new Date();
  const todayTR = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const startOfToday = new Date(Date.UTC(todayTR.getFullYear(), todayTR.getMonth(), todayTR.getDate()) - 3 * 3600_000);
  for (const [label, from] of [
    ["Dün", new Date(startOfToday.getTime() - 24 * 3600_000)],
    ["Bugün", startOfToday],
  ] as const) {
    const to = new Date(from.getTime() + 24 * 3600_000);
    const matches = await prisma.match.findMany({
      where: { eventDate: { gte: from, lt: to }, league: { isTracked: true } },
      select: { id: true, status: true, detailsSyncedAt: true, eventDate: true, updatedAt: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
      orderBy: { eventDate: "asc" },
    });
    const byStatus = new Map<string, number>();
    for (const m of matches) byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
    const finished = matches.filter((m) => m.status === "finished");
    const withDetails = finished.filter((m) => m.detailsSyncedAt);
    console.log(`\n${label}: ${matches.length} maç · durumlar: ${[...byStatus].map(([s, n]) => `${s} ${n}`).join(", ")}`);
    console.log(`  bitmiş ${finished.length} · detayı çekilmiş ${withDetails.length}`);
    // Saati geçmiş ama hâlâ "bitmedi" görünen maçlar: sonuçları gelmemiş demek
    const stale = matches.filter((m) => m.status !== "finished" && m.eventDate.getTime() < now.getTime() - 3 * 3600_000);
    if (stale.length) {
      console.log(`  Saati geçtiği hâlde bitmemiş görünen ${stale.length} maç (son güncelleme zamanıyla):`);
      for (const m of stale.slice(0, 10)) console.log(`    ${fmt(m.eventDate)} ${m.homeTeam.name} – ${m.awayTeam.name} · ${m.status} · güncellendi ${fmt(m.updatedAt)}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
