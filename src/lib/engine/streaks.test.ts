import { describe, expect, it } from "vitest";
import { currentStreaks, streakLength } from "./streaks";
import type { StatGame } from "./player-extras";
import type { PlayerLine } from "./trends";

const g = (stats: Partial<PlayerLine> = {}, extras: StatGame["extras"] = null): StatGame => ({
  started: true,
  minutes: 90,
  stats: { goals: 0, assists: 0, shotsOnTarget: 0, shotsTotal: 0, tackles: 0, fouls: 0, yellowCards: 0, ...stats },
  extras,
});

describe("seriler", () => {
  it("en son maçtan geriye, tutmayan ilk maçta durur", () => {
    const games = [g({ goals: 1 }), g({ goals: 2 }), g({ goals: 1 }), g({ goals: 0 }), g({ goals: 1 })];
    expect(streakLength(games, "goals", 1, "over")).toBe(3);
    expect(streakLength(games, "goals", 1, "under")).toBe(0);
  });

  it("verisi olmayan maç seriyi bozmaz", () => {
    const kp = (n: number | null) => g({}, n === null ? null : ({ keyPasses: n } as StatGame["extras"]));
    expect(streakLength([kp(2), kp(null), kp(1), kp(0)], "keyPasses", 1, "over")).toBe(2);
  });

  it("3 maçtan kısa seri gösterilmez; merdivende çizgi × uzunluk büyük olan kalır", () => {
    const games = [
      g({ goals: 1, shotsTotal: 4 }),
      g({ goals: 2, shotsTotal: 4 }),
      g({ goals: 1, shotsTotal: 2 }),
      g({ goals: 1, shotsTotal: 2 }),
      g({ goals: 0, shotsTotal: 0 }),
    ];
    const texts = currentStreaks(games).map((s) => s.text);
    expect(texts).toContain("4 maçtır gol atıyor");
    expect(texts).toContain("4 maçtır 2+ şut çekiyor"); // 2+ şut 4 maç (8) > 4+ şut 2 maç
    expect(texts.some((t) => t.includes("2+ gol"))).toBe(false);
  });

  it("gol + asist serisi gol serisiyle aynıysa gösterilmez, uzunsa gösterilir", () => {
    const same = [g({ goals: 1 }), g({ goals: 1 }), g({ goals: 1 }), g()];
    expect(currentStreaks(same).map((s) => s.group)).not.toContain("ga");
    const longer = [g({ goals: 1 }), g({ assists: 1 }), g({ goals: 1 }), g({ assists: 1 }), g()];
    expect(currentStreaks(longer).find((s) => s.group === "ga")?.length).toBe(4);
  });

  it("gol kuraklığı yalnızca forvette ve 5+ maçta", () => {
    const dry = Array.from({ length: 6 }, () => g());
    expect(currentStreaks(dry, { position: "M" }).some((s) => s.group === "drought")).toBe(false);
    expect(currentStreaks(dry, { position: "F" }).find((s) => s.group === "drought")?.text).toBe("6 maçtır gol atamıyor");
  });
});
