// src/lib/analysis.ts
// Bir maçın tüm trend oranlarını, kanıtlarını ve önerilerini hesaplar.
// Veritabanından okur, hesaplamayı motora (src/lib/engine) bırakır.
import { prisma } from "./prisma";
import { availabilityLabel, injuryName } from "./engine/player-bio";
import { cached } from "./ttl-cache";
import { DEFAULT_SAMPLE, type SampleSettings } from "./app-settings";
import { trendsForLeague } from "./trend-config";
import {
  teamRuleFor, playerAtLeast, isPlayerStatKey,
  type PlayerStatKey, type PlayerLine, type MatchScore, type Outcome,
} from "./engine/trends";
import { computeRate } from "./engine/rate";
import { inferStarter } from "./engine/starter";
import { ladderTops } from "./engine/ladder";
import { decidingRates, isTrendSide, type TrendSide } from "./engine/side";
import { canonicalLeagueId } from "./engine/leagues";
import { matchTotals } from "./engine/totals";
import {
  selectTeamSample, selectPlayerSample,
  type TeamHistoryMatch, type PlayerHistoryLine, type MatchContext, type SampleOptions, type Sample,
} from "./engine/selection";

export interface EvidenceRow {
  matchId: number;
  eventDate: Date;
  label: string;
  outcome: Outcome;
  value?: number | null;
}

export interface RateSummary {
  hits: number;
  total: number;
  rate: number | null;
  lowSample: boolean;
  evidence: EvidenceRow[];
}

export interface TeamTrendResult {
  code: string;
  name: string;
  threshold: number;
  statKey: string | null; // merdivenli trendlerde istatistik (homeGoals, totalCorners...)
  line: number | null;
  side: TrendSide | null; // boş = maç trendi (iki takım birlikte), HOME/AWAY = yalnızca o takımın karnesi
  home: RateSummary;
  away: RateSummary;
  passes: boolean; // karar veren karne(ler) eşiği geçti mi
  recommended: boolean; // merdivende en yüksek geçen çizgi mi
}

export interface PlayerTrendResult {
  code: string;
  name: string;
  threshold: number;
  statKey: PlayerStatKey;
  line: number;
  playerId: number;
  playerName: string;
  teamId: number;
  summary: RateSummary;
  // Yalnızca bu maçtaki sahası (ev sahibiyse iç saha, deplasmansa dış saha) son ilk 11 maçları. Bilgi amaçlı (sürpriz sayfası).
  venue: { hits: number; total: number; rate: number | null; lowSample: boolean; isHome: boolean };
  passes: boolean; // eşiği geçti mi
  recommended: boolean; // merdivende en yüksek geçen çizgi mi
}

// Oyuncu kartındaki zaman çizelgesi: karneye sayılan bir ilk 11 maçı
export interface PlayerGame {
  matchId: number;
  date: number; // zaman damgası (istemci bileşenine düz değer olarak geçsin)
  isHome: boolean;
  teamId: number; // oyuncunun o maçtaki takımı (transferde değişir)
  teamName: string;
  opponentId: number;
  opponentName: string;
  score: string; // takımın gözünden "2-1"
  minutes: number;
  stats: PlayerLine;
}

export interface PlayerInfo {
  position: string | null; // G, D, M, F
  injury: string | null; // sakat / şüpheli / cezalı (BSD profili), uygunsa null
  games: PlayerGame[]; // en yeniden eskiye
}

// Oyuncu listesinin hangi ilk 11'e dayandığı
export type LineupSource = "CONFIRMED" | "PREDICTED" | "LAST_MATCH" | "NONE";

export interface MatchAnalysis {
  matchId: number;
  leagueId: number;
  leagueName: string;
  eventDate: Date;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  playerStatsEnabled: boolean;
  lineups: { home: LineupSource; away: LineupSource };
  teamTrends: TeamTrendResult[];
  playerTrends: PlayerTrendResult[];
  players: Record<number, PlayerInfo>; // oyuncu kartları için maç maç veri
}

type TeamRow = TeamHistoryMatch & {
  homeName: string;
  awayName: string;
  totalCorners: number | null;
  totalCards: number | null;
};
type PlayerRow = PlayerHistoryLine & {
  label: string;
  isHome: boolean;
  teamId: number;
  teamName: string;
  opponentId: number;
  opponentName: string;
  score: string;
  minutes: number;
};

