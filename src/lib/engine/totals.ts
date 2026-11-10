// src/lib/engine/totals.ts
// Bir maçın korner ve kart toplamı (iki takımın maç geneli satırlarından).
//
// Kart sayımı (yaygın kural): sarı kart 1, kırmızı kart 2 kart.
// İkinci sarıdan atılan oyuncu 1 + 2 = 3 kart sayılır. BSD ise o oyuncuya 2 sarı + 1 kırmızı yazar;
// düz formül 4 sayardı. Bu yüzden ikinci sarı sayısı (oyuncu istatistiklerinden) toplamdan düşülür.
export interface StatRow {
  corners: number | null;
  yellowCards: number | null;
  redCards: number | null;
  secondYellows?: number; // 2 sarı + kırmızı gören oyuncu sayısı; bilinmiyorsa 0
}

export const RED_CARD_WEIGHT = 2;

export function teamCards(r: StatRow): number | null {
  if (r.yellowCards === null) return null;
  // Spike B5: kırmızı kart yoksa null gelir, 0 sayılır
  return r.yellowCards + RED_CARD_WEIGHT * (r.redCards ?? 0) - (r.secondYellows ?? 0);
}

export function matchTotals(rows: StatRow[]): { totalCorners: number | null; totalCards: number | null } {
  if (rows.length !== 2) return { totalCorners: null, totalCards: null };
  const corners = rows.every((r) => r.corners !== null) ? rows.reduce((s, r) => s + r.corners!, 0) : null;
  const cards = rows.every((r) => r.yellowCards !== null) ? rows.reduce((s, r) => s + teamCards(r)!, 0) : null;
  return { totalCorners: corners, totalCards: cards };
}