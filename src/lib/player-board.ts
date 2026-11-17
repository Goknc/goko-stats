// src/lib/player-board.ts
// Maç detayı, oyuncu eşik tablosu verisi: iki kadrodaki (ilk 11 + yedek) her oyuncunun bütün takımlarındaki
// (kulüp ve milli takım) son maçları ve o maçlardaki istatistikleri. Hesap engine/player-board'da, istemcide yapılır.
import { prisma } from "./prisma";
import { isNationalTeamLeague } from "./engine/leagues";
import { inferStarter } from "./engine/starter";
import type { BoardGame } from "./engine/player-board";
import type { TeamLineup } from "./lineup";

export interface BoardPlayer {
  id: number;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  side: "home" | "away";
  starter: boolean; // maçın ilk 11'inde mi (kesin ya da tahmini)
  games: BoardGame[]; // en yeniden eskiye
}

const GAMES_PER_PLAYER = 30; // filtrelerden sonra 15 maç kalabilsin diye fazlası
const WINDOW_DAYS = 730;

export async function loadPlayerBoard(squads: { home: TeamLineup; away: TeamLineup }, before: Date): Promise<BoardPlayer[]> {
  const roster = (["home", "away"] as const).flatMap((side) => [
    ...squads[side].starters.map((p) => ({ ...p, side, starter: true })),
    ...squads[side].bench.map((p) => ({ ...p, side, starter: false })),
  ]);
  if (!roster.length) return [];
  const ids = roster.map((p) => p.id);

  const stats = await prisma.playerMatchStat.findMany({
    where: {
      playerId: { in: ids },
      minutesPlayed: { gt: 0 },
      match: { status: "finished", eventDate: { lt: before, gte: new Date(before.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000) } },
    },
    orderBy: { match: { eventDate: "desc" } },
    select: {
      matchId: true, playerId: true, teamId: true, minutesPlayed: true,
      goals: true, assists: true, shotsTotal: true, shotsOnTarget: true, tackles: true, fouls: true, yellowCards: true,
      extrasSynced: true, wasFouled: true, keyPasses: true, dribblesWon: true, interceptions: true, clearances: true,
      offsides: true, passesAccurate: true, saves: true,
      match: {
        select: {
          eventDate: true, leagueId: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
          homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
        },
      },
    },
  });

  // Oyuncu başına son maçlar; ilk 11 bilgisi oyuncunun kendi kadro kaydından (yoksa 60+ dakika)
  const perPlayer = new Map<number, typeof stats>();
  for (const s of stats) {
    const list = perPlayer.get(s.playerId) ?? [];
    if (list.length < GAMES_PER_PLAYER) list.push(s);
    perPlayer.set(s.playerId, list);
  }
  const kept = [...perPlayer.values()].flat();
  const lineups = await prisma.matchLineup.findMany({
    where: { playerId: { in: ids }, matchId: { in: [...new Set(kept.map((s) => s.matchId))] } },
    select: { matchId: true, playerId: true, isStarter: true },
  });
  const starterOf = new Map(lineups.map((l) => [`${l.matchId}-${l.playerId}`, l.isStarter]));

  return roster.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    jerseyNumber: p.jerseyNumber,
    side: p.side,
    starter: p.starter,
    games: (perPlayer.get(p.id) ?? []).map((s): BoardGame => {
      const m = s.match;
      const isHome = m.homeTeamId === s.teamId;
      const listed = starterOf.get(`${s.matchId}-${s.playerId}`);
      // Detaylı istatistikler yalnızca çekilmiş maçlarda; çekilmemişse "veri yok"
      const extra = (v: number | null) => (s.extrasSynced ? v : null);
      return {
        matchId: s.matchId,
        date: m.eventDate.getTime(),
        isHome,
        national: isNationalTeamLeague(m.leagueId),
        started: inferStarter({ lineupKnown: listed !== undefined, listedAsStarter: listed === true, minutesPlayed: s.minutesPlayed }),
        minutes: s.minutesPlayed,
        teamId: s.teamId,
        opponentId: isHome ? m.awayTeamId : m.homeTeamId,
        opponentName: isHome ? m.awayTeam.name : m.homeTeam.name,
        score: isHome ? `${m.homeScore ?? "-"}-${m.awayScore ?? "-"}` : `${m.awayScore ?? "-"}-${m.homeScore ?? "-"}`,
        values: {
          shotsTotal: s.shotsTotal,
          shotsOnTarget: s.shotsOnTarget,
          goals: s.goals,
          assists: s.assists,
          goalsAssists: s.goals + s.assists,
          tackles: s.tackles,
          fouls: s.fouls,
          yellowCards: s.yellowCards,
          wasFouled: extra(s.wasFouled),
          keyPasses: extra(s.keyPasses),
          dribblesWon: extra(s.dribblesWon),
          interceptions: extra(s.interceptions),
          clearances: extra(s.clearances),
          offsides: extra(s.offsides),
          passesAccurate: extra(s.passesAccurate),
          saves: extra(s.saves),
        },
      };
    }),
  }));
}