const passes = (s: RateSummary, threshold: number) => !s.lowSample && s.rate !== null && s.rate >= threshold;

// Son 2 sezonun başlangıcı: hedef ligin, maç tarihinden önce başlamış son iki sezonundan eskisi
export async function windowStartFor(target: MatchContext): Promise<Date> {
  const seasons = await prisma.season.findMany({
    where: { leagueId: target.leagueId, startDate: { lte: target.eventDate } },
    orderBy: { startDate: "desc" },
    take: 2,
    select: { startDate: true },
  });
  return seasons.at(-1)?.startDate ?? new Date(target.eventDate.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
}

export async function teamHistory(teamId: number, from: Date, to: Date): Promise<TeamRow[]> {
  const rows = await prisma.match.findMany({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }], status: "finished", eventDate: { gte: from, lt: to } },
    include: {
      league: { select: { competitionType: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      teamStats: { where: { period: "FULL" }, select: { teamId: true, corners: true, yellowCards: true, redCards: true } },
      // İkinci sarıdan atılanlar: BSD bunlara 2 sarı + 1 kırmızı yazar (kart sayımı için)
      playerStats: { where: { yellowCards: { gte: 2 }, redCards: { gt: 0 } }, select: { teamId: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    eventDate: r.eventDate,
    status: r.status,
    leagueId: canonicalLeagueId(r.leagueId),
    competitionType: r.league.competitionType,
    homeTeamId: r.homeTeamId,
    awayTeamId: r.awayTeamId,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    homeScoreHt: r.homeScoreHt,
    awayScoreHt: r.awayScoreHt,
    homeName: r.homeTeam.name,
    awayName: r.awayTeam.name,
    ...matchTotals(
      r.teamStats.map((t) => ({
        ...t,
        secondYellows: r.playerStats.filter((p) => p.teamId === t.teamId).length,
      })),
    ),
  }));
}

function summarizeTeam(sample: Sample<TeamRow>, rule: (m: MatchScore) => Outcome, rows: Map<number, TeamRow>): RateSummary {
  // Kural, takımın bakış açısına çevrilmiş maça uygulanır (genel formda deplasman maçları çevrilir); etiket gerçek skoru gösterir
  const r = computeRate(sample.items, (item) => rule(item));
  return {
    hits: r.hits,
    total: r.total,
    rate: r.rate,
    lowSample: sample.lowSample,
    evidence: r.evidence.map(({ item, outcome }) => {
      const row = rows.get(item.id)!;
      const extras = [
        row.totalCorners !== null ? `${row.totalCorners} korner` : null,
        row.totalCards !== null ? `${row.totalCards} kart` : null,
      ].filter(Boolean);
      return {
        matchId: item.id,
        eventDate: item.eventDate,
        label:
          `${row.homeName} ${row.homeScore}-${row.awayScore} ${row.awayName} (İY ${row.homeScoreHt}-${row.awayScoreHt})` +
          (extras.length ? ` · ${extras.join(" · ")}` : ""),
        outcome,
      };
    }),
  };
}

// Bitmiş bir maçın ilk 11'i: kadro biliniyorsa kadrodan, bilinmiyorsa (B9) 60+ dakika oynayanlardan
async function startersOfMatch(matchId: number, teamId: number): Promise<number[]> {
  const listed = await prisma.matchLineup.findMany({
    where: { matchId, teamId, isStarter: true },
    select: { playerId: true },
  });
  if (listed.length) return listed.map((l) => l.playerId);

  const played = await prisma.playerMatchStat.findMany({
    where: { matchId, teamId },
    select: { playerId: true, minutesPlayed: true },
  });
  return played
    .filter((p) => inferStarter({ lineupKnown: false, listedAsStarter: false, minutesPlayed: p.minutesPlayed }))
    .map((p) => p.playerId);
}

// Analiz edilecek oyuncular ve kaynağı:
// 1) maçın kendi kadrosu (kesin veya tahmini), 2) bitmiş maçta oynayanlar, 3) takımın son maçındaki ilk 11
export async function expectedStarters(matchId: number, teamId: number, before: Date): Promise<{ ids: number[]; source: LineupSource }> {
  const listed = await prisma.matchLineup.findMany({
    where: { matchId, teamId, isStarter: true },
    select: { playerId: true, lineupStatus: true },
  });
  if (listed.length) return { ids: listed.map((l) => l.playerId), source: listed[0].lineupStatus };

  const played = await startersOfMatch(matchId, teamId);
  if (played.length) return { ids: played, source: "CONFIRMED" };

  const last = await prisma.match.findFirst({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      status: "finished",
      eventDate: { lt: before },
      playerStats: { some: { teamId } },
    },
    orderBy: { eventDate: "desc" },
    select: { id: true },
  });
  if (!last) return { ids: [], source: "NONE" };
  return { ids: await startersOfMatch(last.id, teamId), source: "LAST_MATCH" };
}

export async function playerHistory(playerIds: number[], from: Date, to: Date): Promise<Map<number, PlayerRow[]>> {
  const stats = await prisma.playerMatchStat.findMany({
    where: { playerId: { in: playerIds }, match: { status: "finished", eventDate: { gte: from, lt: to } } },
    include: {
      match: {
        include: {
          league: { select: { competitionType: true } },
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      },
    },
  });
  const matchIds = [...new Set(stats.map((s) => s.matchId))];

  // Hangi maçta hangi takımın kadrosu biliniyor (B9: arşiv maçlarında kadro id'siz gelir, kaydedilemez)
  const knownLineups = await prisma.matchLineup.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, teamId: true },
    distinct: ["matchId", "teamId"],
  });
  const lineupKnown = new Set(knownLineups.map((l) => `${l.matchId}-${l.teamId}`));

  const starterRows = await prisma.matchLineup.findMany({
    where: { playerId: { in: playerIds }, matchId: { in: matchIds }, isStarter: true },
    select: { matchId: true, playerId: true },
  });
  const listedStarters = new Set(starterRows.map((l) => `${l.matchId}-${l.playerId}`));

  const byPlayer = new Map<number, PlayerRow[]>();
  for (const s of stats) {
    const m = s.match;
    const row: PlayerRow = {
      matchId: s.matchId,
      eventDate: m.eventDate,
      status: m.status,
      isHome: s.teamId === m.homeTeamId, // oyuncunun takımı o maçta ev sahibi miydi
      teamId: s.teamId,
      teamName: s.teamId === m.homeTeamId ? m.homeTeam.name : m.awayTeam.name,
      opponentId: s.teamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId,
      opponentName: s.teamId === m.homeTeamId ? m.awayTeam.name : m.homeTeam.name,
      score: s.teamId === m.homeTeamId ? `${m.homeScore}-${m.awayScore}` : `${m.awayScore}-${m.homeScore}`,
      minutes: s.minutesPlayed,
      leagueId: canonicalLeagueId(m.leagueId),
      competitionType: m.league.competitionType,
      isStarter: inferStarter({
        lineupKnown: lineupKnown.has(`${s.matchId}-${s.teamId}`),
        listedAsStarter: listedStarters.has(`${s.matchId}-${s.playerId}`),
        minutesPlayed: s.minutesPlayed,
      }),
      goals: s.goals,
      assists: s.assists,
      shotsOnTarget: s.shotsOnTarget,
      shotsTotal: s.shotsTotal,
      tackles: s.tackles,
      fouls: s.fouls,
      yellowCards: s.yellowCards,
      label:
        `${m.homeTeam.name} ${m.homeScore}-${m.awayScore} ${m.awayTeam.name} · ` +
        `${s.goals}G ${s.assists}A · şut ${s.shotsOnTarget}/${s.shotsTotal} · ${s.tackles} top kapma · ${s.fouls} faul` +
        (s.yellowCards ? " · sarı kart" : ""),
    };
    if (!byPlayer.has(s.playerId)) byPlayer.set(s.playerId, []);
    byPlayer.get(s.playerId)!.push(row);
  }
  return byPlayer;
}

