import { describe, expect, it } from "vitest";
import { boardRow, type BoardFilter, type BoardGame } from "./player-board";

const g = (matchId: number, shots: number | null, extra: Partial<BoardGame> = {}): BoardGame => ({
  matchId,
  date: 1000 - matchId,
  isHome: true,
  national: false,
  started: true,
  minutes: 90,
  teamId: 1,
  opponentId: 2,
  opponentName: "Rakip",
  score: "1-0",
  values: { shotsTotal: shots },
  ...extra,
});

const base: BoardFilter = { stat: "shotsTotal", line: 2, size: 5, venue: "all", nationalOnly: false, startsOnly: false };

describe("Oyuncu eşik tablosu", () => {
  it("Son N maçta eşiği geçenleri sayar, en yeni maç önde kalır", () => {
    const r = boardRow([g(1, 3), g(2, 1), g(3, 2), g(4, 0), g(5, 4), g(6, 5)], base);
    expect(r.cells.map((c) => c.game.matchId)).toEqual([1, 2, 3, 4, 5]);
    expect(r.cells.map((c) => c.hit)).toEqual([true, false, true, false, true]);
    expect(r).toMatchObject({ hits: 3, total: 5, rate: 0.6 });
  });

  it("Verisi olmayan maç görünür ama sayılmaz", () => {
    const r = boardRow([g(1, 3), g(2, null), g(3, 0)], base);
    expect(r.cells[1]).toMatchObject({ value: null, hit: null });
    expect(r).toMatchObject({ hits: 1, total: 2 });
  });

  it("Saha, milli takım ve ilk 11 filtreleri maçları önceden süzer", () => {
    const games = [
      g(1, 3, { isHome: false }),
      g(2, 3, { national: true }),
      g(3, 0, { started: false, national: true }),
      g(4, 2, { isHome: false, national: true }),
    ];
    expect(boardRow(games, { ...base, venue: "away" }).cells.map((c) => c.game.matchId)).toEqual([1, 4]);
    expect(boardRow(games, { ...base, nationalOnly: true }).cells.map((c) => c.game.matchId)).toEqual([2, 3, 4]);
    expect(boardRow(games, { ...base, nationalOnly: true, startsOnly: true })).toMatchObject({ hits: 2, total: 2, rate: 1 });
  });

  it("Hiç maç yoksa oran boş", () => {
    expect(boardRow([], base)).toEqual({ cells: [], hits: 0, total: 0, rate: null });
  });
});
