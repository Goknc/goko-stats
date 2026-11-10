// src/lib/engine/player-grid.ts
// Takım sayfası oyuncu tablosu: satırda oyuncu, sütunda maç, hücrede seçilen istatistik ve dakika.
// Ortalamalar yalnızca ilk 11'de başladığı maçlardan (öne çıkanlardaki örnek kuralıyla aynı);
// yedekten girdiği maçlar görünür ama hesaba katılmaz. Saf fonksiyon, veritabanı yok.

export const PLAYER_GRID_STATS = [
  { key: "goals", label: "Gol" },
  { key: "assists", label: "Asist" },
  { key: "shotsTotal", label: "Şut" },
  { key: "shotsOnTarget", label: "İsabetli şut" },
  { key: "tackles", label: "Top kapma" },
  { key: "fouls", label: "Faul" },
  { key: "yellowCards", label: "Sarı kart" },
] as const;
export type GridStat = (typeof PLAYER_GRID_STATS)[number]["key"];

export interface GridStatLine {
  matchId: number;
  playerId: number;
  name: string;
  minutesPlayed: number;
  value: number;
}

export interface GridLineup {
  matchId: number;
  playerId: number;
  name: string;
  isStarter: boolean;
}

export type GridCell =
  | { kind: "played"; value: number; minutes: number; started: boolean }
  | { kind: "bench" } // kadroda, oynamadı
  | { kind: "none" }; // kadroda değil / veri yok

export interface PlayedMatch {
  matchId: number;
  value: number;
  minutes: number;
  started: boolean;
}

export interface GridRow {
  playerId: number;
  name: string;
  cells: GridCell[]; // matchIds sırasıyla
  played: PlayedMatch[]; // yalnızca süre aldığı maçlar, en yeniden eskiye (boşluksuz liste için)
  apps: number; // süre aldığı maç (yedekten girdikleri dahil)
  starts: number; // ilk 11'de başladığı maç: ortalamalar bunlardan
  total: number; // ilk 11 maçlarında toplam
  minutes: number; // ilk 11 maçlarında toplam dakika
  avg: number | null; // ilk 11 maçı başına; hiç başlamadıysa null
  per90: number | null; // toplam 90 dakikadan azsa null
}

// matchIds: sütun sırası (en yeniden eskiye). Lineup bilinmeyen maçta 60+ dakika ilk 11 sayılır.
export function playerGrid(matchIds: number[], stats: GridStatLine[], lineups: GridLineup[]): GridRow[] {
  const statOf = new Map(stats.map((s) => [`${s.matchId}-${s.playerId}`, s]));
  const lineupOf = new Map(lineups.map((l) => [`${l.matchId}-${l.playerId}`, l]));
  const lineupKnown = new Set(lineups.map((l) => l.matchId));
  const names = new Map<number, string>();
  for (const l of lineups) names.set(l.playerId, l.name);
  for (const s of stats) names.set(s.playerId, s.name);

  const rows: GridRow[] = [];
  for (const [playerId, name] of names) {
    const cells: GridCell[] = matchIds.map((matchId) => {
      const s = statOf.get(`${matchId}-${playerId}`);
      const l = lineupOf.get(`${matchId}-${playerId}`);
      if (s && s.minutesPlayed > 0) {
        const started = lineupKnown.has(matchId) ? !!l?.isStarter : s.minutesPlayed >= 60;
        return { kind: "played", value: s.value, minutes: s.minutesPlayed, started };
      }
      return s || l ? { kind: "bench" } : { kind: "none" };
    });
    const played = cells.filter((c): c is Extract<GridCell, { kind: "played" }> => c.kind === "played");
    if (!played.length) continue;
    const started = played.filter((c) => c.started);
    const total = started.reduce((sum, c) => sum + c.value, 0);
    const minutes = started.reduce((sum, c) => sum + c.minutes, 0);
    rows.push({
      playerId,
      name,
      cells,
      played: cells.flatMap((c, i) => (c.kind === "played" ? [{ matchId: matchIds[i], value: c.value, minutes: c.minutes, started: c.started }] : [])),
      apps: played.length,
      starts: started.length,
      total,
      minutes,
      avg: started.length ? total / started.length : null,
      per90: minutes >= 90 ? (total / minutes) * 90 : null,
    });
  }
  // İlk 11 ortalamasına göre; hiç başlamayanlar en sonda. Eşitse çok başlayan önde.
  return rows.sort(
    (a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.starts - a.starts || b.apps - a.apps || a.name.localeCompare(b.name, "tr"),
  );
}
