// src/lib/lineup.ts
// Maçın sahaya dizilecek kadrosu: ilk 11 + yedekler ve hangi kaynağa dayandığı.
// Sıra: 1) BSD'nin kadrosu (kesin ya da tahmini)  2) bitmiş maçta oynayanlar
//       3) takımın bir önceki maçının ilk 11'i (hepsi hâlâ takımda ve oynayabilir durumdaysa)
//       4) kendi tahminimiz: takımın son maçlarında en çok ilk 11 başlayanlar  5) kadro listesi (profil verisi).
// Takım liderleri ("krallar"): son 12 ayda takım formasıyla en çok gol atan, asist yapan, şut çeken... oyuncular.
import { prisma } from "./prisma";
import { inferStarter } from "./engine/starter";
import { availabilityLabel, injuryName } from "./engine/player-bio";
import { lineupScore, pickEleven, type Candidate } from "./engine/lineup-pick";
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

export interface TeamLineup {
  source: LineupSource;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  basedOn: number; // tahminin dayandığı maç sayısı (yalnızca ESTIMATED)
  previousMatch?: string; // "Fransa – Türkiye (12 Kasım)" (yalnızca PREVIOUS)
}

const EMPTY: TeamLineup = { source: "NONE", starters: [], bench: [], basedOn: 0 };
const ESTIMATE_MATCHES = 6;
const BENCH_SIZE = 9;

const PLAYER_SELECT = {
  id: true, name: true, position: true, specificPosition: true, jerseyNumber: true, availability: true, injuryType: true,
  currentTeamId: true, nationalTeamId: true, marketValueEur: true,
} as const;

type PlayerRow = {
  id: number; name: string; position: string | null; specificPosition: string | null; jerseyNumber: number | null;
  availability: string | null; injuryType: string | null; currentTeamId: number | null; nationalTeamId: number | null;
  marketValueEur: bigint | null;
};

const toPlayer = (p: PlayerRow): LineupPlayer => ({
  id: p.id,
  name: p.name,
  position: p.position,
  specificPosition: p.specificPosition,
  jerseyNumber: p.jerseyNumber,
  injury: availabilityLabel(p.availability) ? [availabilityLabel(p.availability), injuryName(p.injuryType)].filter(Boolean).join(" · ") : null,
});

// Oynaması beklenmeyenler: sakat, cezalı ("şüpheli" oynayabilir)
const isOut = (p: PlayerRow) => p.availability === "injured" || p.availability === "suspended" || p.availability === "unavailable";
// Takımdan ayrılmış oyuncu (profilinde başka kulüp yazıyor ve bu takım milli takımı da değil)
const hasLeft = (p: PlayerRow, teamId: number) => p.currentTeamId !== null && p.currentTeamId !== teamId && p.nationalTeamId !== teamId;
const named = (p: { name: string }) => !/^Oyuncu #\d+$/.test(p.name);

export async function loadTeamLineup(matchId: number, teamId: number, before: Date): Promise<TeamLineup> {
  // 1) Maçın kendi kadrosu
  const listed = await prisma.matchLineup.findMany({
    where: { matchId, teamId },
    select: { isStarter: true, lineupStatus: true, player: { select: PLAYER_SELECT } },
  });
  if (listed.some((l) => l.isStarter)) {
    return {
      source: listed[0].lineupStatus,
      starters: listed.filter((l) => l.isStarter).map((l) => toPlayer(l.player)),
      bench: listed.filter((l) => !l.isStarter).map((l) => toPlayer(l.player)),
      basedOn: 0,
    };
  }

  // 2) Bitmiş maç, kadro kaydı yok: 60+ dakika oynayanlar ilk 11 sayılır
  const played = await prisma.playerMatchStat.findMany({
    where: { matchId, teamId },
    select: { minutesPlayed: true, player: { select: PLAYER_SELECT } },
  });
  const playedStarters = played.filter((p) => inferStarter({ lineupKnown: false, listedAsStarter: false, minutesPlayed: p.minutesPlayed }));
  if (playedStarters.length) {
    return {
      source: "CONFIRMED",
      starters: playedStarters.map((p) => toPlayer(p.player)),
      bench: played.filter((p) => !playedStarters.includes(p) && p.minutesPlayed > 0).map((p) => toPlayer(p.player)),
      basedOn: 0,
    };
  }

  // Takımın oyuncu verisi olan son maçları (3 ve 4 için)
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
  if (recent.length) {
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
    const order = new Map(ids.map((id, i) => [id, i])); // 0 = en yeni maç

    const byPlayer = new Map<number, Candidate<PlayerRow>>();
    for (const s of stats) {
      if (!named(s.player) || hasLeft(s.player, teamId) || isOut(s.player)) continue;
      const started = inferStarter({
        lineupKnown: lineupKnown.has(s.matchId),
        listedAsStarter: listedStarter.has(`${s.matchId}-${s.playerId}`),
        minutesPlayed: s.minutesPlayed,
      });
      const c = byPlayer.get(s.playerId) ?? { player: s.player, position: s.player.position, starts: [], subs: [] };
      (started ? c.starts : c.subs).push(order.get(s.matchId)!);
      byPlayer.set(s.playerId, c);
    }
    // 3) Bir önceki maçın ilk 11'i: tam 11 kişi, bir kaleci var ve hiçbiri sakat/cezalı/ayrılmış değilse aynen kullanılır
    const lastStats = stats.filter((s) => s.matchId === ids[0]);
    const isLastStarter = (s: (typeof stats)[number]) =>
      inferStarter({ lineupKnown: lineupKnown.has(s.matchId), listedAsStarter: listedStarter.has(`${s.matchId}-${s.playerId}`), minutesPlayed: s.minutesPlayed });
    const lastEleven = lastStats.filter(isLastStarter);
    if (
      lastEleven.length === 11 &&
      lastEleven.some((s) => s.player.position === "G") &&
      lastEleven.every((s) => byPlayer.has(s.playerId)) // byPlayer'da olmayan: adsız, ayrılmış ya da oynayamaz
    ) {
      const inEleven = new Set(lastEleven.map((s) => s.playerId));
      const last = recent[0];
      return {
        source: "PREVIOUS",
        starters: lastEleven.map((s) => toPlayer(s.player)),
        bench: [...byPlayer.values()]
          .filter((c) => !inEleven.has(c.player.id))
          .sort((a, b) => lineupScore(b) - lineupScore(a))
          .slice(0, BENCH_SIZE)
          .map((c) => toPlayer(c.player)),
        basedOn: 1,
        previousMatch: `${last.homeTeam.name} – ${last.awayTeam.name} (${last.eventDate.toLocaleDateString("tr-TR", { timeZone: TZ, day: "numeric", month: "long" })})`,
      };
    }

    // 4) Tahmin: son maçlarda en düzenli ilk 11 başlayanlar
    const picked = pickEleven([...byPlayer.values()], BENCH_SIZE);
    if (picked) {
      return { source: "ESTIMATED", starters: picked.starters.map(toPlayer), bench: picked.bench.map(toPlayer), basedOn: recent.length };
    }
  }

  // 5) Kadro listesi: profilinde bu takım (kulübü ya da milli takımı) yazan oyuncular, piyasa değerine göre
  const squad = await prisma.player.findMany({
    where: { OR: [{ currentTeamId: teamId }, { nationalTeamId: teamId }] },
    select: PLAYER_SELECT,
    orderBy: { marketValueEur: { sort: "desc", nulls: "last" } },
    take: 60,
  });
  const fit = squad.filter((p) => named(p) && !isOut(p));
  const picked = pickEleven(
    // Sıra piyasa değeri: ilk sıradaki en "yeni maçta başlamış" gibi puanlanır
    fit.map((p, i) => ({ player: p, position: p.position, starts: [], subs: [], rank: i })),
    BENCH_SIZE,
  );
  if (picked) return { source: "SQUAD", starters: picked.starters.map(toPlayer), bench: picked.bench.map(toPlayer), basedOn: 0 };

  return EMPTY;
}

