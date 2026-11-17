// src/lib/engine/starter.ts
// Oyuncunun bir maçta ilk 11'de başlayıp başlamadığını belirler.
// Kadro bilgisi yoksa 60+ dakika oynayan ilk 11 sayılır.
export const STARTER_FALLBACK_MINUTES = 60;

export function inferStarter(input: { lineupKnown: boolean; listedAsStarter: boolean; minutesPlayed: number }): boolean {
  if (input.lineupKnown) return input.listedAsStarter;
  return input.minutesPlayed >= STARTER_FALLBACK_MINUTES;
}