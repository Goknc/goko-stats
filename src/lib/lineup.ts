// src/lib/lineup.ts
// Maçın sahaya dizilecek kadrosu: ilk 11 + yedekler ve hangi kaynağa dayandığı.
// Sıra: 1) kesin kadro  2) BSD'nin tahmini kadrosu (oynayamayacaklar ayıklanıp yerleri doldurularak)
//       3) bitmiş maçta oynayanlar  4) takımın bir önceki maçının ilk 11'i (hepsi oynayabilir durumdaysa)
//       5) kendi tahminimiz: takımın son maçlarında en çok ilk 11 başlayanlar  6) kadro listesi (profil verisi).
// Oynayamaz sayılanlar: sakat / cezalı (BSD maç öncesi listesi ya da profil), takımdan ayrılanlar ve milli takımda
// o arada kadroya çağrılmayanlar (aynı milli maç arasındaki önceki maçların kadrosunda olmayanlar).
import { prisma } from "./prisma";
import { inferStarter } from "./engine/starter";
import { availabilityLabel, injuryName } from "./engine/player-bio";
import { lineupScore, pickEleven, repairEleven, type Candidate } from "./engine/lineup-pick";
import { isNationalTeamLeague } from "./engine/leagues";
import { TZ } from "./dates";

export type LineupSource = "CONFIRMED" | "PREDICTED" | "PREVIOUS" | "ESTIMATED" | "SQUAD" | "NONE";

export interface LineupPlayer {
  id: number;
  name: string;
  position: string | null; // G, D, M, F
  specificPosition: string | null; // ST, LW, CB...
  jerseyNumber: number | null;
  injury: string | null; // "Sakat · Diz sakatlığı"
}

export interface MissingPlayer {
  id: number;
  name: string;
  reason: string; // "Sakat · Hamstring Injury", "Cezalı"
}

export interface TeamLineup {
  source: LineupSource;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  basedOn: number; // tahminin dayandığı maç sayısı (yalnızca ESTIMATED)
  previousMatch?: string; // "Fransa – Türkiye (12 Kasım)" (yalnızca PREVIOUS)
  replaced: { out: string; in: string; reason: string }[]; // BSD tahmininden çıkarılıp yerine konanlar
  missing: MissingPlayer[]; // maç öncesi sakat / cezalı listesi
}

const ESTIMATE_MATCHES = 6;
const BENCH_SIZE = 9;
const MAX_REPLACE = 4; // BSD tahmininde bundan fazla oyuncu oynayamıyorsa tahmin bırakılır
const CALL_UP_DAYS = 12; // milli maç arası: bu süre içindeki maç kadroları "kadroya çağrılanlar" sayılır
const MIN_CALL_UP = 15; // daha az oyuncu varsa kadro bilinmiyor sayılır

const PLAYER_SELECT = {
  id: true, name: true, position: true, specificPosition: true, jerseyNumber: true, availability: true, injuryType: true,
  currentTeamId: true, nationalTeamId: true, marketValueEur: true,
} as const;

type PlayerRow = {
  id: number; name: string; position: string | null; specificPosition: string | null; jerseyNumber: number | null;
  availability: string | null; injuryType: string | null; currentTeamId: number | null; nationalTeamId: number | null;
  marketValueEur: bigint | null;
};

const STATUS_TR: Record<string, string> = { injured: "Sakat", suspended: "Cezalı", doubtful: "Şüpheli", unavailable: "Oynamayacak" };
const named = (p: { name: string }) => !/^Oyuncu #\d+$/.test(p.name);
// Profilde oynaması beklenmeyenler: sakat, cezalı ("şüpheli" oynayabilir)
const profileOut = (p: PlayerRow) => p.availability === "injured" || p.availability === "suspended" || p.availability === "unavailable";
// Takımdan ayrılmış oyuncu (profilinde başka kulüp yazıyor ve bu takım milli takımı da değil)
const hasLeft = (p: PlayerRow, teamId: number) => p.currentTeamId !== null && p.currentTeamId !== teamId && p.nationalTeamId !== teamId;

