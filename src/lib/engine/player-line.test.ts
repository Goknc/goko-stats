// src/lib/engine/player-line.test.ts
import { describe, it, expect } from "vitest";
import { lineHits, lineRate } from "./player-line";

describe("Oyuncu çizgisi", () => {
  it("Geçtiği maç sayısı yalnızca ilk 11 maçlarından", () => {
    const played = [
      { matchId: 1, value: 7, minutes: 90, started: true },
      { matchId: 2, value: 3, minutes: 90, started: true },
      { matchId: 3, value: 9, minutes: 20, started: false },
      { matchId: 4, value: 5, minutes: 80, started: true },
    ];
    expect(lineHits(played, 5)).toEqual({ hits: 2, total: 3 });
  });
});

describe("Çizgi oranı", () => {
  it("Çizgiyi geçtiği ilk 11 maçı ÷ ilk 11 maç; yedekten girdikleri sayılmaz", () => {
    const played = [
      { matchId: 1, value: 4, minutes: 90, started: true },
      { matchId: 2, value: 3, minutes: 90, started: true },
      { matchId: 3, value: 1, minutes: 90, started: true },
      { matchId: 4, value: 0, minutes: 80, started: true },
      { matchId: 5, value: 5, minutes: 20, started: false },
    ];
    expect(lineRate(played, 3)).toBe(0.5);
    expect(lineRate([], 3)).toBeNull();
  });
});
