// src/lib/engine/totals.test.ts
import { describe, it, expect } from "vitest";
import { matchTotals, teamCards } from "./totals";

describe("Maç toplamları", () => {
  it("İki takımın korner ve kartları toplanır, kırmızı kart null ise 0 sayılır", () => {
    const totals = matchTotals([
      { corners: 6, yellowCards: 2, redCards: null },
      { corners: 4, yellowCards: 3, redCards: 1 },
    ]);
    // Kartlar: 2 + (3 + 2·1) = 7
    expect(totals).toEqual({ totalCorners: 10, totalCards: 7 });
  });

  it("Bir takımın verisi eksikse toplam bilinmez", () => {
    expect(matchTotals([{ corners: 6, yellowCards: 2, redCards: 0 }])).toEqual({ totalCorners: null, totalCards: null });
    const partial = matchTotals([
      { corners: null, yellowCards: 2, redCards: 0 },
      { corners: 4, yellowCards: 1, redCards: 0 },
    ]);
    expect(partial.totalCorners).toBeNull();
    expect(partial.totalCards).toBe(3);
  });
});

// BSD'deki gerçek kayıt biçimleri (player_match_stats sorgusu, 13 Ekim) ve beklenen toplamlar
describe("Kart sayımı (sarı 1, kırmızı 2)", () => {
  it("direkt kırmızı = 2 kart (BSD: 0 sarı, 1 kırmızı)", () => {
    expect(teamCards({ corners: 0, yellowCards: 0, redCards: 1 })).toBe(2);
  });

  it("sarı + direkt kırmızı = 3 kart (BSD: 1 sarı, 1 kırmızı)", () => {
    expect(teamCards({ corners: 0, yellowCards: 1, redCards: 1 })).toBe(3);
  });

  it("ikinci sarıdan kırmızı = 3 kart (BSD: 2 sarı, 1 kırmızı → bir sarı düşülür)", () => {
    expect(teamCards({ corners: 0, yellowCards: 2, redCards: 1, secondYellows: 1 })).toBe(3);
  });

  it("ikinci sarı bilgisi yoksa düz formül (S + 2K)", () => {
    expect(teamCards({ corners: 0, yellowCards: 2, redCards: 1 })).toBe(4);
  });

  it("karışık takım: 3 sarılık oyuncu + ikinci sarıdan atılan oyuncu", () => {
    // Oyuncular: A sarı, B sarı, C 2 sarı + kırmızı → 1 + 1 + 3 = 5
    expect(teamCards({ corners: 0, yellowCards: 4, redCards: 1, secondYellows: 1 })).toBe(5);
  });

  it("maç toplamında iki takımın düzeltmeleri ayrı ayrı uygulanır", () => {
    const totals = matchTotals([
      { corners: 5, yellowCards: 2, redCards: 1, secondYellows: 1 }, // 3
      { corners: 5, yellowCards: 1, redCards: 1 }, // 3
    ]);
    expect(totals.totalCards).toBe(6);
  });
});