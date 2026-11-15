// scripts/sync-details.ts
// Bitmiş maçların istatistiklerini, oyuncu verilerini ve kadrolarını çeker.
// Oyuncu verisi kapalı liglerde yalnızca takım istatistiği çekilir (maç başına 1 istek).
// Kullanım:
//   npx tsx scripts/sync-details.ts --limit 500    (en yeni 500 maç)
//   npx tsx scripts/sync-details.ts --match 213582 (tek maç, test için)
//   npx tsx scripts/sync-details.ts --leagues 64,58,27 --limit 400 (yalnızca bu ligler)
import { prisma } from "../src/lib/prisma";
import { bsd, BsdQuotaError } from "../src/lib/bsd/client";
import type {
  BsdEventStats, BsdLineups, BsdPlayerStats, BsdTeamStats, BsdPlayerStat, BsdLineupPlayer,
} from "../src/lib/bsd/types";
import { playerExtras } from "../src/lib/bsd/player-extras";
import { runJob } from "./lib/run-job";

const SETTLE_HOURS = 6;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const limit = Number(arg("limit") ?? 500);
const onlyMatch = arg("match") ? Number(arg("match")) : undefined;
const leagueFilter = arg("leagues")?.split(",").map(Number).filter(Number.isInteger);

type MatchRef = { id: number; homeTeamId: number; awayTeamId: number };
type PeriodCode = "FULL" | "H1" | "H2";
type LineupEntry = { player: BsdLineupPlayer & { id: number }; teamId: number; isStarter: boolean };

function teamStatRow(matchId: number, teamId: number, period: PeriodCode, isHome: boolean, s: BsdTeamStats) {
  return {
    matchId,
    teamId,
    period,
    isHome,
    corners: s.corner_kicks ?? null,
    yellowCards: s.yellow_cards ?? null,
    redCards: s.red_cards ?? null,
    shotsTotal: s.total_shots ?? null,
    shotsOnTarget: s.shots_on_target ?? null,
    fouls: s.fouls ?? null,
    offsides: s.offsides ?? null,
  };
}

