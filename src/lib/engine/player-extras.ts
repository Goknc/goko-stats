// src/lib/engine/player-extras.ts
// Detaylı oyuncu istatistikleri (pas, ikili mücadele, hava topu, ofsayt, xG...): tanımlar ve özet.
// Temel istatistiklerden (gol, şut, kart; engine/trends > PLAYER_STAT_KEYS) farklı olarak bu alanlar eski maçlarda
// boş olabilir (null); ortalamalar yalnızca verisi olan maçlardan hesaplanır. Saf fonksiyonlar, veritabanı yok.
import type { PlayerLine, PlayerStatKey } from "./trends";

export const EXTRA_KEYS = [
  "rating", "touches", "keyPasses", "passesTotal", "passesAccurate", "longBallsTotal", "longBallsAccurate",
  "crossesTotal", "crossesAccurate", "dribblesTotal", "dribblesWon", "duelsWon", "duelsLost", "aerialsWon",
  "aerialsLost", "tacklesWon", "interceptions", "clearances", "ballRecoveries", "blocks", "dispossessed",
  "possessionLost", "wasFouled", "offsides", "bigChancesCreated", "bigChancesMissed", "hitWoodwork", "xg", "xa",
  "saves", "goalsConceded",
] as const;
export type ExtraKey = (typeof EXTRA_KEYS)[number];
export type ExtraLine = Record<ExtraKey, number | null>;

export type AnyStatKey = PlayerStatKey | ExtraKey;

// Hem temel hem detaylı istatistiği okuyabilen maç
export interface StatGame {
  started: boolean;
  minutes: number;
  stats: PlayerLine;
  extras?: ExtraLine | null; // null = bu maç için detay yok
}

export const isExtraKey = (k: string): k is ExtraKey => (EXTRA_KEYS as readonly string[]).includes(k);

export function statValue(g: Pick<StatGame, "stats" | "extras">, key: AnyStatKey): number | null {
  if (isExtraKey(key)) return g.extras?.[key] ?? null;
  return g.stats[key];
}

// ---------- Özet ----------

export interface StatSummary {
  apps: number; // verisi olan maç
  starts: number; // verisi olan ilk 11 maçı
  total: number;
  perGame: number | null; // ilk 11 maçı başına (temel istatistiklerle aynı kural)
  per90: number | null; // verisi olan tüm dakikalar üzerinden
  minutes: number; // verisi olan maçlardaki dakika
}

export function summarizeStat(games: StatGame[], key: AnyStatKey): StatSummary {
  let apps = 0, starts = 0, total = 0, startTotal = 0, minutes = 0;
  for (const g of games) {
    const v = statValue(g, key);
    if (v === null) continue;
    apps++;
    total += v;
    minutes += g.minutes;
    if (g.started) {
      starts++;
      startTotal += v;
    }
  }
  return {
    apps,
    starts,
    total,
    perGame: starts ? startTotal / starts : null,
    per90: minutes ? (total / minutes) * 90 : null,
    minutes,
  };
}

// Ortalama puan: puanı olan bütün maçlar (kısa süre oynayanlara puan verilmez)
export function averageRating(games: StatGame[]): { avg: number | null; count: number } {
  const ratings = games.map((g) => g.extras?.rating ?? null).filter((r): r is number => r !== null);
  return { avg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null, count: ratings.length };
}

// İsabet oranı: başarılı / toplam (pas, orta, uzun top, çalım) ya da kazanılan / (kazanılan + kaybedilen) (ikili, hava topu)
export function successRate(games: StatGame[], won: AnyStatKey, totalOrLost: AnyStatKey, mode: "total" | "lost") {
  let w = 0, t = 0;
  for (const g of games) {
    const a = statValue(g, won);
    const b = statValue(g, totalOrLost);
    if (a === null || b === null) continue;
    w += a;
    t += mode === "total" ? b : a + b;
  }
  return { won: w, total: t, rate: t ? w / t : null };
}

// ---------- Oyuncu sayfası tablosu ----------

export type DetailRow =
  | { kind: "count"; key: AnyStatKey; label: string; decimals?: boolean }
  // "İsabetli / toplam (%)" satırı; per = sayılan başarılı sayı
  | { kind: "ratio"; label: string; won: AnyStatKey; other: AnyStatKey; mode: "total" | "lost" };

export interface DetailGroup {
  title: string;
  goalkeeper?: boolean; // yalnızca kalecilerde
  rows: DetailRow[];
}

