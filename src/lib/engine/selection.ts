// src/lib/engine/selection.ts
// "Son N maç" seçimi (N ve saha modu Ayarlar'dan). Kurallar: Gereksinim Dokümanı > Maç seçim kuralları.
import type { MatchScore, PlayerLine } from "./trends";

export type CompetitionType = "LEAGUE" | "EUROPE" | "CUP" | "FRIENDLY";

export interface MatchContext {
  eventDate: Date;
  leagueId: number;
  competitionType: CompetitionType;
}

export interface TeamHistoryMatch extends MatchScore, MatchContext {
  id: number;
  status: string;
  homeTeamId: number;
  awayTeamId: number;
}

export interface PlayerHistoryLine extends PlayerLine, MatchContext {
  matchId: number;
  status: string;
  isStarter: boolean;
}

export interface SampleOptions {
  target: MatchContext; // oynanacak maç
  windowStart: Date; // son 2 sezonun başlangıcı
  maxMatches?: number; // varsayılan 10
  allVenues?: boolean; // takımlarda genel form: iç ve dış saha maçları birlikte (varsayılan: yalnızca maçtaki sahası)
  minSample?: number; // varsayılan 6, altı "az örnek"
}

export interface Sample<T> {
  items: T[];
  lowSample: boolean;
}

function isEligible(c: MatchContext & { status: string }, opts: SampleOptions): boolean {
  return c.status === "finished" && c.eventDate < opts.target.eventDate && c.eventDate >= opts.windowStart;
}

// Takımlarda lig maçı → aynı lig (yükselen takım kuralı); oyuncularda → aynı turnuva türü
function isSameCompetition(c: MatchContext, target: MatchContext, strictLeague: boolean): boolean {
  if (strictLeague && target.competitionType === "LEAGUE") return c.leagueId === target.leagueId;
  return c.competitionType === target.competitionType;
}

function newestFirst<T extends MatchContext>(items: T[], opts: SampleOptions): Sample<T> {
  const max = opts.maxMatches ?? 10;
  const min = opts.minSample ?? 6;
  const selected = [...items].sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime()).slice(0, max);
  return { items: selected, lowSample: selected.length < min };
}

// Maçı takımın bakış açısına çevirir: takım istenen taraftaymış gibi ev/deplasman alanları yer değiştirir.
// Kurallar maçın ev/deplasman tarafına göre yazıldığı için ("ev sahibi kazandı mı"), genel formda ev sahibinin
// deplasman maçı "ev sahibi" tarafına çevrilir. Korner/kart toplamları iki takımın toplamı olduğundan değişmez.
export function orientTo<T extends TeamHistoryMatch>(m: T, teamId: number, venue: "home" | "away"): T {
  const isHome = m.homeTeamId === teamId;
  if (isHome === (venue === "home")) return m;
  return {
    ...m,
    homeTeamId: m.awayTeamId,
    awayTeamId: m.homeTeamId,
    homeScore: m.awayScore,
    awayScore: m.homeScore,
    homeScoreHt: m.awayScoreHt,
    awayScoreHt: m.homeScoreHt,
  };
}

export function selectTeamSample<T extends TeamHistoryMatch>(
  history: T[],
  teamId: number,
  venue: "home" | "away",
  opts: SampleOptions,
): Sample<T> {
  const candidates = history.filter(
    (m) =>
      isEligible(m, opts) &&
      (opts.allVenues
        ? m.homeTeamId === teamId || m.awayTeamId === teamId
        : venue === "home" ? m.homeTeamId === teamId : m.awayTeamId === teamId) &&
      isSameCompetition(m, opts.target, true),
  );
  const sample = newestFirst(candidates, opts);
  return { ...sample, items: sample.items.map((m) => orientTo(m, teamId, venue)) };
}

export function selectPlayerSample<T extends PlayerHistoryLine>(lines: T[], opts: SampleOptions): Sample<T> {
  const candidates = lines.filter(
    (l) => isEligible(l, opts) && l.isStarter && isSameCompetition(l, opts.target, false),
  );
  return newestFirst(candidates, opts);
}
