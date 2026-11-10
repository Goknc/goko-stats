// src/lib/team-page.ts
// Takım sayfasının verisi: takımın son maçları (detay satırlarıyla), ligi ve oyuncu tablosu.
// Hesaplar motorda (engine/team-metrics, engine/player-grid).
import { prisma } from "./prisma";
import { canonicalLeagueId } from "./engine/leagues";
import type { TeamMatch, PeriodStat } from "./engine/team-metrics";
import { playerGrid, PLAYER_GRID_STATS, type GridStat, type GridRow } from "./engine/player-grid";

// Filtrelerden önce bakılan maç sayısı (son 20 + filtrelerle elenenler için pay)
const HISTORY = 80;

// Ligde verisi güvenilir olmayan oyuncu istatistikleri: Liga Portugal, Ligue 1, Eredivisie, MLS'te top kapma; Süper Lig'de sarı kart
const PLAYER_STAT_EXCLUSIONS: Partial<Record<GridStat, number[]>> = { tackles: [2, 6, 10, 18], yellowCards: [11] };

export type TeamPageMatch = TeamMatch & { hasPlayerData: boolean };

export interface TeamPageData {
  team: { id: number; name: string };
  league: { id: number; name: string; playerStatsEnabled: boolean } | null;
  matches: TeamPageMatch[]; // bitmiş, en yeniden eskiye
  playerStats: { key: GridStat; label: string }[]; // bu ligde açık oyuncu istatistikleri
}

export async function loadTeamPage(teamId: number): Promise<TeamPageData | null> {
  if (!Number.isInteger(teamId)) return null;
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
  if (!team) return null;

  const rows = await prisma.match.findMany({
    where: { status: "finished", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: { eventDate: "desc" },
    take: HISTORY,
    include: {
      league: { select: { id: true, name: true, competitionType: true, playerStatsEnabled: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      teamStats: {
        select: { teamId: true, period: true, corners: true, yellowCards: true, redCards: true, shotsTotal: true, shotsOnTarget: true, fouls: true },
      },
      // İkinci sarıdan atılanlar (kart sayımı için, bkz. engine/totals)
      playerStats: { where: { yellowCards: { gte: 2 }, redCards: { gt: 0 } }, select: { teamId: true } },
      _count: { select: { playerStats: true } },
    },
  });

  const matches: TeamPageMatch[] = rows.map((r) => ({
    id: r.id,
    eventDate: r.eventDate,
    competition: r.league.name,
    competitionType: r.league.competitionType,
    homeTeamId: r.homeTeamId,
    awayTeamId: r.awayTeamId,
    homeName: r.homeTeam.name,
    awayName: r.awayTeam.name,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    homeScoreHt: r.homeScoreHt,
    awayScoreHt: r.awayScoreHt,
    stats: r.teamStats.map(
      (s): PeriodStat => ({
        ...s,
        secondYellows: s.period === "FULL" ? r.playerStats.filter((p) => p.teamId === s.teamId).length : 0,
      }),
    ),
    hasPlayerData: r.league.playerStatsEnabled && r._count.playerStats > 0,
  }));

  // Takımın ligi: en son oynadığı lig maçının ligi
  const leagueRow = rows.find((r) => r.league.competitionType === "LEAGUE")?.league ?? null;
  const league = leagueRow ? { id: leagueRow.id, name: leagueRow.name, playerStatsEnabled: leagueRow.playerStatsEnabled } : null;

  // Ligde verisi güvenilir olmayan oyuncu istatistikleri (örn. MLS'te top kapma) seçeneklerde görünmez
  let playerStats: TeamPageData["playerStats"] = [];
  if (league?.playerStatsEnabled) {
    const leagueIds = [league.id, canonicalLeagueId(league.id)];
    playerStats = PLAYER_GRID_STATS.filter((s) => !(PLAYER_STAT_EXCLUSIONS[s.key] ?? []).some((id) => leagueIds.includes(id))).map((s) => ({
      key: s.key,
      label: s.label,
    }));
  }

  return { team, league, matches, playerStats };
}

// Seçilen maçlarda takımın oyuncuları ve seçilen istatistik
export async function loadPlayerGrid(teamId: number, matchIds: number[], stat: GridStat): Promise<GridRow[]> {
  if (!matchIds.length) return [];
  const [stats, lineups] = await Promise.all([
    prisma.playerMatchStat.findMany({
      where: { teamId, matchId: { in: matchIds } },
      include: { player: { select: { name: true } } },
    }),
    prisma.matchLineup.findMany({
      where: { teamId, matchId: { in: matchIds } },
      select: { matchId: true, playerId: true, isStarter: true, player: { select: { name: true } } },
    }),
  ]);
  // Takımdan ayrılanlar listelenmez: oyuncunun son maçı başka takımda ise (örn. transfer)
  const playerIds = [...new Set([...stats.map((s) => s.playerId), ...lineups.map((l) => l.playerId)])];
  const latest = await prisma.playerMatchStat.findMany({
    where: { playerId: { in: playerIds }, match: { status: "finished" } },
    orderBy: { match: { eventDate: "desc" } },
    distinct: ["playerId"],
    select: { playerId: true, teamId: true },
  });
  const left = new Set(latest.filter((l) => l.teamId !== teamId).map((l) => l.playerId));

  return playerGrid(
    matchIds,
    stats.filter((s) => !left.has(s.playerId)).map((s) => ({ matchId: s.matchId, playerId: s.playerId, name: s.player.name, minutesPlayed: s.minutesPlayed, value: s[stat] })),
    lineups.filter((l) => !left.has(l.playerId)).map((l) => ({ matchId: l.matchId, playerId: l.playerId, isStarter: l.isStarter, name: l.player.name })),
  );
}