export const DETAIL_GROUPS: DetailGroup[] = [
  {
    title: "Hücum",
    rows: [
      { kind: "count", key: "xg", label: "Beklenen gol (xG)", decimals: true },
      { kind: "count", key: "xa", label: "Beklenen asist (xA)", decimals: true },
      { kind: "count", key: "bigChancesCreated", label: "Net fırsat yarattı" },
      { kind: "count", key: "bigChancesMissed", label: "Net fırsat kaçırdı" },
      { kind: "ratio", label: "Çalım", won: "dribblesWon", other: "dribblesTotal", mode: "total" },
      { kind: "count", key: "offsides", label: "Ofsayt" },
      { kind: "count", key: "hitWoodwork", label: "Direkten dönen" },
      { kind: "count", key: "touches", label: "Topla buluşma" },
    ],
  },
  {
    title: "Pas",
    rows: [
      { kind: "ratio", label: "Pas", won: "passesAccurate", other: "passesTotal", mode: "total" },
      { kind: "count", key: "keyPasses", label: "Kilit pas" },
      { kind: "ratio", label: "Uzun top", won: "longBallsAccurate", other: "longBallsTotal", mode: "total" },
      { kind: "ratio", label: "Orta", won: "crossesAccurate", other: "crossesTotal", mode: "total" },
    ],
  },
  {
    title: "Mücadele ve savunma",
    rows: [
      { kind: "ratio", label: "İkili mücadele", won: "duelsWon", other: "duelsLost", mode: "lost" },
      { kind: "ratio", label: "Hava topu", won: "aerialsWon", other: "aerialsLost", mode: "lost" },
      { kind: "ratio", label: "Başarılı top kapma", won: "tacklesWon", other: "tackles", mode: "total" },
      { kind: "count", key: "interceptions", label: "Pas arası" },
      { kind: "count", key: "clearances", label: "Uzaklaştırma" },
      { kind: "count", key: "blocks", label: "Şut bloklama" },
      { kind: "count", key: "ballRecoveries", label: "Top kazanma" },
    ],
  },
  {
    title: "Faul ve top kaybı",
    rows: [
      { kind: "count", key: "fouls", label: "Yaptığı faul" },
      { kind: "count", key: "wasFouled", label: "Maruz kaldığı faul" },
      { kind: "count", key: "possessionLost", label: "Top kaybı" },
      { kind: "count", key: "dispossessed", label: "Top kaptırma" },
    ],
  },
  {
    title: "Kaleci",
    goalkeeper: true,
    rows: [
      { kind: "count", key: "saves", label: "Kurtarış" },
      { kind: "count", key: "goalsConceded", label: "Yenilen gol" },
    ],
  },
];

// Grafikte ve krallıkta seçilebilen detaylı sayaçlar (oran ve puan hariç)
export const EXTRA_CHART_STATS: { key: ExtraKey; label: string; goalkeeper?: boolean }[] = [
  { key: "passesTotal", label: "Pas" },
  { key: "passesAccurate", label: "İsabetli pas" },
  { key: "keyPasses", label: "Kilit pas" },
  { key: "crossesAccurate", label: "İsabetli orta" },
  { key: "dribblesWon", label: "Başarılı çalım" },
  { key: "duelsWon", label: "İkili kazanma" },
  { key: "aerialsWon", label: "Hava topu" },
  { key: "interceptions", label: "Pas arası" },
  { key: "clearances", label: "Uzaklaştırma" },
  { key: "ballRecoveries", label: "Top kazanma" },
  { key: "wasFouled", label: "Maruz kaldığı faul" },
  { key: "offsides", label: "Ofsayt" },
  { key: "possessionLost", label: "Top kaybı" },
  { key: "saves", label: "Kurtarış", goalkeeper: true },
];

// ---------- Çizgi merdiveni ----------

// Ortalamaya göre 4 çizgi: küçük değerlerde 1+, 2+, 3+, 4+; büyüklerde ortalamanın çevresinde (pas 40+, 45+...)
export function ladderLines(avg: number | null, count = 4): number[] {
  if (avg === null || avg < 3) return Array.from({ length: count }, (_, i) => i + 1);
  const step = avg >= 20 ? 5 : avg >= 8 ? 2 : 1;
  const center = Math.round(avg / step) * step;
  const first = Math.max(step, center - step * Math.floor(count / 2));
  return Array.from({ length: count }, (_, i) => first + i * step);
}
