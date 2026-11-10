// scripts/sync-player-profiles.ts
// Oyuncu profilleri (yaş, boy, ayak, uyruk, milli takım, piyasa değeri, sözleşme, sakatlık), kariyer ve transferler.
//   Profiller: güncel sezonda oyuncu verisi olan her takımın kadrosu (takım başına ~1 istek).
//   Kariyer + transferler: oyuncu başına 2 istek; güncel sezonda en çok oynayandan başlar, son `stale-days` gün içinde
//   çekilmiş olanları atlar.
// Kullanım:
//   npx tsx scripts/sync-player-profiles.ts                          (profiller + 500 oyuncunun kariyeri)
//   npx tsx scripts/sync-player-profiles.ts --skip-profiles --career 3000
//   npx tsx scripts/sync-player-profiles.ts --career 0               (yalnızca profiller)
//   npx tsx scripts/sync-player-profiles.ts --dry                    (yalnızca sayılar, istek yok)
import { prisma } from "../src/lib/prisma";
import { bsd, BsdQuotaError } from "../src/lib/bsd/client";
import type { BsdPlayerProfile } from "../src/lib/bsd/types";
import { runJob } from "./lib/run-job";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const careerLimit = Number(arg("career") ?? 500);
const staleDays = Number(arg("stale-days") ?? 30);
const skipProfiles = flag("skip-profiles");
const dry = flag("dry");

const date = (s: string | null | undefined) => (s ? new Date(`${s}T00:00:00Z`) : null);
const big = (n: number | null | undefined) => (n == null ? null : BigInt(Math.round(n)));

function profileData(p: BsdPlayerProfile) {
  return {
    shortName: p.short_name || null,
    specificPosition: p.specific_position || null,
    jerseyNumber: p.jersey_number ?? null,
    dateOfBirth: date(p.date_of_birth),
    heightCm: p.height_cm ?? null,
    weightKg: p.weight_kg ?? null,
    preferredFoot: p.preferred_foot || null,
    nationality: p.nationality || null,
    currentTeamId: p.current_team?.id ?? p.current_team_id ?? null,
    currentTeamName: p.current_team?.name ?? null,
    nationalTeamId: p.national_team?.id ?? p.national_team_id ?? null,
    nationalTeamName: p.national_team?.name ?? null,
    marketValueEur: big(p.market_value_eur),
    contractUntil: date(p.contract_until),
    availability: p.availability || null,
    injuryType: p.injury_type || null,
    injuryReturn: date(p.injury_expected_return),
    profileSyncedAt: new Date(),
  };
}

async function syncProfiles() {
  const teams = await prisma.$queryRaw<{ teamId: number }[]>`
    SELECT DISTINCT pms."teamId"
    FROM player_match_stats pms
    JOIN matches m ON m.id = pms."matchId"
    JOIN seasons se ON se.id = m."seasonId"
    WHERE se."isCurrent"`;
  console.log(`Profiller: ${teams.length} takım`);
  if (dry) return;

  let players = 0;
  for (const [i, { teamId }] of teams.entries()) {
    try {
      const squad = await bsd.teamPlayers(teamId);
      await prisma.$transaction(
        squad.map((p) =>
          prisma.player.upsert({
            where: { id: p.id },
            update: profileData(p),
            create: { id: p.id, name: p.name, position: p.position, ...profileData(p) },
          }),
        ),
      );
      players += squad.length;
    } catch (e) {
      if (e instanceof BsdQuotaError) throw e;
      console.warn(`Takım ${teamId} atlandı: ${e instanceof Error ? e.message : e}`);
    }
    if ((i + 1) % 50 === 0) console.log(`${i + 1}/${teams.length} takım`);
  }
  console.log(`Profiller bitti: ${players} oyuncu`);
}

