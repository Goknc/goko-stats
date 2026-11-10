import { describe, expect, it } from "vitest";
import { rankKings, type KingTotal } from "./king-board";

const t = (playerId: number, playerName: string, total: number, matches: number, minutes = matches * 90): KingTotal => ({
  playerId, playerName, teamId: 1, teamName: "Takım", total, matches, minutes,
});

describe("rankKings", () => {
  it("toplama göre sıralar, eşitlikte az maçta yapan önde", () => {
    const rows = rankKings([t(1, "A", 5, 10), t(2, "B", 8, 12), t(3, "C", 5, 7)], 10);
    expect(rows.map((r) => r.playerId)).toEqual([2, 3, 1]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("toplam ve maç sayısı aynıysa sıra paylaşılır", () => {
    const rows = rankKings([t(1, "Ali", 4, 6), t(2, "Can", 4, 6), t(3, "Efe", 3, 6)], 10);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("sıfır toplamlı oyuncu listeye girmez, limit sıra numarasına göre keser", () => {
    const rows = rankKings([t(1, "A", 0, 5), t(2, "B", 3, 5), t(3, "C", 2, 5), t(4, "D", 2, 5)], 2);
    expect(rows.map((r) => r.playerId)).toEqual([2, 3, 4]); // 2. sıra paylaşıldığı için ikisi de girer
  });

  it("maç başı sıralama: ortalaması yüksek önde, eşitlikte toplamı yüksek", () => {
    const rows = rankKings([t(1, "A", 10, 10), t(2, "B", 6, 4), t(3, "C", 3, 2), t(4, "D", 9, 9)], 10, "perMatch");
    expect(rows.map((r) => r.playerId)).toEqual([2, 3, 1, 4]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("maç başı ve 90 dakika başı ortalama", () => {
    const [r] = rankKings([t(1, "A", 6, 4, 270)], 10);
    expect(r.perMatch).toBe(1.5);
    expect(r.per90).toBe(2);
  });
});
