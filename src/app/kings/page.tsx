// src/app/kings/page.tsx
// Krallık: güncel sezonun toplam liderleri (gol, asist, isabetli şut, top kapma...).
// Varsayılan tüm ligler birlikte; lig ve kategori adres çubuğundan seçilir (?league=1&stat=tackles).
import Link from "next/link";
import {
  allLeagueIds, isKingPosition, isKingSort, isKingStat, kingBoard, kingLeagues, KING_POSITIONS, KING_SORTS, KING_STATS,
  type KingPosition, type KingStatKey,
} from "@/lib/kings";
import { specificPositionName } from "@/lib/engine/player-bio";
import { kingMetric, type KingSort } from "@/lib/engine/king-board";
import { Segmented } from "@/components/segmented";
import { FilterSelect } from "@/components/filter-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Krallık · Gokostats" } };

const POSITION_NAMES: Record<string, string> = { G: "Kaleci", D: "Defans", M: "Orta saha", F: "Forvet" };
const positionText = (position?: string | null, specific?: string | null) =>
  specificPositionName(specific ?? null) ?? (position ? POSITION_NAMES[position] : null);
const decimal = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function KingsPage({ searchParams }: { searchParams: Promise<{ stat?: string; league?: string; sort?: string; pos?: string }> }) {
  const params = await searchParams;
  const statKey: KingStatKey = isKingStat(params.stat) ? params.stat : "goals";
  const requestedSort: KingSort = isKingSort(params.sort) ? params.sort : "total";
  const position: KingPosition = isKingPosition(params.pos) ? params.pos : "all";
  const [leagues, ids] = await Promise.all([kingLeagues(), allLeagueIds()]);
  const league = leagues.find((l) => String(l.id) === params.league) ?? null;
  const board = await kingBoard(statKey, requestedSort, league?.id ?? null, ids, position);
  const sort = board.sort;
  const num = (v: number) => (board.decimals ? decimal(v) : v.toLocaleString("tr-TR"));
  // Sağdaki büyük sayı sıralama ölçütü; diğer ikisi yanında küçük sütunlarda
  const mainLabel = board.averageOnly ? "Ortalama" : KING_SORTS.find((s) => s.key === sort)!.label;
  const mainValue = (r: (typeof board.rows)[number]) => (sort === "total" ? num(r.total) : decimal(kingMetric(r, sort)));

  const href = (next: { stat?: KingStatKey; league?: number | null; sort?: KingSort; pos?: KingPosition }) => {
    const q = new URLSearchParams();
    const s = next.stat ?? statKey;
    const so = next.sort ?? requestedSort;
    const po = next.pos ?? position;
    const l = next.league === undefined ? league?.id ?? null : next.league;
    if (s !== "goals") q.set("stat", s);
    if (l !== null) q.set("league", String(l));
    if (so !== "total") q.set("sort", so);
    if (po !== "all") q.set("pos", po);
    const qs = q.toString();
    return `/kings${qs ? `?${qs}` : ""}`;
  };

  const positionLabel = position === "all" ? null : KING_POSITIONS.find((p) => p.key === position)!.label;
  const scope = [league ? `${league.name} · ${league.seasonName}` : "Tüm ligler · güncel sezon", positionLabel].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Krallık</h1>
        <p className="text-muted-foreground">
          Güncel sezonun liderleri; toplama ya da maç başı ortalamaya göre, istenirse tek mevki. Tüm ligler seçiliyken oyuncunun
          bütün turnuvalardaki maçları sayılır.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterSelect
          label="Lig"
          selected={league ? String(league.id) : "all"}
          groups={[
            { options: [{ value: "all", label: "Tüm ligler", href: href({ league: null }) }] },
            {
              title: "Ligler",
              options: leagues.map((l) => ({
                value: String(l.id),
                label: l.name,
                count: l.matches,
                href: href({ league: l.id }),
              })),
            },
          ]}
        />
        <FilterSelect
          label="Kategori"
          selected={statKey}
          groups={[...new Set(KING_STATS.map((s) => s.group))].map((group) => ({
            title: group,
            options: KING_STATS.filter((s) => s.group === group).map((s) => ({ value: s.key, label: s.name, href: href({ stat: s.key }) })),
          }))}
        />
        <FilterSelect
          label="Mevki"
          selected={position}
          groups={[{ options: KING_POSITIONS.map((p) => ({ value: p.key, label: p.label, href: href({ pos: p.key }) })) }]}
        />
        {!board.averageOnly && (
          <Segmented options={KING_SORTS} value={sort} href={(k) => href({ sort: k })} />
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
          <CardTitle className="text-xl">{board.name} krallığı</CardTitle>
          <span className="text-sm text-muted-foreground">{scope}</span>
          {board.minMatches !== null && (
            <span className="text-sm text-muted-foreground" title="Az maç oynayan oyuncular ortalamada öne geçmesin diye">
              · en az {board.minMatches} maç
            </span>
          )}
        </CardHeader>
        <CardContent>
          {board.rows.length === 0 ? (
            <p className="text-muted-foreground">Bu seçim için henüz oyuncu verisi yok.</p>
          ) : (
            <>
              {/* Sütun başlıkları (geniş ekran) */}
              <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,14rem)_4rem_5rem_5rem_5rem] gap-x-4 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground lg:grid">
                <span>#</span>
                <span>Oyuncu</span>
                <span>Takım</span>
                <span className="text-right">Maç</span>
                <span className="text-right">Dakika</span>
                <span className="text-right">{sort === "total" ? "Maç başı" : board.averageOnly ? "" : "Toplam"}</span>
                <span className="text-right">{mainLabel}</span>
              </div>
              {board.rows.map((r, i) => {
                const sharedRank = i > 0 && board.rows[i - 1].rank === r.rank;
                return (
                  // Mobil: sıra | oyuncu + takım | toplam, altında maç bilgisi. Geniş ekran: tek satır, sütunlu.
                  <div
                    key={r.playerId}
                    className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border py-2.5 lg:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,14rem)_4rem_5rem_5rem_5rem] lg:gap-x-4"
                  >
                    <span
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        r.rank === 1 ? "text-hit" : "text-muted-foreground",
                        sharedRank && "opacity-40",
                      )}
                    >
                      {r.rank}
                    </span>
                    <div className="flex min-w-0 items-center gap-3">
                      <PlayerPhoto id={r.playerId} name={r.playerName} size={40} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <Link href={`/players/${r.playerId}`} className="truncate font-semibold hover:text-primary">
                            {r.playerName}
                          </Link>
                          {positionText(r.position, r.specificPosition) && (
                            <span className="shrink-0 text-xs text-muted-foreground">{positionText(r.position, r.specificPosition)}</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground lg:hidden">
                          {r.teamName} · {r.matches} maç ·{" "}
                          {sort === "total" ? `${decimal(r.perMatch)}/maç` : board.averageOnly ? `${r.minutes.toLocaleString("tr-TR")}′` : `toplam ${num(r.total)}`}
                        </div>
                      </div>
                    </div>
                    <div className="hidden min-w-0 items-center gap-2 text-sm lg:flex">
                      {r.teamId !== null && (
                        <>
                          <TeamLogo id={r.teamId} name={r.teamName} size={20} />
                          <Link href={`/teams/${r.teamId}`} className="truncate hover:text-primary">
                            {r.teamName}
                          </Link>
                        </>
                      )}
                    </div>
                    <span className="hidden text-right text-sm tabular-nums lg:block">{r.matches}</span>
                    <span className="hidden text-right text-sm tabular-nums text-muted-foreground lg:block">
                      {r.minutes.toLocaleString("tr-TR")}′
                    </span>
                    <span className="hidden text-right text-sm tabular-nums lg:block">
                      {sort === "total" ? decimal(r.perMatch) : board.averageOnly ? "" : num(r.total)}
                    </span>
                    <span className="text-right text-xl font-bold tabular-nums text-primary">{mainValue(r)}</span>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
