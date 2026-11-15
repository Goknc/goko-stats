// src/lib/search.ts
// Takım ve oyuncu araması (başlıktaki arama kutusu, /search sayfası ve karşılaştırma seçicisi).
// Ada göre büyük/küçük harf duyarsız; adı aranan kelimeyle başlayanlar önde, sonra en son maçı yeni olanlar.
import { prisma } from "./prisma";
import { teamNamesMatching } from "./team-names";

export interface TeamHit {
  type: "team";
  id: number;
  name: string;
  league: string | null;
}

export interface PlayerHit {
  type: "player";
  id: number;
  name: string;
  team: string | null;
  position: string | null;
}

export type SearchKind = "all" | "team" | "player";

export const MIN_QUERY = 2;

// Kullanıcı girdisini sadeleştirir: baştaki/sondaki boşluklar, fazla boşluklar, en fazla 60 karakter
export const normalizeQuery = (q: string | null | undefined) => (q ?? "").trim().replace(/\s+/g, " ").slice(0, 60);

const startsFirst = <T extends { name: string }>(q: string) => {
  const lower = q.toLocaleLowerCase("tr");
  return (a: T, b: T) =>
    Number(b.name.toLocaleLowerCase("tr").startsWith(lower)) - Number(a.name.toLocaleLowerCase("tr").startsWith(lower));
};

export async function searchTeams(q: string, limit = 8): Promise<TeamHit[]> {
  if (q.length < MIN_QUERY) return [];
  // Yalnızca takip edilen liglerde maçı olan takımlar (kupada bir kez görünen alt lig takımları değil)
  const teams = await prisma.team.findMany({
    where: {
      // Ekranda Türkçe görünen milli takımlar Türkçe adıyla da bulunur ("letonya" → Latvia)
      AND: [{ OR: [{ name: { contains: q, mode: "insensitive" } }, { name: { in: teamNamesMatching(q) } }] }],
      OR: [{ homeMatches: { some: { league: { isTracked: true } } } }, { awayMatches: { some: { league: { isTracked: true } } } }],
    },
    select: { id: true, name: true },
    take: limit * 3,
  });
  if (!teams.length) return [];

  // Her takımın en son lig maçının ligi
  const recent = await prisma.match.findMany({
    where: {
      league: { competitionType: "LEAGUE", isTracked: true },
      OR: [{ homeTeamId: { in: teams.map((t) => t.id) } }, { awayTeamId: { in: teams.map((t) => t.id) } }],
    },
    orderBy: { eventDate: "desc" },
    select: { homeTeamId: true, awayTeamId: true, eventDate: true, league: { select: { name: true } } },
    take: 400,
  });
  const leagueOf = new Map<number, { name: string; at: number }>();
  for (const m of recent) {
    for (const id of [m.homeTeamId, m.awayTeamId]) {
      if (!leagueOf.has(id)) leagueOf.set(id, { name: m.league.name, at: m.eventDate.getTime() });
    }
  }

  return teams
    .map((t): TeamHit & { at: number } => ({ type: "team", id: t.id, name: t.name, league: leagueOf.get(t.id)?.name ?? null, at: leagueOf.get(t.id)?.at ?? 0 }))
    .sort((a, b) => startsFirst<TeamHit>(q)(a, b) || b.at - a.at)
    .slice(0, limit)
    .map((t): TeamHit => ({ type: t.type, id: t.id, name: t.name, league: t.league }));
}

export async function searchPlayers(q: string, limit = 8): Promise<PlayerHit[]> {
  if (q.length < MIN_QUERY) return [];
  const players = await prisma.player.findMany({
    where: { name: { contains: q, mode: "insensitive" }, stats: { some: {} } },
    select: { id: true, name: true, position: true },
    take: limit * 4,
  });
  if (!players.length) return [];

  // Güncel takım: en son maçındaki takımı
  const latest = await prisma.playerMatchStat.findMany({
    where: { playerId: { in: players.map((p) => p.id) } },
    orderBy: { match: { eventDate: "desc" } },
    distinct: ["playerId"],
    select: { playerId: true, team: { select: { name: true } }, match: { select: { eventDate: true } } },
  });
  const info = new Map(latest.map((l) => [l.playerId, { team: l.team.name, at: l.match.eventDate.getTime() }]));

  return players
    .map((p): PlayerHit & { at: number } => ({
      type: "player", id: p.id, name: p.name, position: p.position, team: info.get(p.id)?.team ?? null, at: info.get(p.id)?.at ?? 0,
    }))
    .sort((a, b) => startsFirst<PlayerHit>(q)(a, b) || b.at - a.at)
    .slice(0, limit)
    .map((p): PlayerHit => ({ type: p.type, id: p.id, name: p.name, team: p.team, position: p.position }));
}

export async function search(q: string, kind: SearchKind = "all", limit = 8) {
  const [teams, players] = await Promise.all([
    kind === "player" ? [] : searchTeams(q, limit),
    kind === "team" ? [] : searchPlayers(q, limit),
  ]);
  return { teams, players };
}
