// src/lib/engine/rate.ts
// Bir örnek (maç listesi) üzerinde bir kuralın tutma oranını hesaplar.
import type { Outcome } from "./trends";

export interface Evidence<T> {
  item: T;
  outcome: Outcome;
}

export interface RateResult<T> {
  hits: number; // tutan maç sayısı
  total: number; // verisi olan maç sayısı (payda)
  rate: number | null; // hits / total, örnek boşsa null
  evidence: Evidence<T>[]; // ekrandaki kanıt listesi (veri olmayanlar dahil)
}

export function computeRate<T>(sample: T[], rule: (item: T) => Outcome): RateResult<T> {
  let hits = 0;
  let total = 0;
  const evidence = sample.map((item) => {
    const outcome = rule(item);
    if (outcome !== null) {
      total++;
      if (outcome) hits++;
    }
    return { item, outcome };
  });
  return { hits, total, rate: total > 0 ? hits / total : null, evidence };
}