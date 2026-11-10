// scripts/check-seasons.ts
// BSD'nin eski sezonları (23/24, 24/25) verip vermediğini kontrol eder. Veritabanına yazmaz.
// Çalıştırma: npx tsx --env-file=.env scripts/check-seasons.ts
// İstek maliyeti: lig başına 1 (sezon listesi) + en eski sezonun maçları için 1-2 sayfa.
import { bsd, getRequestCount } from "../src/lib/bsd/client";

const LEAGUES: [number, string][] = [
  [1, "Premier League"],
  [11, "Süper Lig"],
  [3, "La Liga"],
  [7, "Champions League"],
  [94, "2. Bundesliga"], // B10: yalnızca 26/27 bekleniyor
];

async function main() {
  for (const [id, name] of LEAGUES) {
    console.log(`\n=== ${name} (${id}) ===`);
    const seasons = await bsd.leagueSeasons(id);
    console.log(`${seasons.length} sezon:`);
    for (const s of seasons) console.log("  " + JSON.stringify(s));

    // En eski sezonda gerçekten bitmiş maç ve skor var mı? (sezon nesnesinin alan adları belgelenmemiş)
    const oldest = seasons.at(-1) as Record<string, unknown> | undefined;
    const seasonId = Number(oldest?.id);
    if (!Number.isFinite(seasonId)) continue;
    const events = await bsd.events({ league_id: id, season_id: seasonId, status: "finished" });
    const sample = events[0];
    console.log(`  en eski sezon (${seasonId}): ${events.length} bitmiş maç`);
    if (sample) console.log("  örnek maç: " + JSON.stringify(sample).slice(0, 400));
  }
  console.log(`\nToplam BSD isteği: ${getRequestCount()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
