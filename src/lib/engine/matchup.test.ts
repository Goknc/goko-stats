// src/lib/engine/matchup.test.ts
import { describe, it, expect } from "vitest";
import { teamProfile } from "./matchup";
import type { TeamMatch } from "./team-metrics";

const stat = (teamId: number, corners: number, yellowCards: number) => ({
  teamId, period: "FULL" as const, corners, yellowCards, redCards: 0, shotsTotal: 10, shotsOnTarget: 4, fouls: 12,
});

// Takım 1: 3-1 (ev), 0-0 (dış), 2-2 (ev)
const matches: TeamMatch[] = [
  {
    id: 3, eventDate: new Date("2026-03-03"), competition: "Lig", competitionType: "LEAGUE", homeTeamId: 1, awayTeamId: 2,
    homeName: "A", awayName: "B", homeScore: 3, awayScore: 1, homeScoreHt: 1, awayScoreHt: 0, stats: [stat(1, 7, 2), stat(2, 4, 3)],
  },
  {
    id: 2, eventDate: new Date("2026-02-02"), competition: "Lig", competitionType: "LEAGUE", homeTeamId: 3, awayTeamId: 1,
    homeName: "C", awayName: "A", homeScore: 0, awayScore: 0, homeScoreHt: 0, awayScoreHt: 0, stats: [stat(3, 2, 1), stat(1, 3, 1)],
  },
  {
    id: 1, eventDate: new Date("2026-01-01"), competition: "Avrupa", competitionType: "EUROPE", homeTeamId: 1, awayTeamId: 4,
    homeName: "A", awayName: "D", homeScore: 2, awayScore: 2, homeScoreHt: 1, awayScoreHt: 1, stats: [],
  },
];

const defs = [
  { code: "BTTS", name: "İki takım da gol", statKey: null, line: null },
  { code: "O25", name: "3+ gol", statKey: null, line: null },
  { code: "C_10", name: "10+ korner", statKey: "totalCorners", line: 10 },
];

describe("Karşılaştırma profili", () => {
  it("form, galibiyet kaydı ve ortalamalar", () => {
    const p = teamProfile(matches, 1, { venue: "all", comp: "all", last: 10 }, defs);
    expect(p.games).toBe(3);
    expect(p.record).toEqual({ W: 1, D: 2, L: 0 });
    expect(p.form).toEqual(["W", "D", "D"]);
    const goals = p.categories.find((c) => c.key === "goals")!;
    expect(goals.for).toBeCloseTo(5 / 3);
    expect(goals.against).toBeCloseTo(1);
    // Korner verisi yalnızca iki maçta var
    expect(p.categories.find((c) => c.key === "corners")!.games).toBe(2);
  });

  it("maç trendleri: verisi olmayan maç sayılmaz", () => {
    const p = teamProfile(matches, 1, { venue: "all", comp: "all", last: 10 }, defs);
    expect(p.trends.find((t) => t.code === "BTTS")).toMatchObject({ hits: 2, total: 3 });
    expect(p.trends.find((t) => t.code === "O25")).toMatchObject({ hits: 2, total: 3 });
    expect(p.trends.find((t) => t.code === "C_10")).toMatchObject({ hits: 1, total: 2 });
  });

  it("saha ve turnuva filtresi", () => {
    expect(teamProfile(matches, 1, { venue: "home", comp: "all", last: 10 }, defs).games).toBe(2);
    expect(teamProfile(matches, 1, { venue: "all", comp: "league", last: 10 }, defs).games).toBe(2);
    expect(teamProfile(matches, 1, { venue: "all", comp: "all", last: 1 }, defs).games).toBe(1);
  });
});
