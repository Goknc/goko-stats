// scripts/sync-matches.ts
// Takip edilen liglerde verilen tarih aralığındaki maçları ve takımları çeker.
// Kullanım: npx tsx scripts/sync-matches.ts --from 2025-07-01 --to 2026-10-12
// Parametresiz: 3 gün önce → 7 gün sonra
//
// --scores-only: Yalnızca skor arşivi (aralarındaki maçlar analizi için). Bu modda YENİ eklenen maçlar
// scoresOnly=true işaretlenir ve sync-details onlara hiç dokunmaz (kota korunur). Zaten var olan
// maçların işareti değiştirilmez; yani detayı çekilmiş bir maç yanlışlıkla "sadece skor"a düşmez.
//   npx tsx scripts/sync-matches.ts --from 2023-07-01 --to 2025-06-30 --scores-only
import { prisma } from "../src/lib/prisma";
import { bsd } from "../src/lib/bsd/client";
import { runJob } from "./lib/run-job";

const DAY = 24 * 60 * 60 * 1000;
const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const from = arg("from") ?? toIsoDate(new Date(Date.now() - 3 * DAY));
const to = arg("to") ?? toIsoDate(new Date(Date.now() + 7 * DAY));
// İsteğe bağlı: --leagues 9,18,85 → yalnızca bu ligler
const leagueFilter = arg("leagues")?.split(",").map(Number);
const scoresOnly = process.argv.includes("--scores-only");

runJob("matches", async () => {
  const leagues = await prisma.league.findMany({
    where: { isTracked: true, ...(leagueFilter ? { id: { in: leagueFilter } } : {}) },
  });
  const knownSeasons = new Set((await prisma.season.findMany({ select: { id: true } })).map((s) => s.id));
  const savedTeams = new Set<number>();
  let total = 0;
  let missingSeason = 0;

  for (const league of leagues) {
    const events = await bsd.events({ league_id: league.id, date_from: from, date_to: to });

    for (const e of events) {
      const teams: [number, string][] = [
        [e.home_team_id, e.home_team],
        [e.away_team_id, e.away_team],
      ];
      for (const [id, name] of teams) {
        if (savedTeams.has(id)) continue;
        await prisma.team.upsert({ where: { id }, update: { name }, create: { id, name } });
        savedTeams.add(id);
      }

      const seasonKnown = !!e.season_id && knownSeasons.has(e.season_id);
      if (!seasonKnown) missingSeason++;
      const data = {
        leagueId: league.id,
        seasonId: seasonKnown ? e.season_id : null,
        homeTeamId: e.home_team_id,
        awayTeamId: e.away_team_id,
        eventDate: new Date(e.event_date),
        status: e.status,
        replacedBy: e.replaced_by,
        roundNumber: e.round_number,
        stage: e.stage,
        homeScore: e.home_score,
        awayScore: e.away_score,
        homeScoreHt: e.home_score_ht,
        awayScoreHt: e.away_score_ht,
      };
      // scoresOnly yalnızca oluştururken yazılır, güncellemede dokunulmaz
      await prisma.match.upsert({ where: { id: e.id }, update: data, create: { id: e.id, ...data, scoresOnly } });
    }

    total += events.length;
    console.log(`${league.name}: ${events.length} maç`);
  }
  console.log(`Toplam ${total} maç (${from} → ${to})${scoresOnly ? " · yalnızca skor" : ""}`);
  if (missingSeason > 0) {
    console.warn(`${missingSeason} maçın sezonu veritabanında yok; önce sync-seasons çalıştırılmalı`);
  }
});