async function saveDetails(m: MatchRef, stats: BsdEventStats, ps: BsdPlayerStats, lu: BsdLineups) {
  // B8: id'siz oyuncular atlanır, takip edilemezler
  const playerStats = (ps.player_stats ?? []).filter(
    (p) => p.player_id != null,
  ) as (BsdPlayerStat & { player_id: number })[];

  // Takım istatistikleri: maç geneli + ilk yarı + ikinci yarı
  const teamRows: ReturnType<typeof teamStatRow>[] = [];
  const s = stats.stats;
  if (s) {
    teamRows.push(teamStatRow(m.id, m.homeTeamId, "FULL", true, s.home));
    teamRows.push(teamStatRow(m.id, m.awayTeamId, "FULL", false, s.away));
    if (s.first_half) {
      teamRows.push(teamStatRow(m.id, m.homeTeamId, "H1", true, s.first_half.home));
      teamRows.push(teamStatRow(m.id, m.awayTeamId, "H1", false, s.first_half.away));
    }
    if (s.second_half) {
      teamRows.push(teamStatRow(m.id, m.homeTeamId, "H2", true, s.second_half.home));
      teamRows.push(teamStatRow(m.id, m.awayTeamId, "H2", false, s.second_half.away));
    }
    // Spike B5: takım kırmızı kartı null ise oyuncu kartlarının toplamını kullan
    for (const row of teamRows) {
      if (row.period === "FULL" && row.redCards === null && playerStats.length > 0) {
        row.redCards = playerStats
          .filter((p) => p.team_id === row.teamId)
          .reduce((sum, p) => sum + (p.red_card ?? 0), 0);
      }
    }
  }

  // Kadro: ilk 11 + yedekler (B8: id'siz oyuncular atlanır)
  const lineupEntries = (
    lu.lineups && lu.lineup_status !== "unavailable"
      ? (["home", "away"] as const).flatMap((side) => {
          const t = lu.lineups![side];
          return [
            ...t.players.map((p) => ({ player: p, teamId: t.team_id, isStarter: true })),
            ...t.substitutes.map((p) => ({ player: p, teamId: t.team_id, isStarter: false })),
          ];
        })
      : []
  ).filter((e) => e.player.id != null) as LineupEntry[];

  // Oyuncu isimleri kadrodan gelir; kadroda olmayan oyuncu için geçici isim
  const lineupInfo = new Map(lineupEntries.map((e) => [e.player.id, e.player]));
  const playerIds = new Set([...lineupEntries.map((e) => e.player.id), ...playerStats.map((p) => p.player_id)]);

  await prisma.$transaction(
    async (tx) => {
      for (const id of playerIds) {
        const info = lineupInfo.get(id);
        await tx.player.upsert({
          where: { id },
          update: info ? { name: info.name, position: info.position } : {},
          create: { id, name: info?.name ?? `Oyuncu #${id}`, position: info?.position ?? null },
        });
      }


      await tx.teamMatchStat.deleteMany({ where: { matchId: m.id } });
      if (teamRows.length) await tx.teamMatchStat.createMany({ data: teamRows });

      await tx.matchLineup.deleteMany({ where: { matchId: m.id } });
      if (lineupEntries.length) {
        await tx.matchLineup.createMany({
          skipDuplicates: true,
          data: lineupEntries.map((e) => ({
            matchId: m.id,
            teamId: e.teamId,
            playerId: e.player.id,
            isStarter: e.isStarter,
            lineupStatus: lu.lineup_status === "confirmed" ? "CONFIRMED" : "PREDICTED",
          })),
        });
      }

      await tx.playerMatchStat.deleteMany({ where: { matchId: m.id } });
      if (playerStats.length) {
        await tx.playerMatchStat.createMany({
          skipDuplicates: true,
          data: playerStats.map((p) => ({
            matchId: m.id,
            playerId: p.player_id,
            teamId: p.team_id,
            minutesPlayed: p.minutes_played ?? 0,
            goals: p.goals ?? 0,
            assists: p.goal_assist ?? 0,
            shotsTotal: p.total_shots ?? 0,
            shotsOnTarget: p.shots_on_target ?? 0,
            tackles: p.total_tackle ?? 0,
            fouls: p.fouls ?? 0,
            yellowCards: p.yellow_card ?? 0,
            redCards: p.red_card ?? 0,
            ...playerExtras(p),
          })),
        });
      }

      await tx.match.update({ where: { id: m.id }, data: { detailsSyncedAt: new Date() } });
    },
    { timeout: 30_000 },
  );
}

runJob("details", async () => {
  const cutoff = new Date(Date.now() - SETTLE_HOURS * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: onlyMatch
      ? { id: onlyMatch }
      : {
          status: "finished",
          detailsSyncedAt: null,
          scoresOnly: false, // yalnızca skor arşivi olan eski maçlara dokunma (kota)
          eventDate: { lt: cutoff },
          league: { isTracked: true },
          ...(leagueFilter?.length ? { leagueId: { in: leagueFilter } } : {}),
        },
    orderBy: { eventDate: "desc" },
    take: limit,
    select: { id: true, homeTeamId: true, awayTeamId: true, league: { select: { playerStatsEnabled: true } } },
  });
  console.log(`${matches.length} maç işlenecek`);

  let ok = 0;
  let failed = 0;
  for (const [i, m] of matches.entries()) {
    try {
      // Oyuncu verisi açık liglerde 3 endpoint birlikte, kapalı liglerde yalnızca takım istatistiği
      const withPlayers = m.league.playerStatsEnabled;
      const [stats, playerStats, lineups] = await Promise.all([
        bsd.eventStats(m.id),
        withPlayers ? bsd.eventPlayerStats(m.id) : Promise.resolve({ event_id: m.id, player_stats: [] }),
        withPlayers
          ? bsd.eventLineups(m.id)
          : Promise.resolve({ event_id: m.id, lineup_status: "unavailable" as const, lineups: null }),
      ]);
      await saveDetails(m, stats, playerStats, lineups);
      ok++;
    } catch (e) {
      if (e instanceof BsdQuotaError) throw e;
      failed++;
      console.warn(`Maç ${m.id} atlandı: ${e instanceof Error ? e.message : e}`);
    }
    if ((i + 1) % 50 === 0) console.log(`${i + 1}/${matches.length} işlendi`);
  }

  console.log(`Sonuç: ${ok} başarılı, ${failed} atlandı`);
  if (ok === 0 && failed > 0) throw new Error("Hiçbir maç işlenemedi");
});