// ---------- Takım liderleri ----------

export const LEADER_STATS = [
  { key: "goals", label: "Gol kralı", unit: "gol" },
  { key: "assists", label: "Asist kralı", unit: "asist" },
  { key: "shotsTotal", label: "Şut kralı", unit: "şut" },
  { key: "shotsOnTarget", label: "İsabetli şut kralı", unit: "isabetli şut" },
  { key: "keyPasses", label: "Kilit pas kralı", unit: "kilit pas" },
  { key: "passesAccurate", label: "Pas kralı", unit: "isabetli pas" },
  { key: "dribblesWon", label: "Çalım kralı", unit: "başarılı çalım" },
  { key: "tackles", label: "Top kapma kralı", unit: "top kapma" },
  { key: "interceptions", label: "Pas arası kralı", unit: "pas arası" },
  { key: "aerialsWon", label: "Hava topu kralı", unit: "hava topu" },
  { key: "saves", label: "Kurtarış kralı", unit: "kurtarış" },
  { key: "rating", label: "En yüksek puan ortalaması", unit: "puan" },
] as const;
export type LeaderKey = (typeof LEADER_STATS)[number]["key"];

export interface LeaderBadge {
  key: LeaderKey;
  label: string;
  value: string; // "12 gol"
}

const LEADER_WINDOW_DAYS = 365;
const RATING_MIN_MATCHES = 3;

// Verilen oyuncular arasında her istatistiğin lideri: oyuncu id → rozetleri
export async function loadTeamLeaders(teamId: number, playerIds: number[], before: Date): Promise<Record<number, LeaderBadge[]>> {
  if (!playerIds.length) return {};
  const from = new Date(before.getTime() - LEADER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.playerMatchStat.groupBy({
    by: ["playerId"],
    where: { teamId, playerId: { in: playerIds }, minutesPlayed: { gt: 0 }, match: { status: "finished", eventDate: { gte: from, lt: before } } },
    _sum: {
      goals: true, assists: true, shotsTotal: true, shotsOnTarget: true, keyPasses: true, passesAccurate: true, dribblesWon: true,
      tackles: true, interceptions: true, aerialsWon: true, saves: true,
    },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const out: Record<number, LeaderBadge[]> = {};
  for (const stat of LEADER_STATS) {
    let best: { playerId: number; value: number } | null = null;
    for (const r of rows) {
      const value =
        stat.key === "rating" ? (r._count.rating >= RATING_MIN_MATCHES ? (r._avg.rating ?? 0) : 0) : (r._sum[stat.key] ?? 0);
      if (value > 0 && (!best || value > best.value)) best = { playerId: r.playerId, value };
    }
    if (!best) continue;
    const text = stat.key === "rating" ? best.value.toFixed(2).replace(".", ",") : String(best.value);
    (out[best.playerId] ??= []).push({ key: stat.key, label: stat.label, value: `${text} ${stat.unit}` });
  }
  return out;
}
