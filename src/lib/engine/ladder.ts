// src/lib/engine/ladder.ts
// Çizgi merdiveni: aynı istatistikte eşiği geçen en yüksek çizgi öneri olur.
// Örnek: isabetli şut 1+ ve 2+ geçti, 3+ geçmedi → yalnızca 2+ önerilir.
export interface LadderEntry {
  statKey: string;
  line: number;
  passes: boolean;
}

// Önerilecek girdilerin indekslerini döndürür
export function ladderTops(entries: LadderEntry[]): Set<number> {
  const best = new Map<string, { line: number; index: number }>();
  entries.forEach((e, index) => {
    if (!e.passes) return;
    const current = best.get(e.statKey);
    if (!current || e.line > current.line) best.set(e.statKey, { line: e.line, index });
  });
  return new Set([...best.values()].map((b) => b.index));
}