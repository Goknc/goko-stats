// src/lib/kings.ts
// Krallık: oyuncuların güncel sezondaki toplamları ve ortalamaları (gol, asist, pas, hava topu, ofsayt...).
// Varsayılan tüm ligler birlikte (oyuncunun bütün turnuvalardaki toplamı); bir lig seçilirse yalnızca o lig.
// "Güncel sezon" her ligin BSD'deki şu anki sezonudur (seasons.isCurrent). Sıralama engine/king-board'da.
// Detaylı istatistikler (pas, ikili...) eski maçlarda boş olabilir: maç ve dakika yalnızca verisi olan maçlardan sayılır.
import { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";
import { cached } from "./ttl-cache";
import { canonicalLeagueId } from "./engine/leagues";
import { rankKings, type KingRow, type KingSort, type KingTotal } from "./engine/king-board";
import { byLeaguePopularity } from "./league-order";

// Her tabloda en fazla bu kadar sıra gösterilir (eşitlikte biraz fazlası)
export const KING_MAX_ROWS = 50;
const CACHE_MS = 10 * 60 * 1000;
// Maç başı sıralamada en az: en çok oynayanın %40ı kadar maç (en az 3)
const MIN_SHARE = 0.4;

interface KingStatDef {
  key: string;
  name: string;
  group: string;
  sql: string;
  decimals?: boolean; // xG gibi ondalıklı
  averageOnly?: boolean; // toplamı anlamsız (puan): yalnızca maç başı ortalama
}

// SQL ifadeleri sabit listeden gelir; kullanıcı girdisi sorguya hiç girmez
export const KING_STATS = [
  { key: "goals", name: "Gol", group: "Gol ve şut", sql: `pms."goals"` },
  { key: "assists", name: "Asist", group: "Gol ve şut", sql: `pms."assists"` },
  { key: "goalContributions", name: "Gol + asist", group: "Gol ve şut", sql: `pms."goals" + pms."assists"` },
  { key: "shotsOnTarget", name: "İsabetli şut", group: "Gol ve şut", sql: `pms."shotsOnTarget"` },
  { key: "shotsTotal", name: "Şut", group: "Gol ve şut", sql: `pms."shotsTotal"` },
  { key: "xg", name: "Beklenen gol (xG)", group: "Gol ve şut", sql: `pms."xg"`, decimals: true },
  { key: "bigChancesMissed", name: "Net fırsat kaçırma", group: "Gol ve şut", sql: `pms."bigChancesMissed"` },
  { key: "offsides", name: "Ofsayt", group: "Gol ve şut", sql: `pms."offsides"` },
  { key: "keyPasses", name: "Kilit pas", group: "Pas ve yaratıcılık", sql: `pms."keyPasses"` },
  { key: "xa", name: "Beklenen asist (xA)", group: "Pas ve yaratıcılık", sql: `pms."xa"`, decimals: true },
  { key: "bigChancesCreated", name: "Net fırsat yaratma", group: "Pas ve yaratıcılık", sql: `pms."bigChancesCreated"` },
  { key: "passesAccurate", name: "İsabetli pas", group: "Pas ve yaratıcılık", sql: `pms."passesAccurate"` },
  { key: "passesTotal", name: "Pas", group: "Pas ve yaratıcılık", sql: `pms."passesTotal"` },
  { key: "crossesAccurate", name: "İsabetli orta", group: "Pas ve yaratıcılık", sql: `pms."crossesAccurate"` },
  { key: "dribblesWon", name: "Başarılı çalım", group: "Pas ve yaratıcılık", sql: `pms."dribblesWon"` },
  { key: "duelsWon", name: "İkili mücadele kazanma", group: "Mücadele ve savunma", sql: `pms."duelsWon"` },
  { key: "aerialsWon", name: "Hava topu kazanma", group: "Mücadele ve savunma", sql: `pms."aerialsWon"` },
  { key: "tackles", name: "Top kapma", group: "Mücadele ve savunma", sql: `pms."tackles"` },
  { key: "interceptions", name: "Pas arası", group: "Mücadele ve savunma", sql: `pms."interceptions"` },
  { key: "clearances", name: "Uzaklaştırma", group: "Mücadele ve savunma", sql: `pms."clearances"` },
  { key: "ballRecoveries", name: "Top kazanma", group: "Mücadele ve savunma", sql: `pms."ballRecoveries"` },
  { key: "fouls", name: "Faul", group: "Disiplin", sql: `pms."fouls"` },
  { key: "wasFouled", name: "Maruz kalınan faul", group: "Disiplin", sql: `pms."wasFouled"` },
  { key: "yellowCards", name: "Sarı kart", group: "Disiplin", sql: `pms."yellowCards"` },
  { key: "redCards", name: "Kırmızı kart", group: "Disiplin", sql: `pms."redCards"` },
  { key: "possessionLost", name: "Top kaybı", group: "Disiplin", sql: `pms."possessionLost"` },
  { key: "saves", name: "Kurtarış", group: "Kaleci", sql: `pms."saves"` },
  { key: "rating", name: "Ortalama puan", group: "Genel", sql: `pms."rating"`, decimals: true, averageOnly: true },
] as const satisfies readonly KingStatDef[];

export type KingStatKey = (typeof KING_STATS)[number]["key"];
export const isKingStat = (v: unknown): v is KingStatKey => KING_STATS.some((s) => s.key === v);
export const kingStat = (key: KingStatKey): KingStatDef => KING_STATS.find((s) => s.key === key)!;

export const KING_SORTS: { key: KingSort; label: string }[] = [
  { key: "total", label: "Toplam" },
  { key: "perMatch", label: "Maç başı" },
];
export const isKingSort = (v: unknown): v is KingSort => KING_SORTS.some((s) => s.key === v);

export const KING_POSITIONS = [
  { key: "all", label: "Tüm mevkiler" },
  { key: "F", label: "Forvet" },
  { key: "M", label: "Orta saha" },
  { key: "D", label: "Defans" },
  { key: "G", label: "Kaleci" },
] as const;
export type KingPosition = (typeof KING_POSITIONS)[number]["key"];
export const isKingPosition = (v: unknown): v is KingPosition => KING_POSITIONS.some((p) => p.key === v);

export interface KingLeague {
  id: number; // kanonik lig id'si (Apertura/Clausura tek lig)
  name: string;
  seasonName: string;
  matches: number; // oyuncu verisi olan maç sayısı
}

// Güncel sezonunda oyuncu verisi olan ligler, popülerlik sırasıyla
export function kingLeagues(): Promise<KingLeague[]> {
  return cached("kings:leagues", CACHE_MS, async () => {
    const rows = await prisma.$queryRaw<{ id: number; name: string; seasonName: string; matches: number }[]>`
      SELECT m."leagueId" AS id, l.name, se.name AS "seasonName", COUNT(*)::int AS matches
      FROM matches m
      JOIN seasons se ON se.id = m."seasonId"
      JOIN leagues l ON l.id = m."leagueId"
      WHERE se."isCurrent" AND m.status = 'finished'
        AND EXISTS (SELECT 1 FROM player_match_stats p WHERE p."matchId" = m.id)
      GROUP BY m."leagueId", l.name, se.name`;

    const merged = new Map<number, KingLeague>();
    for (const r of rows) {
      const id = canonicalLeagueId(r.id);
      const prev = merged.get(id);
      if (prev) prev.matches += r.matches;
      else merged.set(id, { id, name: r.name, seasonName: r.seasonName, matches: r.matches });
    }
    return [...merged.values()].sort((a, b) => byLeaguePopularity(a.name, b.name));
  });
}

export interface KingBoard {
  statKey: KingStatKey;
  name: string;
  sort: KingSort;
  decimals: boolean;
  averageOnly: boolean;
  rows: KingRow[];
  minMatches: number | null; // maç başı sıralamadaki en az maç şartı
}

// leagueId null = tüm ligler, position "all" = tüm mevkiler
export function kingBoard(
  statKey: KingStatKey,
  requestedSort: KingSort,
  leagueId: number | null,
  allLeagueIds: number[],
  position: KingPosition = "all",
): Promise<KingBoard> {
  const stat = kingStat(statKey);
  const sort: KingSort = stat.averageOnly ? "perMatch" : requestedSort;
  return cached(`kings:${statKey}:${sort}:${leagueId ?? "all"}:${position}`, CACHE_MS, async () => {
    // Seçili ligin bütün turnuva id'leri (ör. Liga MX Apertura + Clausura)
    const ids = leagueId === null ? null : allLeagueIds.filter((id) => canonicalLeagueId(id) === leagueId);
    const leagueFilter = ids ? Prisma.sql`AND m."leagueId" IN (${Prisma.join(ids)})` : Prisma.empty;
    const positionFilter = position === "all" ? Prisma.empty : Prisma.sql`AND pl.position = ${position}`;

    const having = sort === "perMatch" ? Prisma.sql`AND COUNT(*) >= (SELECT min_matches FROM th)` : Prisma.empty;
    const order =
      sort === "perMatch" ? Prisma.sql`ORDER BY SUM(v) / COUNT(*) DESC, total DESC` : Prisma.sql`ORDER BY total DESC, matches ASC`;

    const rows = await prisma.$queryRaw<(KingTotal & { minMatches: number })[]>`
      WITH s AS (
        SELECT pms."playerId", pms."teamId", pms."minutesPlayed", (${Prisma.raw(stat.sql)})::float8 AS v, m."eventDate"
        FROM player_match_stats pms
        JOIN matches m ON m.id = pms."matchId"
        JOIN seasons se ON se.id = m."seasonId"
        JOIN players pl ON pl.id = pms."playerId"
        WHERE se."isCurrent" AND m.status = 'finished' AND pms."minutesPlayed" > 0
          AND (${Prisma.raw(stat.sql)}) IS NOT NULL ${leagueFilter} ${positionFilter}
      ),
      counts AS (
        SELECT COUNT(*) AS c FROM s GROUP BY "playerId"
      ),
      th AS (
        SELECT GREATEST(3, CEIL(${Prisma.raw(String(MIN_SHARE))} * COALESCE(MAX(c), 0)))::int AS min_matches FROM counts
      ),
      agg AS (
        SELECT "playerId", SUM(v)::float8 AS total, COUNT(*)::int AS matches, SUM("minutesPlayed")::int AS minutes
        FROM s
        GROUP BY "playerId"
        HAVING SUM(v) > 0 ${having}
        ${order}
        LIMIT ${KING_MAX_ROWS * 3}
      ),
      last_team AS (
        SELECT DISTINCT ON (s."playerId") s."playerId", s."teamId"
        FROM s JOIN agg USING ("playerId")
        ORDER BY s."playerId", s."eventDate" DESC
      )
      SELECT agg."playerId", p.name AS "playerName", p.position, p."specificPosition",
             lt."teamId", COALESCE(t.name, '') AS "teamName",
             agg.total, agg.matches, agg.minutes, (SELECT min_matches FROM th) AS "minMatches"
      FROM agg
      JOIN players p ON p.id = agg."playerId"
      LEFT JOIN last_team lt USING ("playerId")
      LEFT JOIN teams t ON t.id = lt."teamId"`;

    return {
      statKey,
      name: stat.name,
      sort,
      decimals: !!stat.decimals,
      averageOnly: !!stat.averageOnly,
      rows: rankKings(rows, KING_MAX_ROWS, sort),
      minMatches: sort === "perMatch" ? (rows[0]?.minMatches ?? null) : null,
    };
  });
}

// ---------- Oyuncu sayfası: krallık sıraları ----------

// Profilde vurgulanmaya değer kategoriler (faul, kart, top kaybı gibi olumsuzlar ve puan hariç)
const HIGHLIGHT_STATS: KingStatKey[] = [
  "goals", "assists", "goalContributions", "shotsOnTarget", "shotsTotal", "xg", "keyPasses", "xa", "bigChancesCreated",
  "passesAccurate", "passesTotal", "crossesAccurate", "dribblesWon", "duelsWon", "aerialsWon", "tackles", "interceptions",
  "clearances", "ballRecoveries", "wasFouled", "saves",
];
export const KING_HIGHLIGHT_TOP = 10;

export const KING_HIGHLIGHT_POSITION_TOP = 3; // genelde ilk 10'da değilse mevkisinde ilk 3

const POSITION_PLURAL: Record<string, string> = { G: "Kaleciler", D: "Defanslar", M: "Orta sahalar", F: "Forvetler" };

type TotalsRow = { playerId: number; playerName: string; position: string | null } & Record<string, number | null>;

// Bir kapsamdaki (turnuva ya da tüm ligler) bütün oyuncuların bütün kategori toplamları: tek sorgu, önbellekte.
// SQL ifadeleri ve lig id'leri sabit listeden / veritabanından gelir; kullanıcı girdisi sorguya girmez.
function scopeTotals(ids: number[] | null): Promise<TotalsRow[]> {
  const stats = KING_STATS.filter((s) => HIGHLIGHT_STATS.includes(s.key));
  const cols = stats.map((s) => `SUM(${s.sql})::float8 AS "s_${s.key}", COUNT(${s.sql})::int AS "c_${s.key}"`).join(", ");
  const leagueFilter = ids ? `AND m."leagueId" IN (${ids.map((id) => Math.trunc(Number(id))).join(",")})` : "";
  return cached(`kings:totals:${ids?.join(",") ?? "all"}`, CACHE_MS, () =>
    prisma.$queryRawUnsafe<TotalsRow[]>(
      `SELECT pms."playerId", p.name AS "playerName", p.position, ${cols}
       FROM player_match_stats pms
       JOIN matches m ON m.id = pms."matchId"
       JOIN seasons se ON se.id = m."seasonId"
       JOIN players p ON p.id = pms."playerId"
       WHERE se."isCurrent" AND m.status = 'finished' AND pms."minutesPlayed" > 0 ${leagueFilter}
       GROUP BY pms."playerId", p.name, p.position`,
    ),
  );
}

export interface KingHighlight {
  statKey: KingStatKey;
  statName: string;
  rank: number;
  total: number;
  decimals: boolean;
  scope: string; // turnuva adı ya da "Tüm ligler"
  leagueId: number | null;
  position: string | null; // null = bütün oyuncular arasında; G/D/M/F = yalnızca o mevkide
  positionLabel: string | null; // "Defanslar"
}

const toTotals = (rows: TotalsRow[], key: KingStatKey): KingTotal[] =>
  rows.map((r) => ({
    playerId: r.playerId,
    playerName: r.playerName,
    teamId: null,
    teamName: "",
    total: r[`s_${key}`] ?? 0,
    matches: r[`c_${key}`] ?? 0,
    minutes: 0,
  }));

// Oyuncunun güncel sezonda öne çıktığı krallıklar. Kapsamlar: oynadığı her turnuva (lig, Avrupa kupası, kupa) ve tüm ligler.
// Genelde ilk 10'daysa o sıra; değilse kendi mevkisinde ilk 3'teyse mevki sırası ("defanslar arasında isabetli şut lideri").
export async function playerKingHighlights(playerId: number, position: string | null): Promise<KingHighlight[]> {
  const [ids, leagues, played] = await Promise.all([
    allLeagueIds(),
    kingLeagues(),
    prisma.$queryRaw<{ leagueId: number }[]>`
      SELECT DISTINCT m."leagueId"
      FROM player_match_stats pms
      JOIN matches m ON m.id = pms."matchId"
      JOIN seasons se ON se.id = m."seasonId"
      WHERE pms."playerId" = ${playerId} AND se."isCurrent" AND m.status = 'finished' AND pms."minutesPlayed" > 0`,
  ]);
  const playedCanonical = new Set(played.map((r) => canonicalLeagueId(r.leagueId)));
  const scopes: { name: string; leagueId: number | null; ids: number[] | null }[] = leagues
    .filter((l) => playedCanonical.has(l.id))
    .map((l) => ({ name: l.name, leagueId: l.id, ids: ids.filter((id) => canonicalLeagueId(id) === l.id) }));
  scopes.push({ name: "Tüm ligler", leagueId: null, ids: null });
  const positionLabel = position ? (POSITION_PLURAL[position] ?? null) : null;

  const out: KingHighlight[] = [];
  for (const scope of scopes) {
    const rows = await scopeTotals(scope.ids);
    if (!rows.some((r) => r.playerId === playerId)) continue;
    const peers = positionLabel ? rows.filter((r) => r.position === position) : [];
    for (const key of HIGHLIGHT_STATS) {
      const stat = kingStat(key);
      const base = { statKey: key, statName: stat.name, decimals: !!stat.decimals, scope: scope.name, leagueId: scope.leagueId };
      const overall = rankKings(toTotals(rows, key), KING_HIGHLIGHT_TOP).find((r) => r.playerId === playerId);
      if (overall) {
        out.push({ ...base, rank: overall.rank, total: overall.total, position: null, positionLabel: null });
        continue;
      }
      if (!peers.length) continue;
      const inPosition = rankKings(toTotals(peers, key), KING_HIGHLIGHT_POSITION_TOP).find((r) => r.playerId === playerId);
      if (inPosition) out.push({ ...base, rank: inPosition.rank, total: inPosition.total, position, positionLabel });
    }
  }
  // Önce sıra; eşitse genel sıra mevki sırasından, turnuva sırası tüm ligler sırasından önce
  return out.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(a.position !== null) - Number(b.position !== null) ||
      Number(a.leagueId === null) - Number(b.leagueId === null),
  );
}

// Veritabanındaki tüm lig id'leri (lig filtresinde Apertura/Clausura gibi eşleri bulmak için)
export async function allLeagueIds(): Promise<number[]> {
  return cached("kings:league-ids", CACHE_MS, async () =>
    (await prisma.league.findMany({ select: { id: true } })).map((l) => l.id),
  );
}
