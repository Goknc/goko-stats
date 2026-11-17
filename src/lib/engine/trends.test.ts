// src/lib/engine/trends.test.ts
import { describe, it, expect } from "vitest";
import { teamTrendRules, playerAtLeast, teamAtLeast, teamRuleFor } from "./trends";
import { computeRate } from "./rate";


const score = (h: number | null, a: number | null, hHt: number | null, aHt: number | null) => ({
  homeScore: h, awayScore: a, homeScoreHt: hHt, awayScoreHt: aHt,
});

// Referans maçlar (elle doğrulanmış gerçek maçlar)
const celtaRacing = score(5, 0, 2, 0); // 213582
const getafeCelta = score(1, 1, 1, 0); // 213554

describe("Takım trendleri", () => {
  it("İki takım da gol: iki takım da gol atmalı", () => {
    expect(teamTrendRules.BTTS(score(2, 1, 0, 0))).toBe(true);
    expect(teamTrendRules.BTTS(score(1, 0, 0, 0))).toBe(false);
    expect(teamTrendRules.BTTS(score(0, 0, 0, 0))).toBe(false);
  });

  it("3+ gol: toplam en az 3 gol", () => {
    expect(teamTrendRules.O25(score(2, 1, 0, 0))).toBe(true);
    expect(teamTrendRules.O25(score(2, 0, 0, 0))).toBe(false);
  });

  it("4+ gol: toplam en az 4 gol", () => {
    expect(teamTrendRules.O35(score(2, 2, 0, 0))).toBe(true);
    expect(teamTrendRules.O35(score(3, 0, 0, 0))).toBe(false);
  });

  it("İlk yarı 2+ gol", () => {
    expect(teamTrendRules.HT_O15(score(1, 1, 1, 1))).toBe(true);
    expect(teamTrendRules.HT_O15(score(3, 0, 1, 0))).toBe(false);
  });

  it("İlk yarıda iki takım da gol atmalı", () => {
    expect(teamTrendRules.HT_BTTS(score(1, 1, 1, 1))).toBe(true);
    expect(teamTrendRules.HT_BTTS(score(2, 0, 2, 0))).toBe(false);
  });

  it("Skor yoksa sonuç 'veri yok' (null) olmalı, 'tutmadı' değil", () => {
    expect(teamTrendRules.BTTS(score(null, null, null, null))).toBeNull();
    expect(teamTrendRules.HT_O15(score(2, 1, null, null))).toBeNull();
  });

  it("Gerçek maç: Celta 5-0 Racing (İY 2-0)", () => {
    expect(teamTrendRules.BTTS(celtaRacing)).toBe(false);
    expect(teamTrendRules.O25(celtaRacing)).toBe(true);
    expect(teamTrendRules.O35(celtaRacing)).toBe(true);
    expect(teamTrendRules.HT_O15(celtaRacing)).toBe(true);
    expect(teamTrendRules.HT_BTTS(celtaRacing)).toBe(false);
  });

  it("Gerçek maç: Getafe 1-1 Celta (İY 1-0)", () => {
    expect(teamTrendRules.BTTS(getafeCelta)).toBe(true);
    expect(teamTrendRules.O25(getafeCelta)).toBe(false);
    expect(teamTrendRules.HT_O15(getafeCelta)).toBe(false);
    expect(teamTrendRules.HT_BTTS(getafeCelta)).toBe(false);
  });
});

describe("Oyuncu trendleri", () => {
  it("Gerçek oyuncu: Durán, Celta-Racing", () => {
    const duran = { goals: 2, assists: 0, shotsOnTarget: 3, shotsTotal: 3, tackles: 1, fouls: 0, yellowCards: 0 };
    expect(playerAtLeast("goals", 1)(duran)).toBe(true);
    expect(playerAtLeast("assists", 1)(duran)).toBe(false);
    expect(playerAtLeast("shotsOnTarget", 3)(duran)).toBe(true);
    expect(playerAtLeast("shotsOnTarget", 4)(duran)).toBe(false);
    expect(playerAtLeast("tackles", 1)(duran)).toBe(true);
    expect(playerAtLeast("tackles", 2)(duran)).toBe(false);
    expect(playerAtLeast("fouls", 1)(duran)).toBe(false);
  });
});

describe("Oran hesabı", () => {
  it("Veri olmayan maçlar paydadan düşer, kanıt listesinde kalır", () => {
    const result = computeRate([true, false, null, true], (x) => x);
    expect(result.hits).toBe(2);
    expect(result.total).toBe(3);
    expect(result.rate).toBeCloseTo(2 / 3);
    expect(result.evidence).toHaveLength(4);
  });

  it("Boş örnekte oran null olur (sıfıra bölme yok)", () => {
    const result = computeRate([], (x: boolean) => x);
    expect(result.total).toBe(0);
    expect(result.rate).toBeNull();
  });
});

describe("İstatistik + çizgi takım trendleri", () => {
  const m = { homeScore: 2, awayScore: 0, homeScoreHt: 1, awayScoreHt: 0, totalCorners: 11, totalCards: null };

  it("Ev sahibi ve deplasman golü", () => {
    expect(teamAtLeast("homeGoals", 2)(m)).toBe(true); // Ev sahibi 2+
    expect(teamAtLeast("homeGoals", 3)(m)).toBe(false); // Ev sahibi 3+
    expect(teamAtLeast("awayGoals", 1)(m)).toBe(false); // Deplasman 1+
  });

  it("Korner tuttu, kart verisi yoksa null", () => {
    expect(teamAtLeast("totalCorners", 10)(m)).toBe(true); // 10+ korner
    expect(teamAtLeast("totalCorners", 12)(m)).toBe(false); // 12+ korner
    expect(teamAtLeast("totalCards", 4)(m)).toBeNull();
  });

  it("Kural seçimi: özel kod, istatistik + çizgi, tanımsız", () => {
    expect(teamRuleFor({ code: "BTTS", statKey: null, line: null })).toBe(teamTrendRules.BTTS);
    expect(teamRuleFor({ code: "H_O15", statKey: "homeGoals", line: 2 })!(m)).toBe(true);
    expect(teamRuleFor({ code: "XYZ", statKey: null, line: null })).toBeNull();
  });
});