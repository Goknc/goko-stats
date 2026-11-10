// src/lib/player-page.ts
// Oyuncu sayfasının verisi: oyuncu, güncel takımı ve ligi, son maçları (ilk 11 bilgisiyle), sıradaki maçı.
// Hesaplar motorda (engine/player-profile).
import { prisma } from "./prisma";
import { inferStarter } from "./engine/starter";
import type { ProfileGame } from "./engine/player-profile";
import { EXTRA_KEYS, type ExtraLine } from "./engine/player-extras";
import { seasonYear } from "./engine/player-bio";

// Sayfada bakılan en fazla maç (filtreler bunun içinden seçer)
const HISTORY = 60;

export type PlayerPageGame = ProfileGame & {
  teamId: number;
  teamName: string;
  opponentId: number;
  opponentName: string;
  competition: string;
  goalsFor: number | null;
  goalsAgainst: number | null;
  redCards: number;
  extras: ExtraLine | null; // detaylı istatistik (pas, ikili...); çekilmemişse null
};

export interface PlayerProfile {
  specificPosition: string | null;
  jerseyNumber: number | null;
  dateOfBirth: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  preferredFoot: string | null;
  nationality: string | null;
  nationalTeamId: number | null;
  nationalTeamName: string | null;
  marketValueEur: number | null;
  contractUntil: Date | null;
  availability: string | null;
  injuryType: string | null;
  injuryReturn: Date | null;
  profileSyncedAt: Date | null;
}

export interface CareerRow {
  seasonId: number;
  seasonName: string | null;
  leagueId: number;
  leagueName: string | null;
  teamId: number;
  teamName: string | null;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  avgRating: number | null;
}

export interface TransferRow {
  id: number;
  date: Date;
  fromTeamId: number | null;
  fromTeamName: string | null;
  toTeamId: number | null;
  toTeamName: string | null;
  feeEur: number | null;
  feeDescription: string | null;
  transferType: number | null;
}

export interface PlayerPageData {
  player: { id: number; name: string; position: string | null };
  profile: PlayerProfile;
  career: CareerRow[]; // en yeni sezondan eskiye (bkz. engine/player-bio > seasonYear)
  transfers: TransferRow[]; // en yeniden eskiye
  team: { id: number; name: string } | null; // en son oynadığı maçtaki takımı
  league: { id: number; name: string } | null; // takımının en son lig maçının ligi
  games: PlayerPageGame[]; // en yeniden eskiye
  nextMatch: { id: number; eventDate: Date; homeName: string; awayName: string; isHome: boolean } | null;
}

