// src/lib/engine/player-line.ts
// Takım ve oyuncu sayfası: oyuncunun bir çizgiyi (3+ şut gibi) ilk 11 maçlarının kaçında geçtiği. Saf fonksiyon.
import type { PlayedMatch } from "./player-grid";


// İlk 11 maçlarında çizgiyi geçtiği maç sayısı (ortalamayla aynı kural: yedekten girdikleri sayılmaz)
export function lineHits(played: PlayedMatch[], line: number): { hits: number; total: number } {
  const starts = played.filter((p) => p.started);
  return { hits: starts.filter((p) => p.value >= line).length, total: starts.length };
}

// İstatistiğin varsayılan çizgisi (Top kapma 3+, İsabetli şut 2+...)
export const DEFAULT_PLAYER_LINES: Record<string, number> = {
  goals: 1,
  assists: 1,
  shotsOnTarget: 2,
  shotsTotal: 3,
  tackles: 3,
  fouls: 2,
  yellowCards: 1,
};

// "İsabet": çizgiyi geçtiği ilk 11 maçı ÷ ilk 11 maç sayısı (0–1 arası). 3+ top kapmayı 10 maçın 3'ünde geçtiyse 0,3.
export function lineRate(played: PlayedMatch[], line: number): number | null {
  const { hits, total } = lineHits(played, line);
  return total ? hits / total : null;
}