// Sayfalar için önbellekli giriş: aynı maç 10 dakika içinde tekrar hesaplanmaz.
// (Veri günde birkaç kez değişir; eşik veya örnek ayarı değişince Ayarlar önbelleği temizler.)
// Backtest gibi seçenekli çağrılar önbelleğe girmez.
export const ANALYSIS_TTL_MS = 10 * 60 * 1000;

// Verilmeyen alanlar Ayarlar'dan gelir (son maç sayısı, takım / oyuncu form türü). Backtest deneyleri için.
export interface AnalysisOptions {
  maxMatches?: number;
  teamMode?: SampleSettings["teamMode"];
  playerMode?: SampleSettings["playerMode"];
}

export function analyzeMatch(matchId: number, options: AnalysisOptions = {}): Promise<MatchAnalysis | null> {
  if (options.maxMatches || options.teamMode || options.playerMode) return computeAnalysis(matchId, options);
  return cached(`analysis:${matchId}`, ANALYSIS_TTL_MS, () => computeAnalysis(matchId, options));
}

// Sayfada seçilen form ayarıyla (sürpriz sayfası: son 10/15/20 · genel ve ev/dep birlikte) önbellekli analiz.
// Anahtar seçenekleri içerir; Ayarlar "analysis:" önekiyle hepsini temizler.
export function analyzeMatchWith(matchId: number, options: Required<AnalysisOptions>): Promise<MatchAnalysis | null> {
  const key = `analysis:${matchId}:${options.maxMatches}:${options.teamMode}:${options.playerMode}`;
  return cached(key, ANALYSIS_TTL_MS, () => computeAnalysis(matchId, options));
}

