import { describe, expect, it } from "vitest";
import { benchPer90, benchRates, topPercent, topShare, type BenchPlayer } from "./position-rank";
import { isExtraKey } from "./player-extras";

const p = (minutes: number, tackles: number, extra: Partial<BenchPlayer["extraTotals"]> = {}, extraMinutes = minutes): BenchPlayer => ({
  minutes, extraMinutes, totals: { tackles, ...extra }, extraTotals: extra,
});

describe("mevki kıyası", () => {
  it("90 dakikada değerler; az oynayan ve detayı olmayan atlanır", () => {
    expect(benchPer90([p(900, 10), p(300, 9), p(900, 20)], "tackles", isExtraKey)).toEqual([1, 2]);
    expect(benchPer90([p(900, 0, { keyPasses: 9 }, 450), p(900, 0)], "keyPasses", isExtraKey)).toEqual([1.8]);
  });

  it("oranlar en az 20 denemeden", () => {
    const rates = benchRates([p(900, 0, { aerialsWon: 15, aerialsLost: 5 }), p(900, 0, { aerialsWon: 5, aerialsLost: 5 })], "aerialsWon", "aerialsLost", "lost");
    expect(rates).toEqual([0.75]);
  });

  it("ilk yüzde: daha yüksek akranların oranı, az akranda null", () => {
    const peers = Array.from({ length: 50 }, (_, i) => i); // 0..49
    expect(topShare(peers, 47)).toBe(2 / 50);
    expect(topPercent(topShare(peers, 49)!)).toBe(1);
    expect(topShare([1, 2, 3], 3)).toBeNull();
  });
});
