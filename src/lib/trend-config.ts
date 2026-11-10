// src/lib/trend-config.ts
// Takip edilen trendlerin tanımları. Kurallar engine/trends.ts'te; burada ad, eşik ve çizgi.
//
// Bir trend "öne çıkan" olur: karar veren karne(ler)in son maçlardaki oranı eşiği geçerse
// (ör. iki takım da son 20 maçının %60'ından fazlasında 3+ gollü maç oynadıysa).
// Aynı istatistikte birden fazla çizgi varsa (9+ / 10+ / 11+ korner) yalnızca geçen en yüksek çizgi öne çıkar.

export type TrendScope = "TEAM" | "PLAYER";

export interface TrendDef {
  code: string;
  name: string;
  scope: TrendScope;
  threshold: number; // 0.60 = %60
  statKey: string | null; // çizgili trendlerde istatistik (homeGoals, totalCorners, goals, shotsTotal...)
  line: number | null; // "en az kaç": 3 = 3+
  side: "HOME" | "AWAY" | null; // boş = iki takımın karnesi birlikte; HOME/AWAY = yalnızca o takımın karnesi
  excludedLeagues: number[]; // bu liglerde hesaplanmaz (veri kalitesi düşük istatistikler)
}

const t = (
  code: string,
  name: string,
  scope: TrendScope,
  threshold: number,
  opts: Partial<Pick<TrendDef, "statKey" | "line" | "side" | "excludedLeagues">> = {},
): TrendDef => ({
  code,
  name,
  scope,
  threshold,
  statKey: opts.statKey ?? null,
  line: opts.line ?? null,
  side: opts.side ?? null,
  excludedLeagues: opts.excludedLeagues ?? [],
});

// Oyuncu top kapma verisinin güvenilir olmadığı ligler (Liga Portugal, Ligue 1, Eredivisie, MLS)
const NO_TACKLES = [2, 6, 10, 18];

export const TRENDS: TrendDef[] = [
  // Gol
  t("BTTS", "İki takım da gol attı", "TEAM", 0.6),
  t("O25", "3+ gol", "TEAM", 0.6),
  t("O35", "4+ gol", "TEAM", 0.6),
  t("O45", "5+ gol", "TEAM", 0.5),
  t("O55", "6+ gol", "TEAM", 0.5),
  t("U25", "En fazla 2 gol", "TEAM", 0.6),
  t("HT_O15", "İlk yarı 2+ gol", "TEAM", 0.6),
  t("HT_BTTS", "İlk yarıda iki takım da gol", "TEAM", 0.5),
  // Tek takımın karnesi
  t("H_WIN", "Ev sahibi kazandı", "TEAM", 0.7, { side: "HOME" }),
  t("H_O15", "Ev sahibi 2+ gol", "TEAM", 0.7, { statKey: "homeGoals", line: 2, side: "HOME" }),
  t("H_O25", "Ev sahibi 3+ gol", "TEAM", 0.6, { statKey: "homeGoals", line: 3, side: "HOME" }),
  t("A_WIN", "Deplasman kazandı", "TEAM", 0.7, { side: "AWAY" }),
  t("A_O15", "Deplasman 2+ gol", "TEAM", 0.7, { statKey: "awayGoals", line: 2, side: "AWAY" }),
  t("A_O25", "Deplasman 3+ gol", "TEAM", 0.6, { statKey: "awayGoals", line: 3, side: "AWAY" }),
  // Korner (toplam)
  t("C_10", "10+ korner", "TEAM", 0.7, { statKey: "totalCorners", line: 10 }),
  t("C_11", "11+ korner", "TEAM", 0.7, { statKey: "totalCorners", line: 11 }),
  t("C_12", "12+ korner", "TEAM", 0.5, { statKey: "totalCorners", line: 12 }),
  // Kart (toplam)
  t("K_4", "4+ kart", "TEAM", 0.7, { statKey: "totalCards", line: 4 }),
  t("K_5", "5+ kart", "TEAM", 0.7, { statKey: "totalCards", line: 5 }),
  t("K_6", "6+ kart", "TEAM", 0.5, { statKey: "totalCards", line: 6 }),
  // Oyuncu
  t("P_GOAL", "Gol 1+", "PLAYER", 0.6, { statKey: "goals", line: 1 }),
  t("P_ASSIST", "Asist 1+", "PLAYER", 0.5, { statKey: "assists", line: 1 }),
  t("P_SOT1", "İsabetli şut 1+", "PLAYER", 0.65, { statKey: "shotsOnTarget", line: 1 }),
  t("P_SOT2", "İsabetli şut 2+", "PLAYER", 0.65, { statKey: "shotsOnTarget", line: 2 }),
  t("P_SHOT3", "Şut 3+", "PLAYER", 0.65, { statKey: "shotsTotal", line: 3 }),
  t("P_SHOT4", "Şut 4+", "PLAYER", 0.65, { statKey: "shotsTotal", line: 4 }),
  t("P_TKL2", "Top kapma 2+", "PLAYER", 0.65, { statKey: "tackles", line: 2, excludedLeagues: NO_TACKLES }),
  t("P_TKL3", "Top kapma 3+", "PLAYER", 0.65, { statKey: "tackles", line: 3, excludedLeagues: NO_TACKLES }),
  t("P_FOUL2", "Faul 2+", "PLAYER", 0.65, { statKey: "fouls", line: 2 }),
  t("P_YC", "Sarı kart", "PLAYER", 0.5, { statKey: "yellowCards", line: 1, excludedLeagues: [11] }),
];

export const trendByCode = new Map(TRENDS.map((d) => [d.code, d]));

// Bir maçın liginde hesaplanan trendler
export const trendsForLeague = (leagueId: number) => TRENDS.filter((d) => !d.excludedLeagues.includes(leagueId));
