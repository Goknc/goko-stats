// src/lib/engine/h2h-players.test.ts
import { describe, it, expect } from "vitest";
import { summarizeH2HPlayers, type H2HPlayerLine } from "./h2h-players";

const HOME = 1;
const AWAY = 2;
const line = (matchId: number, playerId: number, teamId: number, goals: number, assists = 0, minutesPlayed = 90): H2HPlayerLine => ({
  matchId, playerId, name: `P${playerId}`, teamId, goals, assists, minutesPlayed,
});

describe("Aralarındaki maçlarda öne çıkan oyuncular", () => {
  const current = new Map([[10, HOME], [11, HOME], [20, AWAY], [30, AWAY]]);

  it("En az 2 maçta gol ya da asist yapan oyuncular listelenir", () => {
    const r = summarizeH2HPlayers(
      [line(1, 10, HOME, 1), line(2, 10, HOME, 2), line(3, 10, HOME, 0), line(1, 11, HOME, 3), line(1, 20, AWAY, 0, 1), line(2, 20, AWAY, 0, 1)],
      3, HOME, AWAY, current,
    );
    expect(r.home.map((p) => p.playerId)).toEqual([10]); // 11 tek maçta 3 gol: yeterli değil
    expect(r.home[0]).toMatchObject({ games: 3, goals: 3, goalGames: 2 });
    expect(r.away.map((p) => p.playerId)).toEqual([20]);
  });

  it("Takımdan ayrılan oyuncu sayılmaz", () => {
    const r = summarizeH2HPlayers([line(1, 30, HOME, 1), line(2, 30, HOME, 1)], 2, HOME, AWAY, current);
    expect(r.home).toEqual([]); // 30 artık deplasman takımında
    expect(r.away).toEqual([]);
  });

  it("Süre almadığı maç sayılmaz", () => {
    const r = summarizeH2HPlayers([line(1, 10, HOME, 1), line(2, 10, HOME, 1, 0, 0)], 2, HOME, AWAY, current);
    expect(r.home).toEqual([]);
  });
});
