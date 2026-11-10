// src/lib/engine/side.ts
// Takım trendlerinda hangi karnenin karar verdiği.
// side boş  → maç trendi (iki takım da gol, toplam gol, korner, kart): iki takımın karnesi de eşiği geçmeli.
// HOME/AWAY → takım trendi (Ev sahibi kazandı, Ev sahibi 2+ gol...): yalnızca o takımın karnesi karar verir,
//             rakibin karnesi ekranda bilgi olarak durur.

export type TrendSide = "HOME" | "AWAY";

export function isTrendSide(s: string | null | undefined): s is TrendSide {
  return s === "HOME" || s === "AWAY";
}

interface SideRate {
  rate: number | null;
  total: number;
  lowSample: boolean;
}

// Kararı veren oran(lar)
export function decidingRates<T extends SideRate>(side: TrendSide | null, home: T, away: T): T[] {
  if (side === "HOME") return [home];
  if (side === "AWAY") return [away];
  return [home, away];
}

// Önerinin gücü: kararı veren oranların en düşüğü (maç trendinda zayıf halka)
export function pickStrength<T extends SideRate>(side: TrendSide | null, home: T, away: T): T {
  return decidingRates(side, home, away).reduce((weak, s) => ((s.rate ?? 0) < (weak.rate ?? 0) ? s : weak));
}

// Bu taraf kararı veriyor mu (ekranda rakibin karnesini soluk göstermek için)
export function isDeciding(side: TrendSide | null, which: "home" | "away"): boolean {
  return side === null || (side === "HOME") === (which === "home");
}
