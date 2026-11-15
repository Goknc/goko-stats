// src/lib/app-settings.ts
// Analiz örneğinin varsayılanları ve adres çubuğundan gelen seçimin doğrulanması.
// Kullanıcı her sayfada farklı bir seçim yapabilir (?n=10&team=venue&player=all&esik=70); kayıt tutulmaz.

// Form türü: "venue" = maçtaki sahası (ev sahibinin iç saha, deplasmanın dış saha maçları); "all" = tüm maçlar
export const SAMPLE_MODES = ["venue", "all"] as const;
export type SampleMode = (typeof SAMPLE_MODES)[number];

export const isSampleMode = (v: unknown): v is SampleMode => (SAMPLE_MODES as readonly unknown[]).includes(v);

export interface SampleSettings {
  size: number; // takım ve oyuncu karnelerinde bakılan son maç sayısı
  teamMode: SampleMode;
  playerMode: SampleMode;
  // Öne çıkma eşiği, yüzde (60 = %60). null = varsayılan: her istatistiğin kendi eşiği (bkz. trend-config)
  threshold: number | null;
}

export const SAMPLE_SIZE = { min: 5, max: 30 } as const;
export const THRESHOLD_OPTIONS = [50, 60, 70, 80, 90] as const;

export const DEFAULT_SAMPLE: SampleSettings = { size: 20, teamMode: "all", playerMode: "all", threshold: null };

export const isDefaultSample = (s: SampleSettings, defaults: SampleSettings = DEFAULT_SAMPLE) =>
  s.size === defaults.size && s.teamMode === defaults.teamMode && s.playerMode === defaults.playerMode && s.threshold === defaults.threshold;

// Adres çubuğundaki seçim; geçersiz ya da eksik alan varsayılanı alır
export function sampleFromParams(
  params: { n?: string; team?: string; player?: string; esik?: string },
  defaults: SampleSettings = DEFAULT_SAMPLE,
): SampleSettings {
  const n = Number(params.n);
  const t = Number(params.esik);
  return {
    size: Number.isInteger(n) && n >= SAMPLE_SIZE.min && n <= SAMPLE_SIZE.max ? n : defaults.size,
    teamMode: isSampleMode(params.team) ? params.team : defaults.teamMode,
    playerMode: isSampleMode(params.player) ? params.player : defaults.playerMode,
    threshold: (THRESHOLD_OPTIONS as readonly number[]).includes(t) ? t : defaults.threshold,
  };
}

// Seçimi adres çubuğu parametrelerine çevirir; varsayılan değerler yazılmaz
export function sampleParams(s: SampleSettings, defaults: SampleSettings = DEFAULT_SAMPLE): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.size !== defaults.size) out.n = String(s.size);
  if (s.teamMode !== defaults.teamMode) out.team = s.teamMode;
  if (s.playerMode !== defaults.playerMode) out.player = s.playerMode;
  if (s.threshold !== defaults.threshold && s.threshold !== null) out.esik = String(s.threshold);
  return out;
}

// Seçimden analiz seçenekleri (varsayılansa boş: önbellek anahtarı ortak kalır)
export function analysisOptions(s: SampleSettings, defaults: SampleSettings = DEFAULT_SAMPLE) {
  return {
    ...(s.size !== defaults.size ? { maxMatches: s.size } : {}),
    ...(s.teamMode !== defaults.teamMode ? { teamMode: s.teamMode } : {}),
    ...(s.playerMode !== defaults.playerMode ? { playerMode: s.playerMode } : {}),
    ...(s.threshold !== null ? { threshold: s.threshold / 100 } : {}),
  };
}
