// src/lib/engine/side.test.ts
import { describe, it, expect } from "vitest";
import { decidingRates, pickStrength, isDeciding } from "./side";
import { teamTrendRules, teamRuleFor } from "./trends";

const score = (h: number | null, a: number | null) => ({ homeScore: h, awayScore: a, homeScoreHt: 0, awayScoreHt: 0 });
const rate = (r: number | null, lowSample = false) => ({ rate: r, total: 10, lowSample });

describe("Yeni takım kuralları", () => {
  it("Ev kazanır / Dep kazanır: beraberlik ikisinde de tutmaz", () => {
    expect(teamTrendRules.H_WIN(score(2, 1))).toBe(true);
    expect(teamTrendRules.H_WIN(score(1, 1))).toBe(false);
    expect(teamTrendRules.A_WIN(score(0, 1))).toBe(true);
    expect(teamTrendRules.A_WIN(score(1, 1))).toBe(false);
    expect(teamTrendRules.H_WIN(score(null, 1))).toBeNull();
  });

  it("2.5 Alt: en fazla 2 gol", () => {
    expect(teamTrendRules.U25(score(1, 1))).toBe(true);
    expect(teamTrendRules.U25(score(2, 1))).toBe(false);
    expect(teamTrendRules.U25(score(0, 0))).toBe(true);
    expect(teamTrendRules.U25(score(null, 0))).toBeNull();
  });

  it("Kod öncelikli: H_WIN statKey'siz de kural bulur", () => {
    expect(teamRuleFor({ code: "H_WIN", statKey: null, line: null })).not.toBeNull();
  });
});

describe("Karar veren taraf", () => {
  const home = rate(0.8);
  const away = rate(0.3);

  it("Maç trendinda iki taraf da karar verir, güç zayıf halkadır", () => {
    expect(decidingRates(null, home, away)).toEqual([home, away]);
    expect(pickStrength(null, home, away)).toBe(away);
  });

  it("Takım trendinda yalnızca o takım karar verir, rakibin düşük oranı engel olmaz", () => {
    expect(decidingRates("HOME", home, away)).toEqual([home]);
    expect(pickStrength("HOME", home, away)).toBe(home);
    expect(pickStrength("AWAY", home, away)).toBe(away);
  });

  it("Ekranda soluk gösterilecek taraf", () => {
    expect(isDeciding(null, "away")).toBe(true);
    expect(isDeciding("HOME", "home")).toBe(true);
    expect(isDeciding("HOME", "away")).toBe(false);
    expect(isDeciding("AWAY", "home")).toBe(false);
  });
});
