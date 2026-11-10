// src/lib/h2h-players-loader.ts
// Aralarındaki son karşılaşmaların oyuncu verisini okur, hesabı motora (engine/h2h-players) bırakır.
// Yalnızca oyuncu verisi olan maçlar sayılır (skor arşivi ve oyuncu istatistiği kapalı ligler hariç).
import { prisma } from "./prisma";
import { summarizeH2HPlayers, type H2HPlayers } from "./engine/h2h-players";

export const H2H_PLAYER_MATCHES = 6;

export async function loadH2HPlayers(homeId: number, awayId: number, before: Date): Promise<H2HPlayers | null> {
  const matches = await prisma.match.findMany({
    where: {
      status: "finished",
      eventDate: { lt: before },
      playerStats: { some: {} },
      OR: [
        { homeTeamId: homeId, awayTeamId: awayId },
        { homeTeamId: awayId, awayTeamId: homeId },
      ],
    },
    orderBy: { eventDate: "desc" },
    take: H2H_PLAYER_MATCHES,
    select: { id: true },
  });
  if (matches.length < 2) return null; // tek maçla "öne çıkan" denmez

  const stats = await prisma.playerMatchStat.findMany({
    where: { matchId: { in: matches.map((m) => m.id) } },
    select: {
      matchId: true, playerId: true, teamId: true, goals: true, assists: true, minutesPlayed: true,
      player: { select: { name: true } },
    },
  });

  // Oyuncunun şu anki takımı: bugünden önceki son maçında oynadığı takım
  const latest = await prisma.playerMatchStat.findMany({
    where: { playerId: { in: [...new Set(stats.map((s) => s.playerId))] }, match: { status: "finished", eventDate: { lt: before } } },
    orderBy: { match: { eventDate: "desc" } },
    distinct: ["playerId"],
    select: { playerId: true, teamId: true },
  });

  return summarizeH2HPlayers(
    stats.map(({ player, ...s }) => ({ ...s, name: player.name })),
    matches.length,
    homeId,
    awayId,
    new Map(latest.map((l) => [l.playerId, l.teamId])),
  );
}
