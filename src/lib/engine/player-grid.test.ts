// src/lib/engine/player-grid.test.ts
import { describe, it, expect } from "vitest";
import { playerGrid } from "./player-grid";

const s = (matchId: number, playerId: number, value: number, minutesPlayed = 90) => ({ matchId, playerId, name: `P${playerId}`, value, minutesPlayed });
const l = (matchId: number, playerId: number, isStarter: boolean) => ({ matchId, playerId, name: `P${playerId}`, isStarter });

describe("Takım sayfası oyuncu tablosu", () => {
  it("Oynadı / yedekte kaldı / kadroda yok ayrımı; ortalama yalnızca ilk 11 maçlarından", () => {
    const rows = playerGrid(
      [1, 2, 3, 4],
      [s(1, 10, 3), s(3, 10, 5, 30), s(4, 10, 1)],
      [l(1, 10, true), l(2, 10, false), l(3, 10, false), l(4, 10, true)],
    );
    expect(rows[0].cells.map((c) => c.kind)).toEqual(["played", "bench", "played", "played"]);
    // 3. maçta yedekten girip 5 yaptı: görünür ama ortalamaya girmez
    expect(rows[0]).toMatchObject({ apps: 3, starts: 2, total: 4, avg: 2, minutes: 180 });
    expect(rows[0].per90).toBe(2);
    // Boşluksuz liste: yalnızca süre aldığı maçlar
    expect(rows[0].played.map((p) => [p.matchId, p.started])).toEqual([[1, true], [3, false], [4, true]]);
  });

  it("Hiç ilk 11'de başlamayan oyuncunun ortalaması yok, listenin sonunda", () => {
    const rows = playerGrid([1, 2], [s(1, 10, 2, 20), s(2, 11, 0)], [l(1, 10, false), l(2, 11, true)]);
    expect(rows.map((r) => r.playerId)).toEqual([11, 10]);
    expect(rows[1].avg).toBeNull();
  });

  it("Kadrosu bilinmeyen maçta 60+ dakika ilk 11 sayılır; hiç oynamayan listelenmez", () => {
    const rows = playerGrid([1], [s(1, 10, 1, 75), s(1, 11, 0, 0)], []);
    expect(rows.map((r) => r.playerId)).toEqual([10]);
    expect(rows[0].starts).toBe(1);
  });

  it("Maç başına ortalamaya göre sıralanır", () => {
    const rows = playerGrid([1, 2], [s(1, 10, 1), s(2, 10, 1), s(1, 11, 4)], []);
    expect(rows.map((r) => r.playerId)).toEqual([11, 10]);
  });
});
