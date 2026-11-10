// src/lib/engine/score.test.ts
import { describe, it, expect } from "vitest";
import { confidenceScore } from "./score";

describe("Sıralama puanı (küçük örnek cezası)", () => {
  it("Daha büyük örnekli güçlü oran, küçük örnekli orandan önce gelir", () => {
    expect(confidenceScore(9, 10)).toBeGreaterThan(confidenceScore(6, 7));
    expect(confidenceScore(10, 10)).toBeGreaterThan(confidenceScore(7, 8));
  });

  it("Aynı ham oranda büyük örnek daha yüksek puan alır", () => {
    // ikisi de %80
    expect(confidenceScore(8, 10)).toBeGreaterThan(confidenceScore(4, 5));
  });

  it("Konuştuğumuz örnek değerler", () => {
    expect(confidenceScore(6, 7)).toBeCloseTo(7 / 9);
    expect(confidenceScore(9, 10)).toBeCloseTo(10 / 12);
  });

  it("Boş örnek tarafsız puan alır (%50)", () => {
    expect(confidenceScore(0, 0)).toBe(0.5);
  });
});