// src/lib/position-benchmarks.ts
// Mevki kıyası için veri: güncel sezonda bir mevkideki (G, D, M, F) bütün oyuncuların toplamları.
// Hesaplar motorda (engine/position-rank). Tüm ligler birlikte; sonuç 1 saat önbellekte.
import { prisma } from "./prisma";
import { cached } from "./ttl-cache";
import { PLAYER_STAT_KEYS } from "./engine/trends";
import { EXTRA_KEYS, type AnyStatKey } from "./engine/player-extras";
import { MIN_MINUTES, type BenchPlayer } from "./engine/position-rank";

const CACHE_MS = 60 * 60 * 1000;
const POSITIONS = new Set(["G", "D", "M", "F"]);

// Sütun adları sabit listelerden gelir; kullanıcı girdisi sorguya girmez
const CORE = [...PLAYER_STAT_KEYS];
const EXTRA = EXTRA_KEYS.filter((k) => k !== "rating");
const X = `pms."extrasSynced"`;

const SELECT = [
  `SUM(pms."minutesPlayed")::float8 AS "minutes"`,
  `COALESCE(SUM(pms."minutesPlayed") FILTER (WHERE ${X}), 0)::float8 AS "extraMinutes"`,
  ...CORE.map((k) => `SUM(pms."${k}")::float8 AS "${k}"`),
  ...[...CORE, ...EXTRA].map((k) => `SUM(pms."${k}") FILTER (WHERE ${X})::float8 AS "x_${k}"`),
].join(",\n");

export function positionBenchmark(position: string | null): Promise<BenchPlayer[]> {
  if (!position || !POSITIONS.has(position)) return Promise.resolve([]);
  return cached(`bench:${position}`, CACHE_MS, async () => {
    const rows = await prisma.$queryRawUnsafe<Record<string, number | null>[]>(
      `SELECT ${SELECT}
       FROM player_match_stats pms
       JOIN players p ON p.id = pms."playerId"
       JOIN matches m ON m.id = pms."matchId"
       JOIN seasons se ON se.id = m."seasonId"
       WHERE se."isCurrent" AND m.status = 'finished' AND pms."minutesPlayed" > 0 AND p.position = $1
       GROUP BY pms."playerId"
       HAVING SUM(pms."minutesPlayed") >= $2`,
      position,
      MIN_MINUTES,
    );
    return rows.map((r) => {
      const totals: BenchPlayer["totals"] = {};
      const extraTotals: BenchPlayer["extraTotals"] = {};
      for (const k of CORE) totals[k] = r[k] ?? 0;
      for (const k of [...CORE, ...EXTRA] as AnyStatKey[]) {
        const v = r[`x_${k}`];
        if (v === null || v === undefined) continue;
        extraTotals[k] = v;
        if (!CORE.includes(k as (typeof CORE)[number])) totals[k] = v;
      }
      return { minutes: r.minutes ?? 0, extraMinutes: r.extraMinutes ?? 0, totals, extraTotals };
    });
  });
}
