import { describe, expect, it } from "vitest";
import { FeatureState, FEATURE_NAMES, fitPoisson, predictDixonColes, predictLambda, type PlayedMatch } from "./score-model";

const match = (id: number, day: number, h: number, a: number, hs: number, as: number): PlayedMatch => ({
  id, leagueId: 1, eventDate: new Date(Date.UTC(2025, 0, day)), homeTeamId: h, awayTeamId: a, homeScore: hs, awayScore: as,
  homeShots: null, awayShots: null, homeSot: null, awaySot: null,
});

describe("skor modeli", () => {
  it("Poisson regresyonu bilinen ağırlıkları bulur", () => {
    // log λ = 0.2 + 0.5·x  (x ∈ {-1, 0, 1}); y beklenen değerin kendisi (gürültüsüz)
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = (i % 3) - 1;
      X.push([x]);
      y.push(Math.exp(0.2 + 0.5 * x));
    }
    const m = fitPoisson(X, y, 0);
    expect(predictLambda(m, [1])).toBeCloseTo(Math.exp(0.7), 3);
    expect(predictLambda(m, [-1])).toBeCloseTo(Math.exp(-0.3), 3);
  });

  it("Dixon–Coles dağılımı toplamda 1, ρ<0 beraberliği artırır", () => {
    const base = predictDixonColes(1.3, 1.1, 0);
    const dc = predictDixonColes(1.3, 1.1, -0.1);
    expect(base.homeWin + base.draw + base.awayWin).toBeCloseTo(1, 6);
    expect(dc.draw).toBeGreaterThan(base.draw);
  });

  it("Özellikler yalnızca geçmiş maçlardan: güçlü takımın Elo farkı artar", () => {
    const s = new FeatureState();
    const before = s.features({ homeTeamId: 1, awayTeamId: 2, leagueId: 1, eventDate: new Date(Date.UTC(2025, 0, 20)) });
    expect(before.home).toHaveLength(FEATURE_NAMES.length);
    for (let d = 1; d <= 10; d++) s.update(match(d, d, 1, 2, 3, 0));
    const after = s.features({ homeTeamId: 1, awayTeamId: 2, leagueId: 1, eventDate: new Date(Date.UTC(2025, 0, 20)) });
    const elo = FEATURE_NAMES.indexOf("eloFarkı");
    expect(after.home[elo]).toBeGreaterThan(before.home[elo]);
    expect(after.away[elo]).toBeLessThan(before.away[elo]);
    expect(s.gamesOf(1)).toBe(10);
  });
});
