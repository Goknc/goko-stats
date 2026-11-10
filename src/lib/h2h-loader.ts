// İki takımın aralarındaki maçları veritabanından okur, hesabı motora (engine/h2h) bırakır.
// Bütün turnuvalar dahil (lig, kupa, Avrupa); skor arşivi (scoresOnly) maçları da sayılır.
import { prisma } from "./prisma";
import { headToHead, DEFAULT_H2H_FILTER, type H2HFilter, type H2HSummary } from "./engine/h2h";

// filter: saha (tümü / A evinde / B evinde) ve en yeni kaç maç; özet yalnızca bu maçlardan hesaplanır
export async function loadHeadToHead(
  teamA: number,
  teamB: number,
  before: Date,
  filter: H2HFilter = DEFAULT_H2H_FILTER,
): Promise<H2HSummary> {
  const rows = await prisma.match.findMany({
    where: {
      status: "finished",
      eventDate: { lt: before },
      OR: [
        { homeTeamId: teamA, awayTeamId: teamB },
        { homeTeamId: teamB, awayTeamId: teamA },
      ],
    },
    select: {
      id: true, eventDate: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
      league: { select: { name: true } },
    },
  });
  return headToHead(
    rows.map(({ league, ...r }) => ({ ...r, competition: league.name })),
    teamA,
    filter,
  );
}
