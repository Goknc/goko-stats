// src/lib/engine/streaks.ts
// Seriler: "5 maçtır gol atıyor", "4 maçtır 3+ şut çekiyor", "6 maçtır gol atamıyor".
// En son maçtan geriye, kural tutmayan ilk maça kadar sayılır. Verisi olmayan maç (detaylı istatistik çekilmemiş)
// seriyi bozmaz, sayılmaz da. Aynı istatistikte birden fazla çizgi varsa yalnızca biri gösterilir (bkz. currentStreaks).
// Saf fonksiyon, veritabanı yok.
import { statValue, type AnyStatKey, type StatGame } from "./player-extras";

export interface StreakDef {
  group: string; // aynı gruptan yalnızca biri gösterilir (merdiven)
  key: AnyStatKey | "goalInvolvements"; // goalInvolvements = gol + asist
  line: number;
  dir: "over" | "under"; // over: line ve üstü, under: line altı (seri yok: "gol atamıyor")
  text: string; // {n} yerine seri uzunluğu yazılır
  min?: number; // bu tanım için en kısa seri (varsayılan genel min)
  positions?: string[]; // yalnızca bu mevkilerde (G, D, M, F)
}

export interface Streak {
  group: string;
  key: StreakDef["key"];
  line: number;
  dir: StreakDef["dir"];
  length: number;
  text: string;
}

export const STREAK_DEFS: StreakDef[] = [
  { group: "goals", key: "goals", line: 1, dir: "over", text: "{n} maçtır gol atıyor" },
  { group: "goals", key: "goals", line: 2, dir: "over", text: "{n} maçtır 2+ gol atıyor" },
  { group: "assists", key: "assists", line: 1, dir: "over", text: "{n} maçtır asist yapıyor" },
  { group: "ga", key: "goalInvolvements", line: 1, dir: "over", text: "{n} maçtır gole katkı veriyor" },
  { group: "sot", key: "shotsOnTarget", line: 1, dir: "over", text: "{n} maçtır isabetli şut çekiyor" },
  { group: "sot", key: "shotsOnTarget", line: 2, dir: "over", text: "{n} maçtır 2+ isabetli şut çekiyor" },
  { group: "sot", key: "shotsOnTarget", line: 3, dir: "over", text: "{n} maçtır 3+ isabetli şut çekiyor" },
  { group: "shots", key: "shotsTotal", line: 2, dir: "over", text: "{n} maçtır 2+ şut çekiyor" },
  { group: "shots", key: "shotsTotal", line: 3, dir: "over", text: "{n} maçtır 3+ şut çekiyor" },
  { group: "shots", key: "shotsTotal", line: 4, dir: "over", text: "{n} maçtır 4+ şut çekiyor" },
  { group: "shots", key: "shotsTotal", line: 5, dir: "over", text: "{n} maçtır 5+ şut çekiyor" },
  { group: "tackles", key: "tackles", line: 2, dir: "over", text: "{n} maçtır 2+ top kapma yapıyor" },
  { group: "tackles", key: "tackles", line: 3, dir: "over", text: "{n} maçtır 3+ top kapma yapıyor" },
  { group: "tackles", key: "tackles", line: 4, dir: "over", text: "{n} maçtır 4+ top kapma yapıyor" },
  { group: "fouls", key: "fouls", line: 1, dir: "over", text: "{n} maçtır faul yapıyor", min: 5 },
  { group: "fouls", key: "fouls", line: 2, dir: "over", text: "{n} maçtır 2+ faul yapıyor" },
  { group: "fouls", key: "fouls", line: 3, dir: "over", text: "{n} maçtır 3+ faul yapıyor" },
  { group: "cards", key: "yellowCards", line: 1, dir: "over", text: "{n} maçtır sarı kart görüyor" },
  { group: "keyPasses", key: "keyPasses", line: 1, dir: "over", text: "{n} maçtır kilit pas veriyor", min: 5 },
  { group: "keyPasses", key: "keyPasses", line: 2, dir: "over", text: "{n} maçtır 2+ kilit pas veriyor" },
  { group: "keyPasses", key: "keyPasses", line: 3, dir: "over", text: "{n} maçtır 3+ kilit pas veriyor" },
  { group: "offsides", key: "offsides", line: 1, dir: "over", text: "{n} maçtır ofsayta düşüyor" },
  { group: "aerials", key: "aerialsWon", line: 3, dir: "over", text: "{n} maçtır 3+ hava topu kazanıyor" },
  { group: "aerials", key: "aerialsWon", line: 5, dir: "over", text: "{n} maçtır 5+ hava topu kazanıyor" },
  { group: "fouled", key: "wasFouled", line: 2, dir: "over", text: "{n} maçtır 2+ faule maruz kalıyor" },
  { group: "fouled", key: "wasFouled", line: 3, dir: "over", text: "{n} maçtır 3+ faule maruz kalıyor" },
  { group: "dribbles", key: "dribblesWon", line: 2, dir: "over", text: "{n} maçtır 2+ başarılı çalım yapıyor" },
  { group: "saves", key: "saves", line: 3, dir: "over", text: "{n} maçtır 3+ kurtarış yapıyor", positions: ["G"] },
  // Kuraklık: yalnızca forvetlerde ve uzun serilerde ilginç
  { group: "drought", key: "goals", line: 1, dir: "under", text: "{n} maçtır gol atamıyor", min: 5, positions: ["F"] },
];

function valueOf(g: StatGame, key: StreakDef["key"]): number | null {
  if (key === "goalInvolvements") return g.stats.goals + g.stats.assists;
  return statValue(g, key);
}

// games: en yeniden eskiye
export function streakLength(games: StatGame[], key: StreakDef["key"], line: number, dir: StreakDef["dir"]): number {
  let n = 0;
  for (const g of games) {
    const v = valueOf(g, key);
    if (v === null) continue;
    const hit = dir === "over" ? v >= line : v < line;
    if (!hit) break;
    n++;
  }
  return n;
}

// Süren seriler, uzundan kısaya. games: en yeniden eskiye.
export function currentStreaks(
  games: StatGame[],
  opts: { min?: number; position?: string | null; defs?: StreakDef[] } = {},
): Streak[] {
  const min = opts.min ?? 3;
  const defs = (opts.defs ?? STREAK_DEFS).filter((d) => !d.positions || (opts.position && d.positions.includes(opts.position)));

  const best = new Map<string, Streak>();
  for (const d of defs) {
    const length = streakLength(games, d.key, d.line, d.dir);
    if (length < (d.min ?? min)) continue;
    const cur = best.get(d.group);
    // Merdivende çizgi × uzunluk büyük olan kalır (7 maç gol > 3 maç 2+ gol; 4 maç 4+ şut = 8 maç 2+ şut → yüksek çizgi)
    const score = (s: { line: number; length: number }) => s.line * s.length;
    if (!cur || score({ line: d.line, length }) > score(cur) || (score({ line: d.line, length }) === score(cur) && d.line > cur.line)) {
      best.set(d.group, { group: d.group, key: d.key, line: d.line, dir: d.dir, length, text: d.text.replace("{n}", String(length)) });
    }
  }

  // Gol + asist serisi, gol ya da asist serisiyle aynı uzunluktaysa bir şey anlatmaz
  const ga = best.get("ga");
  if (ga && [best.get("goals"), best.get("assists")].some((s) => s && s.line === 1 && s.length >= ga.length)) best.delete("ga");

  return [...best.values()].sort((a, b) => b.length - a.length);
}