async function computeAnalysis(matchId: number, options: AnalysisOptions = {}): Promise<MatchAnalysis | null> {
  if (!Number.isInteger(matchId)) return null;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { league: true, homeTeam: true, awayTeam: true },
  });
  if (!match) return null;

  const target: MatchContext = {
    eventDate: match.eventDate,
    leagueId: canonicalLeagueId(match.leagueId),
    competitionType: match.league.competitionType,
  };
  const settings = DEFAULT_SAMPLE;
  const teamMode = options.teamMode ?? settings.teamMode;
  const playerMode = options.playerMode ?? settings.playerMode;
  const opts: SampleOptions = {
    target,
    windowStart: await windowStartFor(target),
    maxMatches: options.maxMatches ?? settings.size,
    allVenues: teamMode === "all",
  };
  // Aktif trendler; lig bazında kapatılanlar bu maçta hesaplanmaz
  const trends = trendsForLeague(match.leagueId);

  // Takım trendleri
  const [homeHistory, awayHistory] = await Promise.all([
    teamHistory(match.homeTeamId, opts.windowStart, match.eventDate),
    teamHistory(match.awayTeamId, opts.windowStart, match.eventDate),
  ]);
  const rows = new Map([...homeHistory, ...awayHistory].map((r) => [r.id, r]));
  const homeSample = selectTeamSample(homeHistory, match.homeTeamId, "home", opts);
  const awaySample = selectTeamSample(awayHistory, match.awayTeamId, "away", opts);

  const teamTrends: TeamTrendResult[] = [];
  for (const mk of trends.filter((m) => m.scope === "TEAM")) {
    const rule = teamRuleFor(mk);
    if (!rule) continue; // tanımsız trend
    const home = summarizeTeam(homeSample, rule, rows);
    const away = summarizeTeam(awaySample, rule, rows);
    const side = isTrendSide(mk.side) ? mk.side : null;
    teamTrends.push({
      code: mk.code,
      name: mk.name,
      threshold: mk.threshold,
      statKey: mk.statKey,
      line: mk.line,
      side,
      home,
      away,
      passes: decidingRates(side, home, away).every((s) => passes(s, mk.threshold)),
      recommended: false,
    });
  }
  // Merdiven: aynı istatistikte en yüksek geçen çizgi; istatistiği olmayan trendler (iki takım da gol, 3+ gol) kendi başına
  const teamTops = ladderTops(teamTrends.map((t) => ({ statKey: t.statKey ?? t.code, line: t.line ?? 0, passes: t.passes })));
  teamTrends.forEach((t, i) => (t.recommended = teamTops.has(i)));

  // Oyuncu trendleri: yalnızca oyuncu verisi açık liglerde
  const playerTrends: PlayerTrendResult[] = [];
  const lineups: MatchAnalysis["lineups"] = { home: "NONE", away: "NONE" };
  const playerInfo: Record<number, PlayerInfo> = {};
  if (match.league.playerStatsEnabled) {
    const playerDefs = trends.filter((mk) => mk.scope === "PLAYER" && isPlayerStatKey(mk.statKey) && mk.line !== null);

    const [homeXI, awayXI] = await Promise.all([
      expectedStarters(match.id, match.homeTeamId, match.eventDate),
      expectedStarters(match.id, match.awayTeamId, match.eventDate),
    ]);
    lineups.home = homeXI.source;
    lineups.away = awayXI.source;
    const playerIds = [...homeXI.ids, ...awayXI.ids];
    const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
    const history = await playerHistory(playerIds, opts.windowStart, match.eventDate);

    for (const p of players) {
      const lines = history.get(p.id) ?? [];
      const labels = new Map(lines.map((l) => [l.matchId, l.label]));
      const teamId = homeXI.ids.includes(p.id) ? match.homeTeamId : match.awayTeamId;
      const playsHome = teamId === match.homeTeamId;
      const venueSample = selectPlayerSample(lines.filter((l) => l.isHome === playsHome), opts);
      // Karar veren karne: genel formda tüm ilk 11 maçları, saha modunda yalnızca bu maçtaki sahası
      const sample = playerMode === "all" ? selectPlayerSample(lines, opts) : venueSample;

      // Zaman çizelgesi: karneye sayılan maçlar (en yeniden eskiye)
      const toGame = (l: PlayerRow): PlayerGame => ({
        matchId: l.matchId,
        date: l.eventDate.getTime(),
        isHome: l.isHome,
        teamId: l.teamId,
        teamName: l.teamName,
        opponentId: l.opponentId,
        opponentName: l.opponentName,
        score: l.score,
        minutes: l.minutes,
        stats: {
          goals: l.goals, assists: l.assists, shotsOnTarget: l.shotsOnTarget, shotsTotal: l.shotsTotal,
          tackles: l.tackles, fouls: l.fouls, yellowCards: l.yellowCards,
        } satisfies PlayerLine,
      });
      playerInfo[p.id] = {
        position: p.position,
        injury: availabilityLabel(p.availability)
          ? [availabilityLabel(p.availability), injuryName(p.injuryType)].filter(Boolean).join(" · ")
          : null,
        games: sample.items.map(toGame),
      };

      const results: PlayerTrendResult[] = playerDefs.map((mk) => {
        const statKey = mk.statKey as PlayerStatKey;
        const line = mk.line!;
        const r = computeRate(sample.items, playerAtLeast(statKey, line));
        const v = computeRate(venueSample.items, playerAtLeast(statKey, line));
        const summary: RateSummary = {
          hits: r.hits,
          total: r.total,
          rate: r.rate,
          lowSample: sample.lowSample,
          evidence: r.evidence.map(({ item, outcome }) => ({
            matchId: item.matchId,
            eventDate: item.eventDate,
            label: labels.get(item.matchId) ?? "",
            outcome,
            value: item[statKey] ?? null,
          })),
        };
        return {
          code: mk.code,
          name: mk.name,
          threshold: mk.threshold,
          statKey,
          line,
          playerId: p.id,
          playerName: p.name,
          teamId,
          summary,
          venue: { hits: v.hits, total: v.total, rate: v.rate, lowSample: venueSample.lowSample, isHome: playsHome },
          passes: passes(summary, mk.threshold),
          recommended: false,
        };
      });

      // Merdiven: her istatistikte yalnızca eşiği geçen en yüksek çizgi öneri olur
      const tops = ladderTops(results);
      results.forEach((r, i) => (r.recommended = tops.has(i)));
      playerTrends.push(...results);
    }
  }

  return {
    matchId: match.id,
    leagueId: match.leagueId,
    leagueName: match.league.name,
    eventDate: match.eventDate,
    homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name },
    awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name },
    playerStatsEnabled: match.league.playerStatsEnabled,
    lineups,
    teamTrends,
    playerTrends,
    players: playerInfo,
  };
}