// Kariyerdeki lig, sezon ve takım adları: önce veritabanı, eksikse BSD (çalışma boyunca önbellekte)
async function nameResolver() {
  const [leagues, seasons, teams] = await Promise.all([
    prisma.league.findMany({ select: { id: true, name: true } }),
    prisma.season.findMany({ select: { id: true, name: true } }),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);
  const leagueName = new Map(leagues.map((l) => [l.id, l.name]));
  const seasonName = new Map(seasons.map((s) => [s.id, s.name]));
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const fetchedLeagues = new Set<number>();
  let allLeaguesLoaded = false;

  return {
    teamName,
    async league(id: number) {
      if (!leagueName.has(id) && !allLeaguesLoaded) {
        allLeaguesLoaded = true;
        for (const l of await bsd.leagues()) if (!leagueName.has(l.id)) leagueName.set(l.id, l.name);
      }
      return leagueName.get(id) ?? null;
    },
    async season(id: number, leagueId: number) {
      if (!seasonName.has(id) && !fetchedLeagues.has(leagueId)) {
        fetchedLeagues.add(leagueId);
        try {
          for (const s of await bsd.leagueSeasons(leagueId)) seasonName.set(s.id, s.name);
        } catch (e) {
          if (e instanceof BsdQuotaError) throw e;
        }
      }
      return seasonName.get(id) ?? null;
    },
  };
}

async function syncCareers() {
  if (careerLimit <= 0) return;
  const staleBefore = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
  const players = await prisma.$queryRaw<{ playerId: number }[]>`
    SELECT pms."playerId"
    FROM player_match_stats pms
    JOIN matches m ON m.id = pms."matchId"
    JOIN seasons se ON se.id = m."seasonId"
    JOIN players p ON p.id = pms."playerId"
    WHERE se."isCurrent" AND (p."careerSyncedAt" IS NULL OR p."careerSyncedAt" < ${staleBefore})
    GROUP BY pms."playerId"
    ORDER BY SUM(pms."minutesPlayed") DESC`;
  console.log(`Kariyer: ${players.length} oyuncu bekliyor, ${Math.min(careerLimit, players.length)} işlenecek`);
  if (dry) return;

  const names = await nameResolver();
  let ok = 0;
  let failed = 0;
  for (const [i, { playerId }] of players.slice(0, careerLimit).entries()) {
    try {
      const [career, transfers] = await Promise.all([bsd.playerCareer(playerId), bsd.playerTransfers(playerId)]);
      const list = transfers.transfers ?? [];
      for (const t of list) {
        if (t.from_team_id && t.from_team_name && !names.teamName.has(t.from_team_id)) names.teamName.set(t.from_team_id, t.from_team_name);
        if (t.to_team_id && t.to_team_name && !names.teamName.has(t.to_team_id)) names.teamName.set(t.to_team_id, t.to_team_name);
      }
      const rows = [];
      for (const s of career.seasons ?? []) {
        rows.push({
          playerId,
          seasonId: s.season_id,
          seasonName: await names.season(s.season_id, s.league_id),
          leagueId: s.league_id,
          leagueName: await names.league(s.league_id),
          teamId: s.team_id,
          teamName: names.teamName.get(s.team_id) ?? null,
          matches: s.matches ?? 0,
          minutes: s.minutes ?? 0,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          avgRating: s.avg_rating ?? null,
        });
      }
      await prisma.$transaction([
        prisma.playerCareerSeason.deleteMany({ where: { playerId } }),
        prisma.playerCareerSeason.createMany({ data: rows, skipDuplicates: true }),
        prisma.playerTransfer.deleteMany({ where: { playerId } }),
        prisma.playerTransfer.createMany({
          skipDuplicates: true,
          data: list.map((t) => ({
            id: t.id,
            playerId,
            transferDate: date(t.transfer_date)!,
            fromTeamId: t.from_team_id,
            fromTeamName: t.from_team_name,
            toTeamId: t.to_team_id,
            toTeamName: t.to_team_name,
            feeEur: big(t.fee_eur),
            feeDescription: t.fee_description || null,
            transferType: t.transfer_type,
          })),
        }),
        prisma.player.update({ where: { id: playerId }, data: { careerSyncedAt: new Date() } }),
      ]);
      ok++;
    } catch (e) {
      if (e instanceof BsdQuotaError) throw e;
      failed++;
      console.warn(`Oyuncu ${playerId} atlandı: ${e instanceof Error ? e.message : e}`);
    }
    if ((i + 1) % 100 === 0) console.log(`${i + 1} oyuncu`);
  }
  console.log(`Kariyer bitti: ${ok} başarılı, ${failed} atlandı · kalan ≈ ${players.length - ok}`);
}

runJob("player-profiles", async () => {
  if (!skipProfiles) await syncProfiles();
  await syncCareers();
});
