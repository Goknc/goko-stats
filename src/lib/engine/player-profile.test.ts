// src/lib/engine/player-profile.test.ts
import { describe, it, expect } from "vitest";
import { filterGames, summarize, lineHits, highlights, type ProfileGame } from "./player-profile";

const line = (o: Partial<ProfileGame["stats"]> = {}) => ({
  goals: 0, assists: 0, shotsOnTarget: 0, shotsTotal: 0, tackles: 0, fouls: 0, yellowCards: 0, ...o,
});
const game = (id: number, o: Partial<ProfileGame> = {}, stats: Partial<ProfileGame["stats"]> = {}): ProfileGame => ({
  matchId: id, date: id * 1000, isHome: id % 2 === 0, started: true, minutes: 90, competitionType: "LEAGUE", stats: line(stats), ...o,
});

describe("Oyuncu profili", () => {
  it("filtre: en yeniden eskiye, saha ve turnuva, son N", () => {
    const games = [game(1), game(2), game(3, { competitionType: "EUROPE" }), game(4), game(5)];
    expect(filterGames(games, { venue: "all", comp: "all", last: 3 }).map((g) => g.matchId)).toEqual([5, 4, 3]);
    expect(filterGames(games, { venue: "home", comp: "all", last: 10 }).map((g) => g.matchId)).toEqual([4, 2]);
    expect(filterGames(games, { venue: "all", comp: "europe", last: 10 }).map((g) => g.matchId)).toEqual([3]);
  });

  it("özet: maç başı yalnızca ilk 11'den, 90 dakikada tüm dakikalardan", () => {
    const s = summarize([
      game(1, {}, { goals: 2 }),
      game(2, {}, { goals: 0 }),
      game(3, { started: false, minutes: 30 }, { goals: 1 }),
    ]);
    expect(s.apps).toBe(3);
    expect(s.starts).toBe(2);
    expect(s.minutes).toBe(210);
    expect(s.totals.goals).toBe(3);
    expect(s.perGame.goals).toBe(1);
    expect(s.per90.goals).toBeCloseTo((3 / 210) * 90);
  });

  it("çizgi isabetleri: görülmeyen çizgide durur, yedekten girdiği maç sayılmaz", () => {
    const games = [
      game(1, {}, { shotsTotal: 3 }),
      game(2, {}, { shotsTotal: 1 }),
      game(3, { started: false }, { shotsTotal: 5 }),
    ];
    expect(lineHits(games, "shotsTotal")).toEqual([
      { line: 1, hits: 2, total: 2 },
      { line: 2, hits: 1, total: 2 },
      { line: 3, hits: 1, total: 2 },
    ]);
  });

  it("öne çıkanlar: istatistik başına geçen en yüksek çizgi, geçenler önde", () => {
    const games = Array.from({ length: 6 }, (_, i) => game(i + 1, {}, { shotsTotal: i < 5 ? 4 : 1, goals: i < 2 ? 1 : 0 }));
    const defs = [
      { code: "S3", name: "Şut 3+", statKey: "shotsTotal" as const, line: 3, threshold: 0.6 },
      { code: "S4", name: "Şut 4+", statKey: "shotsTotal" as const, line: 4, threshold: 0.6 },
      { code: "G1", name: "Gol 1+", statKey: "goals" as const, line: 1, threshold: 0.6 },
    ];
    const h = highlights(games, defs);
    expect(h.map((x) => x.code)).toEqual(["S4", "G1"]);
    expect(h[0]).toMatchObject({ hits: 5, total: 6, passes: true });
    expect(h[1].passes).toBe(false);
  });

  it("öne çıkanlar: az ilk 11 maçında boş", () => {
    expect(highlights([game(1), game(2)], [{ code: "G1", name: "Gol", statKey: "goals", line: 1, threshold: 0.5 }])).toEqual([]);
  });
});
