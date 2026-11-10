// src/lib/engine/player-profile.ts
// Oyuncu sayfasının hesapları: filtre, sezon özeti (toplam, maç başı, 90 dakikada), çizgi isabetleri ve öne çıkan özellikler.
// Oranlar yalnızca ilk 11'de başladığı maçlardan (maç analizindeki örnek kuralıyla aynı). Saf fonksiyonlar, veritabanı yok.
import { PLAYER_STAT_KEYS, type PlayerStatKey, type PlayerLine } from "./trends";
import type { CompetitionType } from "./selection";

export interface ProfileGame {
  matchId: number;
  date: number; // zaman damgası
  isHome: boolean;
  started: boolean;
  minutes: number;
  competitionType: CompetitionType;
  stats: PlayerLine;
}

export type ProfileVenue = "all" | "home" | "away";
export type ProfileComp = "all" | "league" | "europe";

export interface ProfileFilter {
  venue: ProfileVenue;
  comp: ProfileComp;
  last: number; // son N maç (filtrelerden sonra)
}

// Oynadığı maçlar, en yeniden eskiye; filtreler uygulanmış, son N
export function filterGames<T extends ProfileGame>(games: T[], f: ProfileFilter): T[] {
  return [...games]
    .sort((a, b) => b.date - a.date)
    .filter((g) => f.venue === "all" || (f.venue === "home") === g.isHome)
    .filter((g) => f.comp === "all" || g.competitionType === (f.comp === "league" ? "LEAGUE" : "EUROPE"))
    .slice(0, f.last);
}

export interface ProfileSummary {
  apps: number;
  starts: number;
  minutes: number;
  totals: PlayerLine;
  perGame: Record<PlayerStatKey, number | null>; // ilk 11 maçı başına
  per90: Record<PlayerStatKey, number | null>; // tüm dakikalar üzerinden
}

const zeroLine = (): PlayerLine => Object.fromEntries(PLAYER_STAT_KEYS.map((k) => [k, 0])) as PlayerLine;

export function summarize(games: ProfileGame[]): ProfileSummary {
  const totals = zeroLine();
  const startTotals = zeroLine();
  let minutes = 0;
  let starts = 0;
  for (const g of games) {
    minutes += g.minutes;
    if (g.started) starts++;
    for (const k of PLAYER_STAT_KEYS) {
      totals[k] += g.stats[k];
      if (g.started) startTotals[k] += g.stats[k];
    }
  }
  const perGame = Object.fromEntries(PLAYER_STAT_KEYS.map((k) => [k, starts ? startTotals[k] / starts : null])) as ProfileSummary["perGame"];
  const per90 = Object.fromEntries(PLAYER_STAT_KEYS.map((k) => [k, minutes ? (totals[k] / minutes) * 90 : null])) as ProfileSummary["per90"];
  return { apps: games.length, starts, minutes, totals, perGame, per90 };
}

export interface LineHit {
  line: number; // 2 = 2+
  hits: number;
  total: number;
}

// İlk 11 maçlarında bir istatistikte 1+, 2+, 3+... kaç kez (yalnızca en az bir kez görülen çizgiler, en fazla maxLines)
export function lineHits(games: ProfileGame[], stat: PlayerStatKey, maxLines = 4): LineHit[] {
  const starts = games.filter((g) => g.started);
  const out: LineHit[] = [];
  for (let line = 1; line <= maxLines; line++) {
    const hits = starts.filter((g) => g.stats[stat] >= line).length;
    if (hits === 0 && line > 1) break;
    out.push({ line, hits, total: starts.length });
  }
  return out;
}

export interface HighlightDef {
  code: string;
  name: string;
  statKey: PlayerStatKey;
  line: number;
  threshold: number;
}

export interface Highlight extends HighlightDef {
  hits: number;
  total: number;
  rate: number;
  outcomes: boolean[]; // ilk 11 maçları, en yeniden eskiye
  passes: boolean; // eşiği geçti mi
}

// Öne çıkan özellikler: tanımlı trendlerin ilk 11 maçlarındaki isabeti. Aynı istatistikte yalnızca geçen en yüksek çizgi
// (geçen yoksa en yüksek oranlı çizgi) kalır; geçenler önde, sonra orana göre.
export function highlights(games: ProfileGame[], defs: HighlightDef[], minStarts = 5): Highlight[] {
  const starts = games.filter((g) => g.started);
  if (starts.length < minStarts) return [];
  const all = defs.map((d): Highlight => {
    const outcomes = starts.map((g) => g.stats[d.statKey] >= d.line);
    const hits = outcomes.filter(Boolean).length;
    const rate = hits / starts.length;
    return { ...d, hits, total: starts.length, rate, outcomes, passes: rate >= d.threshold };
  });
  const best = new Map<PlayerStatKey, Highlight>();
  for (const h of all) {
    const cur = best.get(h.statKey);
    const better =
      !cur ||
      (h.passes && !cur.passes) ||
      (h.passes && cur.passes && h.line > cur.line) ||
      (!h.passes && !cur.passes && h.rate > cur.rate);
    if (better) best.set(h.statKey, h);
  }
  return [...best.values()].filter((h) => h.hits > 0).sort((a, b) => Number(b.passes) - Number(a.passes) || b.rate - a.rate);
}
