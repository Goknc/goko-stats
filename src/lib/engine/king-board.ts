// src/lib/engine/king-board.ts
// Krallık tablosu: oyuncunun sezon toplamına ya da maç başı ortalamasına göre sıralama.
// Saf fonksiyon, veritabanı yok. Maç başı sıralamada az maçlık oyuncular öne geçmesin diye en az maç şartı
// sorguda uygulanır (bkz. kings.ts). Eşitlikte daha az maçta yapan önde; sıra numarası paylaşılır (1, 2, 2, 4).

export type KingSort = "total" | "perMatch";

export interface KingTotal {
  playerId: number;
  playerName: string;
  teamId: number | null;
  teamName: string;
  total: number;
  matches: number; // süre aldığı (ve verisi olan) maç
  minutes: number;
  position?: string | null; // G, D, M, F
  specificPosition?: string | null; // ST, CB...
}

export interface KingRow extends KingTotal {
  rank: number;
  perMatch: number;
  per90: number;
}

export function kingMetric(r: Pick<KingRow, "total" | "perMatch">, sort: KingSort): number {
  return sort === "total" ? r.total : r.perMatch;
}

// Ondalıklı istatistiklerde (xG) kayan nokta farkı eşitliği bozmasın
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export function rankKings(totals: KingTotal[], limit: number, sort: KingSort = "total"): KingRow[] {
  const withAvg = totals
    .filter((t) => t.total > 0)
    .map((t) => ({
      ...t,
      perMatch: t.matches ? t.total / t.matches : 0,
      per90: t.minutes ? (t.total / t.minutes) * 90 : 0,
    }));
  const sorted = withAvg.sort(
    (a, b) =>
      kingMetric(b, sort) - kingMetric(a, sort) ||
      b.total - a.total ||
      a.matches - b.matches ||
      a.playerName.localeCompare(b.playerName, "tr"),
  );

  const rows: KingRow[] = [];
  for (const [i, t] of sorted.entries()) {
    const prev = sorted[i - 1];
    const tied = prev && same(kingMetric(prev, sort), kingMetric(t, sort)) && same(prev.total, t.total) && prev.matches === t.matches;
    const rank = tied ? rows[i - 1].rank : i + 1;
    if (rank > limit) break;
    rows.push({ ...t, rank });
  }
  return rows;
}