interface Context {
  teamId: number;
  national: boolean;
  callUps: Set<number> | null; // milli takımda bu aradaki maç kadroları (yoksa null: kural uygulanmaz)
  missing: Map<number, MissingPlayer>; // BSD'nin maç öncesi sakat / cezalı listesi
  jerseys: Map<number, number>; // takımın kesin kadrolarındaki son forma numarası
}

// Oyuncu bu maçta oynayabilir mi; oynayamıyorsa nedeni
function whyOut(p: PlayerRow, ctx: Context): string | null {
  const listed = ctx.missing.get(p.id);
  if (listed) return listed.reason;
  if (profileOut(p)) return [availabilityLabel(p.availability), injuryName(p.injuryType)].filter(Boolean).join(" · ") || "Oynamayacak";
  if (!ctx.national && hasLeft(p, ctx.teamId)) return "Takımdan ayrıldı";
  if (ctx.callUps && !ctx.callUps.has(p.id)) return "Kadroya çağrılmadı";
  return null;
}
const eligible = (p: PlayerRow, ctx: Context) => named(p) && whyOut(p, ctx) === null;

function toPlayer(p: PlayerRow, ctx: Context, matchJersey?: number | null): LineupPlayer {
  // Forma numarası: takımın kesin kadrolarındaki son numara; yoksa (kulüpte) maç kadrosundaki ya da profildeki numara.
  // Milli takımda tahmini kadro ve profil kulüp numarasını verdiği için yalnızca kesin kadrolara bakılır.
  const clubNumber = ctx.national
    ? null
    : (matchJersey ?? (p.currentTeamId === ctx.teamId || p.currentTeamId === null ? p.jerseyNumber : null));
  const label = availabilityLabel(p.availability);
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    specificPosition: p.specificPosition,
    jerseyNumber: ctx.jerseys.get(p.id) ?? clubNumber ?? null,
    injury: label ? [label, injuryName(p.injuryType)].filter(Boolean).join(" · ") : null,
  };
}

async function loadContext(matchId: number, teamId: number, before: Date, leagueId: number): Promise<Context> {
  const national = isNationalTeamLeague(leagueId);
  const [unavailable, confirmed, callUpRows] = await Promise.all([
    prisma.matchUnavailable.findMany({ where: { matchId, teamId }, select: { playerId: true, name: true, status: true, reason: true } }),
    // Son kesin kadrolardaki forma numaraları (en yeni maç önce, ilk görülen kazanır)
    prisma.matchLineup.findMany({
      where: { teamId, lineupStatus: "CONFIRMED", jerseyNumber: { not: null }, match: { eventDate: { lte: before } } },
      orderBy: { match: { eventDate: "desc" } },
      take: 300,
      select: { playerId: true, jerseyNumber: true },
    }),
    national
      ? prisma.matchLineup.findMany({
          where: {
            teamId,
            matchId: { not: matchId },
            match: { eventDate: { gte: new Date(before.getTime() - CALL_UP_DAYS * 24 * 60 * 60 * 1000), lt: before } },
          },
          select: { playerId: true },
        })
      : Promise.resolve([]),
  ]);
  const jerseys = new Map<number, number>();
  for (const r of confirmed) if (!jerseys.has(r.playerId)) jerseys.set(r.playerId, r.jerseyNumber!);
  const callUps = new Set(callUpRows.map((r) => r.playerId));
  const reasonOf = (status: string | null, reason: string | null) =>
    [STATUS_TR[status ?? ""] ?? "Oynamayacak", reason && !/suspension/i.test(reason) ? reason : null].filter(Boolean).join(" · ");
  return {
    teamId,
    national,
    callUps: callUps.size >= MIN_CALL_UP ? callUps : null,
    missing: new Map(unavailable.map((u) => [u.playerId, { id: u.playerId, name: u.name, reason: reasonOf(u.status, u.reason) }])),
    jerseys,
  };
}

