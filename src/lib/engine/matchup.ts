// src/lib/engine/matchup.ts
// Karşılaştırma sayfası: iki takımın son maçlarındaki form, ortalamalar ve maç trendleri yan yana. Saf fonksiyonlar.
import { CATEGORIES, teamMetrics, type Category, type CompFilter, type Result, type TeamMatch, type Venue } from "./team-metrics";
import { matchTotals } from "./totals";
import { teamRuleFor, type MatchScore } from "./trends";

export interface MatchupFilter {
  venue: Venue;
  comp: CompFilter;
  last: number;
}

export interface CategoryAverages {
  key: Category;
  label: string;
  for: number | null;
  against: number | null;
  games: number; // bu istatistiği olan maç sayısı
}

export interface TrendRate {
  code: string;
  name: string;
  hits: number;
  total: number;
  rate: number | null;
}

export interface TeamProfile {
  games: number;
  record: { W: number; D: number; L: number };
  form: Result[]; // en yeniden eskiye, en fazla 5
  categories: CategoryAverages[];
  trends: TrendRate[];
}

// Maç trendleri: iki takımı birlikte ilgilendiren, tek tarafa bakmayan kurallar (toplam gol, korner, kart...)
export interface MatchTrendDef {
  code: string;
  name: string;
  statKey: string | null;
  line: number | null;
}

// Takımın son maçları: saha ve turnuva filtresi, son N (en yeniden eskiye)
function filtered(matches: TeamMatch[], teamId: number, f: MatchupFilter): TeamMatch[] {
  return matches
    .filter((m) => f.venue === "all" || (f.venue === "home") === (m.homeTeamId === teamId))
    .filter((m) => f.comp === "all" || m.competitionType === (f.comp === "league" ? "LEAGUE" : "EUROPE"))
    .slice(0, f.last);
}

function scoreOf(m: TeamMatch): MatchScore {
  const full = m.stats.filter((s) => s.period === "FULL");
  return {
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homeScoreHt: m.homeScoreHt,
    awayScoreHt: m.awayScoreHt,
    ...matchTotals(full),
  };
}

export function teamProfile(matches: TeamMatch[], teamId: number, f: MatchupFilter, trendDefs: MatchTrendDef[]): TeamProfile {
  const sample = filtered(matches, teamId, f);
  const goals = teamMetrics(sample, teamId, { category: "goals", period: "FULL", venue: "all", comp: "all", last: sample.length });

  const categories = CATEGORIES.map((c): CategoryAverages => {
    const m = teamMetrics(sample, teamId, { category: c.key, period: "FULL", venue: "all", comp: "all", last: sample.length });
    return { key: c.key, label: c.label, for: m.avgFor, against: m.avgAgainst, games: m.rows.length };
  });

  const scores = sample.map(scoreOf);
  const trends = trendDefs.map((d): TrendRate => {
    const rule = teamRuleFor(d);
    const outcomes = rule ? scores.map(rule).filter((o): o is boolean => o !== null) : [];
    const hits = outcomes.filter(Boolean).length;
    return { code: d.code, name: d.name, hits, total: outcomes.length, rate: outcomes.length ? hits / outcomes.length : null };
  });

  return {
    games: sample.length,
    record: goals.record,
    form: goals.rows.map((r) => r.result).filter((r): r is Result => r !== null).slice(0, 5),
    categories,
    trends,
  };
}
