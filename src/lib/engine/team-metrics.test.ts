// src/lib/engine/team-metrics.test.ts
import { describe, it, expect } from "vitest";
import { teamMetrics, metricOf, linesAround, type TeamMatch, type PeriodStat } from "./team-metrics";

const T = 1;
const stat = (teamId: number, period: PeriodStat["period"], corners: number, yellow = 1, red = 0): PeriodStat => ({
  teamId, period, corners, yellowCards: yellow, redCards: red, shotsTotal: 10, shotsOnTarget: 4, fouls: 12,
});
const match = (id: number, home: boolean, score: [number, number], ht: [number, number], type = "LEAGUE", stats: PeriodStat[] = []): TeamMatch => ({
  id,
  eventDate: new Date(2026, 9, 30 - id),
  competition: "Lig",
  competitionType: type,
  homeTeamId: home ? T : 99,
  awayTeamId: home ? 99 : T,
  homeName: home ? "Biz" : "Rakip",
  awayName: home ? "Rakip" : "Biz",
  homeScore: score[0],
  awayScore: score[1],
  homeScoreHt: ht[0],
  awayScoreHt: ht[1],
  stats,
});

describe("Takım sayfası istatistikleri", () => {
  it("Gol: deplasmanda takımın golü kendi tarafından okunur; 2. yarı = maç − ilk yarı", () => {
    const m = match(1, false, [1, 3], [0, 1]);
    expect(metricOf(m, T, "goals", "FULL")).toEqual({ for: 3, against: 1 });
    expect(metricOf(m, T, "goals", "H1")).toEqual({ for: 1, against: 0 });
    expect(metricOf(m, T, "goals", "H2")).toEqual({ for: 2, against: 1 });
  });

  it("Korner ve kart detay satırından; kırmızı 2 kart sayılır; veri yoksa maç atlanır", () => {
    const withStats = match(1, true, [1, 0], [0, 0], "LEAGUE", [stat(T, "FULL", 7, 2, 1), stat(99, "FULL", 3)]);
    expect(metricOf(withStats, T, "corners", "FULL")).toEqual({ for: 7, against: 3 });
    expect(metricOf(withStats, T, "cards", "FULL")).toEqual({ for: 4, against: 1 });
    expect(metricOf(withStats, T, "corners", "H1")).toBeNull();
  });

  it("Filtreler, son N ve sonuç karnesi", () => {
    const ms = [
      match(1, true, [2, 1], [1, 0]),
      match(2, false, [0, 0], [0, 0]),
      match(3, true, [1, 3], [0, 2], "EUROPE"),
      match(4, true, [3, 1], [2, 1]),
    ];
    const home = teamMetrics(ms, T, { category: "goals", period: "FULL", venue: "home", comp: "all", last: 2 });
    expect(home.rows.map((r) => r.match.id)).toEqual([1, 3]);
    expect(home.record).toEqual({ W: 1, D: 0, L: 1 });
    expect(home.avgTotal).toBe(3.5);

    const league = teamMetrics(ms, T, { category: "goals", period: "FULL", venue: "all", comp: "league", last: 10 });
    expect(league.rows.map((r) => r.match.id)).toEqual([1, 2, 4]);
  });

  it("Çizgiler ortalamanın çevresinde, tutma sayısı 'üst' olarak", () => {
    expect(linesAround(2.7)).toEqual([0.5, 1.5, 2.5]);
    expect(linesAround(0.4)).toEqual([0.5]);
    const r = teamMetrics([match(1, true, [2, 1], [0, 0]), match(2, true, [0, 0], [0, 0])], T, {
      category: "goals", period: "FULL", venue: "all", comp: "all", last: 10,
    });
    expect(r.totalLines).toEqual([{ line: 0.5, hits: 1, total: 2 }, { line: 1.5, hits: 1, total: 2 }]); // ort. 1.5
  });
});

describe("Grafik çizgisi", () => {
  it("Başlangıç çizgisi ortalamanın altındaki en yakın .5", async () => {
    const { defaultLine, lineHitRate } = await import("./team-metrics");
    expect(defaultLine(3.15)).toBe(2.5);
    expect(defaultLine(0.3)).toBe(0.5);
    expect(defaultLine(null)).toBe(0.5);
    expect(lineHitRate([3, 0, 2, 1], 1.5, "over")).toEqual({ line: 1.5, hits: 2, total: 4 });
    expect(lineHitRate([3, 0, 2, 1], 1.5, "under")).toEqual({ line: 1.5, hits: 2, total: 4 });
  });
});