// Takımın oyuncu verisi olan son maçlarından ilk 11 adayları (yalnızca oynayabilecek olanlar)
async function recentCandidates(teamId: number, before: Date, ctx: Context) {
  const recent = await prisma.match.findMany({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      status: "finished",
      eventDate: { lt: before },
      playerStats: { some: { teamId } },
    },
    orderBy: { eventDate: "desc" },
    take: ESTIMATE_MATCHES,
    select: { id: true, eventDate: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });
  const ids = recent.map((m) => m.id);
  const [stats, lineups] = await Promise.all([
    prisma.playerMatchStat.findMany({
      where: { matchId: { in: ids }, teamId },
      select: { matchId: true, playerId: true, minutesPlayed: true, player: { select: PLAYER_SELECT } },
    }),
    prisma.matchLineup.findMany({ where: { matchId: { in: ids }, teamId }, select: { matchId: true, playerId: true, isStarter: true } }),
  ]);
  const lineupKnown = new Set(lineups.map((l) => l.matchId));
  const listedStarter = new Set(lineups.filter((l) => l.isStarter).map((l) => `${l.matchId}-${l.playerId}`));
  const started = (s: (typeof stats)[number]) =>
    inferStarter({ lineupKnown: lineupKnown.has(s.matchId), listedAsStarter: listedStarter.has(`${s.matchId}-${s.playerId}`), minutesPlayed: s.minutesPlayed });
  const order = new Map(ids.map((id, i) => [id, i])); // 0 = en yeni maç

  const byPlayer = new Map<number, Candidate<PlayerRow>>();
  for (const s of stats) {
    if (!eligible(s.player, ctx)) continue;
    const c = byPlayer.get(s.playerId) ?? { player: s.player, position: s.player.position, starts: [], subs: [] };
    (started(s) ? c.starts : c.subs).push(order.get(s.matchId)!);
    byPlayer.set(s.playerId, c);
  }
  const lastEleven = stats.filter((s) => s.matchId === ids[0] && started(s));
  return { recent, byPlayer, lastEleven };
}

const benchFrom = (pool: Candidate<PlayerRow>[], used: Set<number>) =>
  pool
    .filter((c) => !used.has(c.player.id))
    .sort((a, b) => lineupScore(b) - lineupScore(a))
    .slice(0, BENCH_SIZE)
    .map((c) => c.player);

