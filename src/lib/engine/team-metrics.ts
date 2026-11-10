// src/lib/engine/team-metrics.ts
// Takım sayfası: bir takımın son maçlarında seçilen istatistik (gol, korner, şut, kart...) için
// maç maç değerler, ortalamalar ve çizgi tutma oranları. Saf fonksiyon, veritabanı yok.
import { teamCards } from "./totals";

export type Category = "goals" | "corners" | "shots" | "sot" | "cards" | "fouls";
export type Period = "FULL" | "H1" | "H2";
export type Venue = "all" | "home" | "away";
export type CompFilter = "all" | "league" | "europe";

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: "goals", label: "Gol" },
  { key: "corners", label: "Korner" },
  { key: "shots", label: "Şut" },
  { key: "sot", label: "İsabetli şut" },
  { key: "cards", label: "Kart" },
  { key: "fouls", label: "Faul" },
];

export interface PeriodStat {
  teamId: number;
  period: Period;
  corners: number | null;
  yellowCards: number | null;
  redCards: number | null;
  shotsTotal: number | null;
  shotsOnTarget: number | null;
  fouls: number | null;
  secondYellows?: number; // yalnızca maç geneli için bilinir
}

export interface TeamMatch {
  id: number;
  eventDate: Date;
  competition: string;
  competitionType: string; // LEAGUE, EUROPE, CUP, FRIENDLY
  homeTeamId: number;
  awayTeamId: number;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreHt: number | null;
  awayScoreHt: number | null;
  stats: PeriodStat[];
}

export type Result = "W" | "D" | "L";

export interface MetricRow {
  match: TeamMatch;
  isHome: boolean;
  for: number;
  against: number;
  total: number;
  result: Result | null; // maç sonucu (her zaman maç geneli)
}

export interface LineRate {
  line: number; // 2.5 gibi
  hits: number;
  total: number;
}

export interface TeamMetrics {
  rows: MetricRow[]; // en yeniden eskiye
  record: { W: number; D: number; L: number };
  avgFor: number | null;
  avgAgainst: number | null;
  avgTotal: number | null;
  totalLines: LineRate[];
  forLines: LineRate[];
}

const sub = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

// Bir takımın bir maçta, seçilen yarıda attığı/yaptığı değer
function goalsOf(m: TeamMatch, home: boolean, period: Period): number | null {
  const ft = home ? m.homeScore : m.awayScore;
  const ht = home ? m.homeScoreHt : m.awayScoreHt;
  if (period === "FULL") return ft;
  if (period === "H1") return ht;
  return sub(ft, ht);
}

function statOf(m: TeamMatch, teamId: number, period: Period, cat: Exclude<Category, "goals">): number | null {
  const s = m.stats.find((x) => x.teamId === teamId && x.period === period);
  if (!s) return null;
  switch (cat) {
    case "corners":
      return s.corners;
    case "shots":
      return s.shotsTotal;
    case "sot":
      return s.shotsOnTarget;
    case "fouls":
      return s.fouls;
    case "cards":
      return teamCards(s);
  }
}

export function metricOf(m: TeamMatch, teamId: number, cat: Category, period: Period): { for: number; against: number } | null {
  const isHome = m.homeTeamId === teamId;
  const oppId = isHome ? m.awayTeamId : m.homeTeamId;
  const f = cat === "goals" ? goalsOf(m, isHome, period) : statOf(m, teamId, period, cat);
  const a = cat === "goals" ? goalsOf(m, !isHome, period) : statOf(m, oppId, period, cat);
  if (f === null || a === null) return null;
  return { for: f, against: a };
}

function resultOf(m: TeamMatch, isHome: boolean): Result | null {
  if (m.homeScore === null || m.awayScore === null) return null;
  const f = isHome ? m.homeScore : m.awayScore;
  const a = isHome ? m.awayScore : m.homeScore;
  return f > a ? "W" : f < a ? "L" : "D";
}

// Ortalamanın çevresindeki üç çizgi: ort. 2.7 → 1.5 / 2.5 / 3.5
export function linesAround(avg: number): number[] {
  const base = Math.floor(avg);
  return [base - 1.5, base - 0.5, base + 0.5].filter((l) => l > 0);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

const rateLines = (values: number[], avg: number | null): LineRate[] =>
  avg === null ? [] : linesAround(avg).map((line) => ({ line, hits: values.filter((v) => v > line).length, total: values.length }));

export interface MetricFilters {
  category: Category;
  period: Period;
  venue: Venue;
  comp: CompFilter;
  last: number;
}

// matches: en yeniden eskiye. Seçilen istatistiği olmayan maçlar atlanır, sonra son N alınır.
export function teamMetrics(matches: TeamMatch[], teamId: number, f: MetricFilters): TeamMetrics {
  const rows: MetricRow[] = [];
  for (const m of matches) {
    if (rows.length >= f.last) break;
    const isHome = m.homeTeamId === teamId;
    if (f.venue === "home" && !isHome) continue;
    if (f.venue === "away" && isHome) continue;
    if (f.comp === "league" && m.competitionType !== "LEAGUE") continue;
    if (f.comp === "europe" && m.competitionType !== "EUROPE") continue;
    const v = metricOf(m, teamId, f.category, f.period);
    if (!v) continue;
    rows.push({ match: m, isHome, for: v.for, against: v.against, total: v.for + v.against, result: resultOf(m, isHome) });
  }

  const record = { W: 0, D: 0, L: 0 };
  for (const r of rows) if (r.result) record[r.result]++;

  const avgFor = mean(rows.map((r) => r.for));
  const avgTotal = mean(rows.map((r) => r.total));
  return {
    rows,
    record,
    avgFor,
    avgAgainst: mean(rows.map((r) => r.against)),
    avgTotal,
    totalLines: rateLines(rows.map((r) => r.total), avgTotal),
    forLines: rateLines(rows.map((r) => r.for), avgFor),
  };
}

// ---------- Grafik ----------

export type LineDir = "over" | "under";

// Grafiğin başlangıç çizgisi: ortalamanın altındaki en yakın .5 (ort. 3.15 → 2.5), en az 0.5
export function defaultLine(avg: number | null): number {
  if (avg === null) return 0.5;
  return Math.max(0.5, Math.floor(avg) - 0.5);
}

export function passesLine(value: number, line: number, dir: LineDir): boolean {
  return dir === "over" ? value > line : value < line;
}

export function lineHitRate(values: number[], line: number, dir: LineDir): LineRate {
  return { line, hits: values.filter((v) => passesLine(v, line, dir)).length, total: values.length };
}
