import { describe, expect, it } from "vitest";
import {
  decayWeight, fitRatings, h2hMultiplier, ratedLambdas, recordVsTier, teamForm, tiersOf, type ScoredMatch,
} from "./ratings";

const ASOF = new Date(Date.UTC(2026, 9, 12));
const daysAgo = (d: number) => new Date(ASOF.getTime() - d * 86_400_000);
const m = (h: number, a: number, hs: number, as: number, d = 10): ScoredMatch => ({
  homeTeamId: h, awayTeamId: a, homeScore: hs, awayScore: as, eventDate: daysAgo(d),
});

// 4 takımlık çift devreli lig: 1 güçlü, 2 ve 3 orta, 4 zayıf
const STRONG = 1, MID = 2, MID2 = 3, WEAK = 4;
const league: ScoredMatch[] = [
  m(STRONG, MID, 3, 1), m(STRONG, MID2, 2, 0), m(STRONG, WEAK, 4, 0),
  m(MID, STRONG, 1, 2), m(MID, MID2, 1, 1), m(MID, WEAK, 2, 0),
  m(MID2, STRONG, 0, 2), m(MID2, MID, 1, 1), m(MID2, WEAK, 2, 1),
  m(WEAK, STRONG, 0, 3), m(WEAK, MID, 1, 2), m(WEAK, MID2, 0, 1),
];

describe("decayWeight", () => {
  it("bugün 1, yarılanma süresinde 0.5, iki katında 0.25", () => {
    expect(decayWeight(ASOF, ASOF)).toBe(1);
    expect(decayWeight(daysAgo(180), ASOF)).toBeCloseTo(0.5, 10);
    expect(decayWeight(daysAgo(360), ASOF)).toBeCloseTo(0.25, 10);
  });
});

describe("fitRatings", () => {
  const r = fitRatings(league, { asOf: ASOF });

  it("güçlü takımın hücumu en yüksek, savunması en iyi (en düşük)", () => {
    expect(r.attack.get(STRONG)!).toBeGreaterThan(r.attack.get(MID)!);
    expect(r.defense.get(STRONG)!).toBeLessThan(r.defense.get(WEAK)!);
  });

  it("zayıf takımın hücumu en düşük", () => {
    const min = Math.min(...r.attack.values());
    expect(r.attack.get(WEAK)).toBe(min);
  });

  it("puanların ortalaması 1 (lig ortalaması)", () => {
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean([...r.attack.values()])).toBeCloseTo(1, 10);
    expect(mean([...r.defense.values()])).toBeCloseTo(1, 10);
  });

  it("taban goller lig ortalamaları", () => {
    expect(r.homeBase).toBeCloseTo(league.reduce((s, x) => s + x.homeScore, 0) / league.length, 10);
    expect(r.awayBase).toBeCloseTo(league.reduce((s, x) => s + x.awayScore, 0) / league.length, 10);
  });
});

describe("teamForm: rakip gücü düzeltmesi", () => {
  const r = fitRatings(league, { asOf: ASOF });

  it("aynı 2 gol, güçlü savunmaya atılınca daha yüksek hücum puanı verir", () => {
    const vsStrong = teamForm(MID, [m(MID, STRONG, 2, 0)], r);
    const vsWeak = teamForm(MID, [m(MID, WEAK, 2, 0)], r);
    expect(vsStrong.attack).toBeGreaterThan(vsWeak.attack);
  });

  it("iç saha ve deplasman maçlarını birlikte sayar", () => {
    const f = teamForm(MID, [m(MID, WEAK, 2, 0), m(WEAK, MID, 1, 2)], r);
    expect(f.games).toBe(2);
  });

  it("maç yoksa ortalama takım (1, 1)", () => {
    expect(teamForm(MID, [], r)).toEqual({ attack: 1, defense: 1, games: 0 });
  });
});

describe("h2hMultiplier", () => {
  const r = fitRatings(league, { asOf: ASOF });
  const a = { attack: 1, defense: 1, games: 10 };
  const b = { attack: 1, defense: 1, games: 10 };

  it("aralarında beklenenden fazla gol attıysa 1'in üstü, ama sınırlı", () => {
    const many = [m(MID, MID2, 4, 0, 30), m(MID2, MID, 0, 4, 200), m(MID, MID2, 3, 1, 400)];
    const k = h2hMultiplier(many, MID, a, b, r);
    expect(k).toBeGreaterThan(1);
    expect(k).toBeLessThan(2.5);
  });

  it("aralarında maç yoksa etkisiz (1)", () => {
    expect(h2hMultiplier([], MID, a, b, r)).toBe(1);
  });

  it("maç sayısı arttıkça etki büyür", () => {
    const one = h2hMultiplier([m(MID, MID2, 4, 0)], MID, a, b, r);
    const three = h2hMultiplier([m(MID, MID2, 4, 0), m(MID, MID2, 4, 0), m(MID, MID2, 4, 0)], MID, a, b, r);
    expect(three).toBeGreaterThan(one);
  });
});

describe("ratedLambdas", () => {
  it("ortalama takımlar lig tabanını verir; çarpanlar uygulanır", () => {
    const r = fitRatings(league, { asOf: ASOF });
    const avg = { attack: 1, defense: 1, games: 10 };
    const l = ratedLambdas(avg, avg, r);
    expect(l.lambdaHome).toBeCloseTo(r.homeBase, 10);
    expect(l.lambdaAway).toBeCloseTo(r.awayBase, 10);
    expect(ratedLambdas(avg, avg, r, { home: 1.2, away: 1 }).lambdaHome).toBeCloseTo(r.homeBase * 1.2, 10);
  });
});

describe("güç grupları", () => {
  const r = fitRatings(league, { asOf: ASOF });
  const tiers = tiersOf(r);

  it("güçlü takım üst grupta, zayıf takım alt grupta", () => {
    expect(tiers.get(STRONG)).toBe("top");
    expect(tiers.get(WEAK)).toBe("bottom");
  });

  it("gruba karşı karne: yalnızca o gruptaki rakipler sayılır", () => {
    const rec = recordVsTier(MID, league, tiers, "top");
    expect(rec).toMatchObject({ games: 2, wins: 0, draws: 0, losses: 2, scored: 2, conceded: 5 });
  });
});
