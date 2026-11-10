// src/lib/bsd/player-extras.ts
// BSD oyuncu satırındaki detaylı alanları (pas, ikili mücadele, hava topu, ofsayt, xG...) veritabanı sütunlarına çevirir.
// sync-details ve backfill (sync-player-extras) aynı eşlemeyi kullanır.
import type { BsdPlayerStat } from "./types";

// Sütun → BSD alanı
const COUNT_FIELDS = {
  touches: "touches",
  keyPasses: "key_pass",
  passesTotal: "total_pass",
  passesAccurate: "accurate_pass",
  longBallsTotal: "total_long_balls",
  longBallsAccurate: "accurate_long_balls",
  crossesTotal: "total_cross",
  crossesAccurate: "accurate_cross",
  dribblesTotal: "total_contest",
  dribblesWon: "won_contest",
  duelsWon: "duel_won",
  duelsLost: "duel_lost",
  aerialsWon: "aerial_won",
  aerialsLost: "aerial_lost",
  tacklesWon: "won_tackle",
  interceptions: "interception",
  clearances: "total_clearance",
  ballRecoveries: "ball_recovery",
  blocks: "outfielder_block",
  dispossessed: "dispossessed",
  possessionLost: "possession_lost",
  wasFouled: "was_fouled",
  offsides: "total_offside",
  bigChancesCreated: "big_chance_created",
  bigChancesMissed: "big_chance_missed",
  hitWoodwork: "hit_woodwork",
  saves: "saves",
  goalsConceded: "goals_conceded",
} as const satisfies Record<string, keyof BsdPlayerStat>;

export type PlayerExtraColumns = { [K in keyof typeof COUNT_FIELDS]: number | null } & {
  rating: number | null;
  xg: number | null;
  xa: number | null;
  extrasSynced: true;
};

// Satırda detaylı veri var mı: BSD detay vermeyen liglerde bu alanlar hiç gelmez
const hasDetail = (p: BsdPlayerStat) => p.total_pass != null || p.touches != null || p.duel_won != null;

export function playerExtras(p: BsdPlayerStat): PlayerExtraColumns {
  const detailed = hasDetail(p);
  // Detay varsa eksik sayaç 0 demektir (BSD sıfırı bazen null yollar); detay yoksa hepsi null kalır
  const num = (v: number | null | undefined) => (detailed ? (v ?? 0) : null);
  const counts = Object.fromEntries(
    Object.entries(COUNT_FIELDS).map(([col, field]) => [col, num(p[field] as number | null | undefined)]),
  ) as { [K in keyof typeof COUNT_FIELDS]: number | null };
  return {
    ...counts,
    rating: p.rating ?? null, // kısa süre oynayanlarda puan verilmez, 0 sayılmaz
    xg: num(p.expected_goals),
    xa: num(p.expected_assists),
    extrasSynced: true,
  };
}
