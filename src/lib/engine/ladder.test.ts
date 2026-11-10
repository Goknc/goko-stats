// src/lib/engine/ladder.test.ts
import { describe, it, expect } from "vitest";
import { ladderTops } from "./ladder";

describe("Çizgi merdiveni", () => {
  it("Geçen en yüksek çizgi seçilir (Mbappé örneği: 1+ ve 2+ geçti, 3+ geçmedi)", () => {
    const tops = ladderTops([
      { statKey: "shotsOnTarget", line: 1, passes: true },
      { statKey: "shotsOnTarget", line: 2, passes: true },
      { statKey: "shotsOnTarget", line: 3, passes: false },
    ]);
    expect([...tops]).toEqual([1]);
  });

  it("Hiçbir çizgi geçmezse öneri yok", () => {
    const tops = ladderTops([
      { statKey: "tackles", line: 1, passes: false },
      { statKey: "tackles", line: 2, passes: false },
    ]);
    expect(tops.size).toBe(0);
  });

  it("Farklı istatistikler birbirinden bağımsızdır", () => {
    const tops = ladderTops([
      { statKey: "shotsOnTarget", line: 1, passes: true },
      { statKey: "tackles", line: 1, passes: true },
      { statKey: "tackles", line: 2, passes: false },
    ]);
    expect([...tops].sort()).toEqual([0, 1]);
  });

  it("Alt çizgi geçmeyip üst çizgi geçerse üst çizgi seçilir (farklı eşikler)", () => {
    const tops = ladderTops([
      { statKey: "fouls", line: 1, passes: false },
      { statKey: "fouls", line: 2, passes: true },
    ]);
    expect([...tops]).toEqual([1]);
  });
});