// Aralarındaki maçlar (head-to-head): iki takımın birbirine karşı geçmişi.
// Bakış açısı her zaman "A takımı" = bugünkü maçın ev sahibi. Saf fonksiyon, veritabanı yok.

export interface H2HMatch {
  id: number;
  eventDate: Date;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  competition?: string;
}

export type H2HResult = "W" | "D" | "L";

export interface H2HGame {
  match: H2HMatch;
  aWasHome: boolean;
  goalsFor: number; // A'nın attığı
  goalsAgainst: number;
  result: H2HResult; // A açısından
}

export interface Record3 { total: number; wins: number; draws: number; losses: number }

export type StreakKind = "wins" | "unbeaten" | "losses" | "winless" | "over25" | "under25" | "btts" | "noBtts";

export interface Streak {
  kind: StreakKind;
  length: number;
  scope: "all" | "venue" | "away"; // venue: A'nın ev sahibi olduğu maçlar, away: B'nin ev sahibi olduğu maçlar
}

// Hangi karşılaşmalara bakılır: saha (home = A evinde, away = B evinde) ve en yeni kaç maç (null = tümü)
export type H2HVenue = "all" | "home" | "away";
export interface H2HFilter {
  venue: H2HVenue;
  last: number | null;
}
export const DEFAULT_H2H_FILTER: H2HFilter = { venue: "all", last: 10 };
export const H2H_LAST_OPTIONS = [5, 10, 20] as const;

// Adres çubuğundaki seçim (?h2h=home&h2hn=20, h2hn=all → tümü); geçersizse varsayılan
export function h2hFilterFromParams(p: { h2h?: string; h2hn?: string }): H2HFilter {
  const venue: H2HVenue = p.h2h === "home" || p.h2h === "away" ? p.h2h : DEFAULT_H2H_FILTER.venue;
  const n = Number(p.h2hn);
  const last =
    p.h2hn === "all" ? null : (H2H_LAST_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_H2H_FILTER.last;
  return { venue, last };
}

// Filtreyi adres çubuğu parametrelerine çevirir; varsayılan değerler yazılmaz
export function h2hFilterParams(f: H2HFilter): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.venue !== DEFAULT_H2H_FILTER.venue) out.h2h = f.venue;
  if (f.last !== DEFAULT_H2H_FILTER.last) out.h2hn = f.last === null ? "all" : String(f.last);
  return out;
}

export interface H2HSummary {
  filter: H2HFilter;
  available: number; // sahaya uyan toplam maç (son N kesilmeden önce)
  oldest: Date | null; // arşivdeki en eski karşılaşma (filtresiz)
  games: H2HGame[]; // filtreye uyan maçlar, en yeniden eskiye
  all: Record3;
  venue: Record3; // A evindeyken
  goalsFor: number;
  goalsAgainst: number;
  btts: number;
  over25: number;
  streaks: Streak[];
}

export const MIN_STREAK = 3;

function toGame(m: H2HMatch, teamA: number): H2HGame | null {
  if (m.homeScore === null || m.awayScore === null) return null;
  const aWasHome = m.homeTeamId === teamA;
  const goalsFor = aWasHome ? m.homeScore : m.awayScore;
  const goalsAgainst = aWasHome ? m.awayScore : m.homeScore;
  const result: H2HResult = goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L";
  return { match: m, aWasHome, goalsFor, goalsAgainst, result };
}

function record(games: H2HGame[]): Record3 {
  return {
    total: games.length,
    wins: games.filter((g) => g.result === "W").length,
    draws: games.filter((g) => g.result === "D").length,
    losses: games.filter((g) => g.result === "L").length,
  };
}

// En yeni maçtan geriye doğru koşul kaç maç kesintisiz sürüyor
export function runLength(games: H2HGame[], test: (g: H2HGame) => boolean): number {
  let n = 0;
  for (const g of games) {
    if (!test(g)) break;
    n++;
  }
  return n;
}

const btts = (g: H2HGame) => g.goalsFor > 0 && g.goalsAgainst > 0;
const over25 = (g: H2HGame) => g.goalsFor + g.goalsAgainst >= 3;

// Bir maç listesindeki seriler. Sonuç serilerinde en anlamlısı seçilir:
// "3 maçtır kazanıyor" ile "3 maçtır yenilmiyor" aynı şeyse yalnızca galibiyet söylenir.
export function streaksOf(games: H2HGame[], scope: Streak["scope"]): Streak[] {
  const out: Streak[] = [];
  const add = (kind: StreakKind, length: number) => {
    if (length >= MIN_STREAK) out.push({ kind, length, scope });
  };

  const wins = runLength(games, (g) => g.result === "W");
  const unbeaten = runLength(games, (g) => g.result !== "L");
  const losses = runLength(games, (g) => g.result === "L");
  const winless = runLength(games, (g) => g.result !== "W");
  add("wins", wins);
  if (unbeaten > wins) add("unbeaten", unbeaten);
  add("losses", losses);
  if (winless > losses) add("winless", winless);

  add("over25", runLength(games, over25));
  add("under25", runLength(games, (g) => !over25(g)));
  add("btts", runLength(games, btts));
  add("noBtts", runLength(games, (g) => !btts(g)));
  return out;
}

export function headToHead(matches: H2HMatch[], teamA: number, filter: H2HFilter = { venue: "all", last: null }): H2HSummary {
  const every = matches
    .map((m) => toGame(m, teamA))
    .filter((g): g is H2HGame => g !== null)
    .sort((x, y) => y.match.eventDate.getTime() - x.match.eventDate.getTime());
  const byVenue = every.filter((g) => filter.venue === "all" || g.aWasHome === (filter.venue === "home"));
  const games = filter.last === null ? byVenue : byVenue.slice(0, filter.last);
  const atVenue = games.filter((g) => g.aWasHome);
  const away = games.filter((g) => !g.aWasHome);

  // Saha seçiliyse bütün seriler zaten o sahanın; ayrıca tekrarlanmaz
  const streaks =
    filter.venue === "all"
      ? [...streaksOf(games, "all"), ...streaksOf(atVenue, "venue"), ...streaksOf(away, "away")]
      : streaksOf(games, filter.venue === "home" ? "venue" : "away");

  return {
    filter,
    available: byVenue.length,
    oldest: every.length ? every[every.length - 1].match.eventDate : null,
    games,
    all: record(games),
    venue: record(atVenue),
    goalsFor: games.reduce((s, g) => s + g.goalsFor, 0),
    goalsAgainst: games.reduce((s, g) => s + g.goalsAgainst, 0),
    btts: games.filter(btts).length,
    over25: games.filter(over25).length,
    streaks,
  };
}
