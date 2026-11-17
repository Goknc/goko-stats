// src/lib/engine/player-board.ts
// Maç detayı, oyuncu eşik tablosu: her oyuncunun seçilen istatistikte son N maçı kutucuk kutucuk.
// Eşiği geçen maç yeşil, geçemeyen kırmızı. Filtreler: saha (ev / deplasman), yalnızca milli takım, yalnızca ilk 11.
// Saf fonksiyonlar, veritabanı yok.

export const BOARD_STATS = [
  { key: "shotsTotal", label: "Şut", line: 1 },
  { key: "shotsOnTarget", label: "İsabetli şut", line: 1 },
  { key: "goals", label: "Gol", line: 1 },
  { key: "assists", label: "Asist", line: 1 },
  { key: "goalsAssists", label: "Gol + asist", line: 1 },
  { key: "tackles", label: "Top kapma", line: 1 },
  { key: "fouls", label: "Faul", line: 1 },
  { key: "wasFouled", label: "Maruz kaldığı faul", line: 1 },
  { key: "yellowCards", label: "Sarı kart", line: 1 },
  { key: "keyPasses", label: "Kilit pas", line: 1 },
  { key: "dribblesWon", label: "Başarılı çalım", line: 1 },
  { key: "interceptions", label: "Pas arası", line: 1 },
  { key: "clearances", label: "Uzaklaştırma", line: 2 },
  { key: "offsides", label: "Ofsayt", line: 1 },
  { key: "passesAccurate", label: "İsabetli pas", line: 30 },
  { key: "saves", label: "Kurtarış", line: 2 },
] as const;
export type BoardStat = (typeof BOARD_STATS)[number]["key"];

export const BOARD_SIZES = [5, 10, 15] as const;

export interface BoardGame {
  matchId: number;
  date: number; // zaman damgası
  isHome: boolean; // oyuncunun takımı ev sahibi miydi
  national: boolean; // milli takım maçı mı
  started: boolean; // ilk 11'de başladı mı
  minutes: number;
  teamId: number;
  opponentId: number;
  opponentName: string;
  score: string; // takımın gözünden "2-1"
  values: Partial<Record<BoardStat, number | null>>; // null / yok = bu maç için veri yok
}

export interface BoardFilter {
  stat: BoardStat;
  line: number; // eşik: değer >= line ise yeşil
  size: number; // son kaç maç
  venue: "all" | "home" | "away";
  nationalOnly: boolean;
  startsOnly: boolean;
}

export interface BoardCell {
  game: BoardGame;
  value: number | null;
  hit: boolean | null; // veri yoksa null
}

export interface BoardRow {
  cells: BoardCell[]; // en yeniden eskiye
  hits: number;
  total: number; // verisi olan maç
  rate: number | null;
}

// games: en yeniden eskiye. Filtreye uyan son `size` maç alınır; verisi olmayan maç kutucukta görünür ama sayılmaz.
export function boardRow(games: BoardGame[], f: BoardFilter): BoardRow {
  const picked = games
    .filter((g) => (f.venue === "all" || g.isHome === (f.venue === "home")) && (!f.nationalOnly || g.national) && (!f.startsOnly || g.started))
    .slice(0, f.size);
  const cells = picked.map((game) => {
    const v = game.values[f.stat];
    const value = v === undefined ? null : v;
    return { game, value, hit: value === null ? null : value >= f.line };
  });
  const counted = cells.filter((c) => c.hit !== null);
  const hits = counted.filter((c) => c.hit).length;
  return { cells, hits, total: counted.length, rate: counted.length ? hits / counted.length : null };
}
