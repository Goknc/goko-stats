// src/lib/engine/position-rank.ts
// Mevki kıyası: oyuncunun 90 dakikadaki değeri (ya da isabet oranı) aynı mevkideki oyuncular arasında nerede?
// "Forvetlerin ilk %8'i" → bu mevkideki oyuncuların yalnızca %8'i daha yüksek. Saf fonksiyonlar, veritabanı yok.
import type { AnyStatKey } from "./player-extras";

// Mevkideki bir oyuncunun güncel sezon toplamları
export interface BenchPlayer {
  minutes: number; // tüm maçlar
  extraMinutes: number; // detaylı verisi olan maçlar
  totals: Partial<Record<AnyStatKey, number>>; // temel istatistik: tüm maçlar, detaylı: verisi olan maçlar
  extraTotals: Partial<Record<AnyStatKey, number>>; // her istatistik yalnızca detaylı verisi olan maçlardan (oranlar için)
}

export const MIN_MINUTES = 450; // kıyasa girmek için (5 maç)
export const MIN_ATTEMPTS = 20; // oranlarda en az deneme (pas, ikili, hava topu...)
export const MIN_PEERS = 20; // mevkide bu kadar oyuncu yoksa kıyas yapılmaz
export const TOP_SHARE = 0.2; // ilk %20 vurgulanır

// Azı iyi olan istatistikler: güçlü yön olarak vurgulanmaz
export const LOWER_IS_BETTER = new Set<AnyStatKey>(["fouls", "possessionLost", "dispossessed", "bigChancesMissed", "goalsConceded", "yellowCards"]);

export function benchPer90(players: BenchPlayer[], key: AnyStatKey, isExtra: (k: AnyStatKey) => boolean): number[] {
  const out: number[] = [];
  for (const p of players) {
    const mins = isExtra(key) ? p.extraMinutes : p.minutes;
    const total = p.totals[key];
    if (mins < MIN_MINUTES || total === undefined) continue;
    out.push((total / mins) * 90);
  }
  return out;
}

export function benchRates(players: BenchPlayer[], won: AnyStatKey, other: AnyStatKey, mode: "total" | "lost"): number[] {
  const out: number[] = [];
  for (const p of players) {
    const w = p.extraTotals[won];
    const o = p.extraTotals[other];
    if (w === undefined || o === undefined) continue;
    const attempts = mode === "total" ? o : w + o;
    if (attempts < MIN_ATTEMPTS) continue;
    out.push(w / attempts);
  }
  return out;
}

// Oyuncudan yüksek değerli akranların oranı (0 = en iyisi). Az akran varsa ya da oyuncunun değeri 0 ise null
// (herkesin 0 olduğu istatistikte 0 değerli oyuncu "ilk %1" görünmesin).
export function topShare(peers: number[], value: number): number | null {
  if (peers.length < MIN_PEERS || value <= 0) return null;
  const above = peers.filter((v) => v > value + 1e-9).length;
  return above / peers.length;
}

// "ilk %8" metni için yüzde (en az 1)
export const topPercent = (share: number) => Math.max(1, Math.ceil(share * 100));