export async function loadTeamLineup(matchId: number, teamId: number, before: Date, leagueId: number): Promise<TeamLineup> {
  const ctx = await loadContext(matchId, teamId, before, leagueId);
  const base = { basedOn: 0, replaced: [], missing: [...ctx.missing.values()] };
  const out = (p: PlayerRow, jersey?: number | null) => toPlayer(p, ctx, jersey);

  // 1) Maçın kendi kadrosu: kesinse aynen
  const listed = await prisma.matchLineup.findMany({
    where: { matchId, teamId },
    select: { isStarter: true, lineupStatus: true, jerseyNumber: true, player: { select: PLAYER_SELECT } },
  });
  const listedStarters = listed.filter((l) => l.isStarter);
  const jerseyOf = new Map(listed.map((l) => [l.player.id, l.jerseyNumber]));
  if (listedStarters.length && listed[0].lineupStatus === "CONFIRMED") {
    return {
      ...base,
      source: "CONFIRMED",
      starters: listedStarters.map((l) => out(l.player, l.jerseyNumber)),
      bench: listed.filter((l) => !l.isStarter).map((l) => out(l.player, l.jerseyNumber)),
    };
  }

  // 3) Bitmiş maç, kadro kaydı yok: 60+ dakika oynayanlar ilk 11 sayılır
  if (!listedStarters.length) {
    const played = await prisma.playerMatchStat.findMany({
      where: { matchId, teamId },
      select: { minutesPlayed: true, player: { select: PLAYER_SELECT } },
    });
    const playedStarters = played.filter((p) => inferStarter({ lineupKnown: false, listedAsStarter: false, minutesPlayed: p.minutesPlayed }));
    if (playedStarters.length) {
      return {
        ...base,
        source: "CONFIRMED",
        starters: playedStarters.map((p) => out(p.player)),
        bench: played.filter((p) => !playedStarters.includes(p) && p.minutesPlayed > 0).map((p) => out(p.player)),
      };
    }
  }

  const { recent, byPlayer, lastEleven } = await recentCandidates(teamId, before, ctx);

  // 2) BSD'nin tahmini kadrosu: oynayamayacaklar çıkarılır, yerlerine aynı hattan en düzenli oyuncu girer
  if (listedStarters.length) {
    const benchPool: Candidate<PlayerRow>[] = listed
      .filter((l) => !l.isStarter && !byPlayer.has(l.player.id))
      .map((l, i) => ({ player: l.player, position: l.player.position, starts: [], subs: [], rank: 50 + i }));
    const pool = [...byPlayer.values(), ...benchPool];
    const repaired = repairEleven(listedStarters.map((l) => l.player), (p) => eligible(p, ctx), pool, MAX_REPLACE);
    if (repaired) {
      const used = new Set(repaired.starters.map((p) => p.id));
      const bsdBench = listed.filter((l) => !l.isStarter && !used.has(l.player.id) && eligible(l.player, ctx)).map((l) => l.player);
      return {
        ...base,
        source: "PREDICTED",
        starters: repaired.starters.map((p) => out(p, jerseyOf.get(p.id))),
        bench: (bsdBench.length ? bsdBench : benchFrom(pool, used)).map((p) => out(p, jerseyOf.get(p.id))),
        replaced: repaired.replaced.map((r) => ({ out: r.out.name, in: r.in.name, reason: whyOut(r.out, ctx) ?? "" })),
      };
    }
  }

  if (recent.length) {
    // 4) Bir önceki maçın ilk 11'i: tam 11 kişi, bir kaleci var ve hepsi oynayabilir durumdaysa aynen kullanılır
    if (lastEleven.length === 11 && lastEleven.some((s) => s.player.position === "G") && lastEleven.every((s) => byPlayer.has(s.playerId))) {
      const inEleven = new Set(lastEleven.map((s) => s.playerId));
      const last = recent[0];
      return {
        ...base,
        source: "PREVIOUS",
        starters: lastEleven.map((s) => out(s.player)),
        bench: benchFrom([...byPlayer.values()], inEleven).map((p) => out(p)),
        basedOn: 1,
        previousMatch: `${last.homeTeam.name} – ${last.awayTeam.name} (${last.eventDate.toLocaleDateString("tr-TR", { timeZone: TZ, day: "numeric", month: "long" })})`,
      };
    }

    // 5) Tahmin: son maçlarda en düzenli ilk 11 başlayanlar
    const picked = pickEleven([...byPlayer.values()], BENCH_SIZE);
    if (picked) {
      return {
        ...base,
        source: "ESTIMATED",
        starters: picked.starters.map((p) => out(p)),
        bench: picked.bench.map((p) => out(p)),
        basedOn: recent.length,
      };
    }
  }

  // 6) Kadro listesi: profilinde bu takım (kulübü ya da milli takımı) yazan oyuncular, piyasa değerine göre
  const squad = await prisma.player.findMany({
    where: { OR: [{ currentTeamId: teamId }, { nationalTeamId: teamId }] },
    select: PLAYER_SELECT,
    orderBy: { marketValueEur: { sort: "desc", nulls: "last" } },
    take: 60,
  });
  const picked = pickEleven(
    // Sıra piyasa değeri: ilk sıradaki en "yeni maçta başlamış" gibi puanlanır
    squad.filter((p) => eligible(p, ctx)).map((p, i) => ({ player: p, position: p.position, starts: [], subs: [], rank: i })),
    BENCH_SIZE,
  );
  if (picked) return { ...base, source: "SQUAD", starters: picked.starters.map((p) => out(p)), bench: picked.bench.map((p) => out(p)) };

  return { ...base, source: "NONE", starters: [], bench: [] };
}
