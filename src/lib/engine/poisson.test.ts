import { describe, expect, it } from "vitest";
import { expectedGoals, poissonPmf, predict, shrunkRate } from "./poisson";

const league = { homeGoals: 1.5, awayGoals: 1.2 };

describe("poissonPmf", () => {
  it("bilinen değerler: λ=1 için P(0)=P(1)=e^-1", () => {
    expect(poissonPmf(0, 1)).toBeCloseTo(Math.exp(-1), 10);
    expect(poissonPmf(1, 1)).toBeCloseTo(Math.exp(-1), 10);
    expect(poissonPmf(2, 1)).toBeCloseTo(Math.exp(-1) / 2, 10);
  });
  it("olasılıklar toplamı 1'e yakın", () => {
    let s = 0;
    for (let k = 0; k <= 20; k++) s += poissonPmf(k, 2.7);
    expect(s).toBeCloseTo(1, 6);
  });
  it("λ=0: kesin 0 gol", () => {
    expect(poissonPmf(0, 0)).toBe(1);
    expect(poissonPmf(2, 0)).toBe(0);
  });
});

describe("shrunkRate", () => {
  it("az maçta lig ortalamasına çekilir, çok maçta takımın kendi ortalamasına yaklaşır", () => {
    // 2 maçta 8 gol (maç başı 4) → 5 sanal lig maçıyla (8 + 5·1.5) / 7 ≈ 2.21
    expect(shrunkRate(8, 2, 1.5)).toBeCloseTo(15.5 / 7, 10);
    // 100 maçta 400 gol → 4'e çok yakın
    expect(shrunkRate(400, 100, 1.5)).toBeGreaterThan(3.8);
  });
  it("hiç maç yoksa lig ortalaması", () => {
    expect(shrunkRate(0, 0, 1.5)).toBe(1.5);
  });
});

describe("expectedGoals", () => {
  it("iki ortalama takım lig ortalamalarını verir", () => {
    const avgHome = { games: 10, scored: 15, conceded: 12 };
    const avgAway = { games: 10, scored: 12, conceded: 15 };
    const e = expectedGoals(avgHome, avgAway, league);
    expect(e.lambdaHome).toBeCloseTo(1.5, 10);
    expect(e.lambdaAway).toBeCloseTo(1.2, 10);
  });
  it("güçlü ev sahibi + zayıf deplasman savunması → ev golü artar", () => {
    const strong = { games: 10, scored: 25, conceded: 8 };
    const weak = { games: 10, scored: 8, conceded: 22 };
    const e = expectedGoals(strong, weak, league);
    expect(e.lambdaHome).toBeGreaterThan(2);
    expect(e.lambdaAway).toBeLessThan(1);
  });
});

describe("predict", () => {
  const strong = { games: 10, scored: 25, conceded: 8 };
  const weak = { games: 10, scored: 8, conceded: 22 };
  const p = predict(strong, weak, league);

  it("1/X/2 toplamı 1", () => {
    expect(p.homeWin + p.draw + p.awayWin).toBeCloseTo(1, 10);
  });
  it("güçlü ev sahibi favori, en olası skor ev galibiyeti", () => {
    expect(p.homeWin).toBeGreaterThan(p.awayWin);
    expect(p.mostLikely.home).toBeGreaterThan(p.mostLikely.away);
  });
  it("en olası 3 skor azalan sırada ve en olası ilk sırada", () => {
    expect(p.topScores).toHaveLength(3);
    expect(p.topScores[0]).toEqual(p.mostLikely);
    expect(p.topScores[0].p).toBeGreaterThanOrEqual(p.topScores[1].p);
    expect(p.topScores[1].p).toBeGreaterThanOrEqual(p.topScores[2].p);
  });
  it("olasılıklar 0-1 aralığında", () => {
    for (const v of [p.over25, p.btts, p.homeWin, p.draw, p.awayWin]) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("aynı girdi her zaman aynı sonuç (deterministik)", () => {
    expect(predict(strong, weak, league)).toEqual(p);
  });
});
