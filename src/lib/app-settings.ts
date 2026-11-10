// src/lib/app-settings.ts
// Analiz örneğinin varsayılanları ve adres çubuğundan gelen seçimin doğrulanması.
// Kullanıcı her sayfada farklı bir seçim yapabilir (?n=10&team=venue&player=all); kayıt tutulmaz.

// Form türü: "venue" = maçtaki sahası (ev sahibinin iç saha, deplasmanın dış saha maçları); "all" = tüm maçlar
export const SAMPLE_MODES = ["venue", "all"] as const;
export type SampleMode = (typeof SAMPLE_MODES)[number];

export const isSampleMode = (v: unknown): v is SampleMode => (SAMPLE_MODES as readonly unknown[]).includes(v);

export interface SampleSettings {
  size: number; // takım ve oyuncu karnelerinde bakılan son maç sayısı
  teamMode: SampleMode;
  playerMode: SampleMode;
}

export const SAMPLE_SIZE = { min: 5, max: 30 } as const;

export const DEFAULT_SAMPLE: SampleSettings = { size: 20, teamMode: "all", playerMode: "all" };

// Adres çubuğundaki seçim; geçersiz ya da eksik alan varsayılanı alır
export function sampleFromParams(
  params: { n?: string; team?: string; player?: string },
  defaults: SampleSettings = DEFAULT_SAMPLE,
): SampleSettings {
  const n = Number(params.n);
  return {
    size: Number.isInteger(n) && n >= SAMPLE_SIZE.min && n <= SAMPLE_SIZE.max ? n : defaults.size,
    teamMode: isSampleMode(params.team) ? params.team : defaults.teamMode,
    playerMode: isSampleMode(params.player) ? params.player : defaults.playerMode,
  };
}
