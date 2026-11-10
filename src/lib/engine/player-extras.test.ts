import { describe, expect, it } from "vitest";
import { averageRating, ladderLines, successRate, summarizeStat, type ExtraLine, type StatGame } from "./player-extras";

const base = { goals: 1, assists: 0, shotsOnTarget: 0, shotsTotal: 0, tackles: 0, fouls: 0, yellowCards: 0 };
const g = (extras: Partial<ExtraLine> | null, o: Partial<StatGame> = {}): StatGame => ({
  started: true, minutes: 90, stats: base, extras: extras as ExtraLine | null, ...o,
});

describe("detaylı istatistikler", () => {
  it("özet yalnızca verisi olan maçlardan; maç başı ilk 11, 90 dk tüm dakikalar", () => {
    const s = summarizeStat([g({ keyPasses: 2 }), g({ keyPasses: 1 }, { started: false, minutes: 30 }), g(null)], "keyPasses");
    expect(s).toMatchObject({ apps: 2, starts: 1, total: 3, perGame: 2 });
    expect(s.per90).toBeCloseTo((3 / 120) * 90);
  });

  it("temel istatistik de okunur", () => {
    expect(summarizeStat([g(null), g(null)], "goals").total).toBe(2);
  });

  it("isabet oranı: toplam ya da kazanılan + kaybedilen", () => {
    expect(successRate([g({ passesAccurate: 30, passesTotal: 40 }), g(null)], "passesAccurate", "passesTotal", "total")).toEqual({
      won: 30, total: 40, rate: 0.75,
    });
    expect(successRate([g({ aerialsWon: 3, aerialsLost: 1 })], "aerialsWon", "aerialsLost", "lost").rate).toBe(0.75);
  });

  it("ortalama puan puansız maçları atlar", () => {
    expect(averageRating([g({ rating: 7 }), g({ rating: 8 }), g({ rating: null }), g(null)])).toEqual({ avg: 7.5, count: 2 });
  });

  it("çizgi merdiveni ortalamaya göre", () => {
    expect(ladderLines(1.2)).toEqual([1, 2, 3, 4]);
    expect(ladderLines(4.4)).toEqual([2, 3, 4, 5]);
    expect(ladderLines(43)).toEqual([35, 40, 45, 50]);
  });
});
