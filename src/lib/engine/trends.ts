// src/lib/engine/trends.ts
// Trend kuralları: bir maç (veya oyuncunun bir maçı) için "tuttu mu?" sorusunu cevaplar.
// true = tuttu, false = tutmadı, null = veri yok (hesaba katılmaz)
//
// Kurallar maçın kendi ev/deplasman tarafına göre yazılır ("ev sahibi kazandı mı").
// Ev sahibinin iç saha maçlarına uygulanınca "X evinde kazandı mı", deplasman takımının dış saha
// maçlarına uygulanınca "Y deplasmanda kaybetti mi" anlamına gelir. Hangi karnenin karar verdiği
// trends.side ile belirlenir (bkz. engine/side.ts).

export type Outcome = boolean | null;

export interface MatchScore {
  homeScore: number | null;
  awayScore: number | null;
  homeScoreHt: number | null;
  awayScoreHt: number | null;
  totalCorners?: number | null; // iki takımın korner toplamı
  totalCards?: number | null; // iki takımın sarı + kırmızı kart toplamı
}

// ---------- Takım trendleri ----------

// Özel kurallı trendler
export type TeamTrendCode = "BTTS" | "O25" | "O35" | "O45" | "O55" | "U25" | "HT_O15" | "HT_BTTS" | "H_WIN" | "A_WIN";

function bothScored(home: number | null, away: number | null): Outcome {
  if (home === null || away === null) return null;
  return home >= 1 && away >= 1;
}

function totalAtLeast(home: number | null, away: number | null, min: number): Outcome {
  if (home === null || away === null) return null;
  return home + away >= min;
}

function totalAtMost(home: number | null, away: number | null, max: number): Outcome {
  if (home === null || away === null) return null;
  return home + away <= max;
}

function homeWon(home: number | null, away: number | null): Outcome {
  if (home === null || away === null) return null;
  return home > away;
}

export const teamTrendRules: Record<TeamTrendCode, (m: MatchScore) => Outcome> = {
  BTTS: (m) => bothScored(m.homeScore, m.awayScore),
  O25: (m) => totalAtLeast(m.homeScore, m.awayScore, 3),
  O35: (m) => totalAtLeast(m.homeScore, m.awayScore, 4),
  O45: (m) => totalAtLeast(m.homeScore, m.awayScore, 5),
  O55: (m) => totalAtLeast(m.homeScore, m.awayScore, 6),
  U25: (m) => totalAtMost(m.homeScore, m.awayScore, 2),
  HT_O15: (m) => totalAtLeast(m.homeScoreHt, m.awayScoreHt, 2),
  HT_BTTS: (m) => bothScored(m.homeScoreHt, m.awayScoreHt),
  H_WIN: (m) => homeWon(m.homeScore, m.awayScore),
  A_WIN: (m) => homeWon(m.awayScore, m.homeScore),
};

// İstatistik + çizgi ile tanımlanan takım trendleri (trends.statKey değerleri)
export const TEAM_STAT_KEYS = ["homeGoals", "awayGoals", "totalCorners", "totalCards"] as const;
export type TeamStatKey = (typeof TEAM_STAT_KEYS)[number];

export function isTeamStatKey(key: string | null): key is TeamStatKey {
  return key !== null && (TEAM_STAT_KEYS as readonly string[]).includes(key);
}

function teamStatValue(m: MatchScore, stat: TeamStatKey): number | null {
  switch (stat) {
    case "homeGoals":
      return m.homeScore;
    case "awayGoals":
      return m.awayScore;
    case "totalCorners":
      return m.totalCorners ?? null;
    case "totalCards":
      return m.totalCards ?? null;
  }
}

export function teamAtLeast(stat: TeamStatKey, line: number) {
  return (m: MatchScore): Outcome => {
    const value = teamStatValue(m, stat);
    return value === null ? null : value >= line;
  };
}

// Bir takım trendinin kuralı: özel kod (iki takım da gol, toplam gol, galibiyet) ya da istatistik + çizgi. Tanımsızsa null.
export function teamRuleFor(trend: { code: string; statKey: string | null; line: number | null }) {
  if (trend.code in teamTrendRules) return teamTrendRules[trend.code as TeamTrendCode];
  if (isTeamStatKey(trend.statKey) && trend.line !== null) return teamAtLeast(trend.statKey, trend.line);
  return null;
}

// ---------- Oyuncu trendleri ----------

export const PLAYER_STAT_KEYS = ["goals", "assists", "shotsOnTarget", "shotsTotal", "tackles", "fouls", "yellowCards"] as const;
export type PlayerStatKey = (typeof PLAYER_STAT_KEYS)[number];
export type PlayerLine = Record<PlayerStatKey, number>;

export function isPlayerStatKey(key: string | null): key is PlayerStatKey {
  return key !== null && (PLAYER_STAT_KEYS as readonly string[]).includes(key);
}

// Tüm oyuncu trendleri için tek kural: istatistik >= çizgi
export function playerAtLeast(stat: PlayerStatKey, line: number) {
  return (p: PlayerLine): Outcome => p[stat] >= line;
}