export async function loadPlayerPage(playerId: number): Promise<PlayerPageData | null> {
  if (!Number.isInteger(playerId)) return null;
  const row = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      career: { orderBy: { seasonId: "desc" } },
      transfers: { orderBy: { transferDate: "desc" } },
    },
  });
  if (!row) return null;
  const player = { id: row.id, name: row.name, position: row.position };
  const profile: PlayerProfile = {
    specificPosition: row.specificPosition,
    jerseyNumber: row.jerseyNumber,
    dateOfBirth: row.dateOfBirth,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    preferredFoot: row.preferredFoot,
    nationality: row.nationality,
    nationalTeamId: row.nationalTeamId,
    nationalTeamName: row.nationalTeamName,
    marketValueEur: row.marketValueEur === null ? null : Number(row.marketValueEur),
    contractUntil: row.contractUntil,
    availability: row.availability,
    injuryType: row.injuryType,
    injuryReturn: row.injuryReturn,
    profileSyncedAt: row.profileSyncedAt,
  };
  const career: CareerRow[] = [...row.career]
    .sort((a, b) => seasonYear(b.seasonName) - seasonYear(a.seasonName) || b.seasonId - a.seasonId)
    .map((c) => ({
      seasonId: c.seasonId, seasonName: c.seasonName, leagueId: c.leagueId, leagueName: c.leagueName, teamId: c.teamId,
      teamName: c.teamName, matches: c.matches, minutes: c.minutes, goals: c.goals, assists: c.assists, avgRating: c.avgRating,
    }));
  const transfers: TransferRow[] = row.transfers.map((t) => ({
    id: t.id, date: t.transferDate, fromTeamId: t.fromTeamId, fromTeamName: t.fromTeamName, toTeamId: t.toTeamId,
    toTeamName: t.toTeamName, feeEur: t.feeEur === null ? null : Number(t.feeEur), feeDescription: t.feeDescription,
    transferType: t.transferType,
  }));

  const stats = await prisma.playerMatchStat.findMany({
    where: { playerId, minutesPlayed: { gt: 0 }, match: { status: "finished" } },
    orderBy: { match: { eventDate: "desc" } },
    take: HISTORY,
    include: {
      match: {
        select: {
          eventDate: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
          league: { select: { id: true, name: true, competitionType: true } },
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      },
    },
  });

  // İlk 11 bilgisi: kadro biliniyorsa kadrodan, bilinmiyorsa 60+ dakika kuralı (engine/starter)
  const matchIds = stats.map((s) => s.matchId);
  const [knownLineups, starterRows] = await Promise.all([
    prisma.matchLineup.findMany({ where: { matchId: { in: matchIds } }, select: { matchId: true, teamId: true }, distinct: ["matchId", "teamId"] }),
    prisma.matchLineup.findMany({ where: { matchId: { in: matchIds }, playerId, isStarter: true }, select: { matchId: true } }),
  ]);
  const lineupKnown = new Set(knownLineups.map((l) => `${l.matchId}-${l.teamId}`));
  const listedStarter = new Set(starterRows.map((l) => l.matchId));

  const games: PlayerPageGame[] = stats.map((s) => {
    const m = s.match;
    const isHome = s.teamId === m.homeTeamId;
    return {
      matchId: s.matchId,
      date: m.eventDate.getTime(),
      isHome,
      started: inferStarter({
        lineupKnown: lineupKnown.has(`${s.matchId}-${s.teamId}`),
        listedAsStarter: listedStarter.has(s.matchId),
        minutesPlayed: s.minutesPlayed,
      }),
      minutes: s.minutesPlayed,
      competitionType: m.league.competitionType,
      competition: m.league.name,
      teamId: s.teamId,
      teamName: isHome ? m.homeTeam.name : m.awayTeam.name,
      opponentId: isHome ? m.awayTeamId : m.homeTeamId,
      opponentName: isHome ? m.awayTeam.name : m.homeTeam.name,
      goalsFor: isHome ? m.homeScore : m.awayScore,
      goalsAgainst: isHome ? m.awayScore : m.homeScore,
      redCards: s.redCards,
      extras: s.extrasSynced ? (Object.fromEntries(EXTRA_KEYS.map((k) => [k, s[k]])) as ExtraLine) : null,
      stats: {
        goals: s.goals, assists: s.assists, shotsOnTarget: s.shotsOnTarget, shotsTotal: s.shotsTotal,
        tackles: s.tackles, fouls: s.fouls, yellowCards: s.yellowCards,
      },
    };
  });

  const latest = games[0];
  const team = latest ? { id: latest.teamId, name: latest.teamName } : null;
  const leagueRow = stats.find((s) => s.teamId === team?.id && s.match.league.competitionType === "LEAGUE")?.match.league;
  const league = leagueRow ? { id: leagueRow.id, name: leagueRow.name } : null;

  const next = team
    ? await prisma.match.findFirst({
        where: { status: "notstarted", eventDate: { gt: new Date() }, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
        orderBy: { eventDate: "asc" },
        select: { id: true, eventDate: true, homeTeamId: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
      })
    : null;
  const nextMatch = next
    ? { id: next.id, eventDate: next.eventDate, homeName: next.homeTeam.name, awayName: next.awayTeam.name, isHome: next.homeTeamId === team!.id }
    : null;

  return { player, profile, career, transfers, team, league, games, nextMatch };
}
