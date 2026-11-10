// scripts/sync-player-extras.ts
// Detaylı oyuncu istatistiklerini (pas, ikili mücadele, hava topu, ofsayt, xG...) eski maçlar için doldurur.
// Yalnızca player-stats endpoint'i çağrılır (maç başına 1 istek); mevcut satırların detay sütunları güncellenir.
// En yeni maçtan geriye gider; varsayılan yalnızca güncel sezonlar.
// Kullanım:
//   npx tsx scripts/sync-player-extras.ts --limit 300            (güncel sezonlardan en yeni 300 maç)
//   npx tsx scripts/sync-player-extras.ts --limit 1000 --all     (sezon fark etmeksizin)
//   npx tsx scripts/sync-player-extras.ts --dry                  (yalnızca kaç maç kaldığını yazar, istek atmaz)
import { prisma } from "../src/lib/prisma";
import { bsd, BsdQuotaError } from "../src/lib/bsd/client";
import { playerExtras } from "../src/lib/bsd/player-extras";
import { runJob } from "./lib/run-job";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const limit = Number(arg("limit") ?? 300);
const allSeasons = flag("all");
const dry = flag("dry");

runJob("player-extras", async () => {
  const where = {
    playerStats: { some: { extrasSynced: false } },
    ...(allSeasons ? {} : { season: { isCurrent: true } }),
  };
  const remaining = await prisma.match.count({ where });
  console.log(`Detayı eksik maç: ${remaining}${allSeasons ? "" : " (güncel sezonlar)"}`);
  if (dry) return;

  const matches = await prisma.match.findMany({ where, orderBy: { eventDate: "desc" }, take: limit, select: { id: true } });
  console.log(`${matches.length} maç işlenecek`);

  let ok = 0;
  let failed = 0;
  for (const [i, m] of matches.entries()) {
    try {
      const ps = await bsd.eventPlayerStats(m.id);
      const rows = (ps.player_stats ?? []).filter((p) => p.player_id != null);
      await prisma.$transaction([
        ...rows.map((p) =>
          prisma.playerMatchStat.updateMany({ where: { matchId: m.id, playerId: p.player_id! }, data: playerExtras(p) }),
        ),
        // BSD'nin artık döndürmediği satırlar tekrar tekrar istenmesin
        prisma.playerMatchStat.updateMany({ where: { matchId: m.id, extrasSynced: false }, data: { extrasSynced: true } }),
      ]);
      ok++;
    } catch (e) {
      if (e instanceof BsdQuotaError) throw e;
      failed++;
      console.warn(`Maç ${m.id} atlandı: ${e instanceof Error ? e.message : e}`);
    }
    if ((i + 1) % 50 === 0) console.log(`${i + 1}/${matches.length} işlendi`);
  }
  console.log(`Sonuç: ${ok} başarılı, ${failed} atlandı · kalan ≈ ${remaining - ok}`);
});
