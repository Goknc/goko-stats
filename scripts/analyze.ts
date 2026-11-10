// scripts/analyze.ts
// Bir maçın analizini terminalde gösterir.
// Kullanım: npx tsx scripts/analyze.ts 213600
import { prisma } from "../src/lib/prisma";
import { analyzeMatch, type RateSummary } from "../src/lib/analysis";

const fmt = (s: RateSummary) =>
  s.total === 0 ? "veri yok" : `${s.hits}/${s.total}${s.lowSample ? " (az örnek)" : ""}`;

async function main() {
  const matchId = Number(process.argv[2]);
  const a = await analyzeMatch(matchId);
  if (!a) {
    console.log("Maç bulunamadı");
    return;
  }

  console.log(`\n${a.homeTeam.name} - ${a.awayTeam.name} · ${a.leagueName} · ${a.eventDate.toLocaleString("tr-TR")}\n`);

  console.log("TAKIM PİYASALARI");
  for (const t of a.teamTrends) {
    const star = t.recommended ? "  ⭐ ÖNERİ" : "";
    console.log(`  ${t.name.padEnd(12)} ev: ${fmt(t.home).padEnd(16)} dep: ${fmt(t.away).padEnd(16)} eşik %${Math.round(t.threshold * 100)}${star}`);
  }

  console.log("\nÖNERİLEN OYUNCU PİYASALARI");
  const picks = a.playerTrends.filter((p) => p.recommended);
  if (!picks.length) console.log("  (yok)");
  for (const p of picks) console.log(`  ⭐ ${p.playerName}: ${p.name} ${fmt(p.summary)}`);

  console.log("\nOYUNCU PİYASALARI (öneri olsun olmasın en yüksek 5)");
  console.log(`  Analiz edilen oyuncu sayısı: ${new Set(a.playerTrends.map((p) => p.playerId)).size}`);
  for (const code of ["P_GOAL", "P_ASSIST", "P_SOT1"] as const) {
    const rows = a.playerTrends
      .filter((p) => p.code === code && p.summary.total > 0)
      .sort((x, y) => (y.summary.rate ?? 0) - (x.summary.rate ?? 0))
      .slice(0, 5);
    const name = a.playerTrends.find((p) => p.code === code)?.name ?? code;
    const list = rows.length ? rows.map((r) => `${r.playerName} ${fmt(r.summary)}`).join(", ") : "veri yok";
    console.log(`  ${name}: ${list}`);
  }

  const first = a.teamTrends[0];
  console.log(`\nKANIT ÖRNEĞİ: ${first.name}, ${a.homeTeam.name} iç saha`);
  for (const e of first.home.evidence) {
    const mark = e.outcome === null ? "➖" : e.outcome ? "✅" : "❌";
    console.log(`  ${mark} ${e.eventDate.toLocaleDateString("tr-TR")}  ${e.label}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());