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

// Kral tacı: birincilerin fotoğrafının üstünde
function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true">
      <path d="M6 40 2 12l16 12L32 4l14 20 16-12-4 28Z" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="2.5" cy="11" r="3.5" fill="var(--pink)" stroke="var(--ink)" strokeWidth="2.5" />
      <circle cx="32" cy="4.5" r="3.5" fill="var(--pink)" stroke="var(--ink)" strokeWidth="2.5" />
      <circle cx="61.5" cy="11" r="3.5" fill="var(--pink)" stroke="var(--ink)" strokeWidth="2.5" />
      <path d="M10 44h44" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// Podyum renkleri: 1. sarı, 2. lila, 3. pembe
const PODIUM = [
  { bg: "bg-[var(--yellow)]", pop: "var(--purple)", tilt: "lg:-rotate-1", photo: 132 },
  { bg: "bg-[var(--lilac)]", pop: "var(--pink)", tilt: "lg:rotate-1", photo: 104 },
  { bg: "bg-[#ffb3d6]", pop: "var(--blue)", tilt: "lg:-rotate-1", photo: 104 },
];

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
    <main className="mx-auto w-full max-w-[92rem] space-y-9 px-4 py-8 sm:px-8 sm:py-12">
      <div>
        <h1 className="text-2xl font-bold">Krallık</h1>
        <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
          Güncel sezonun liderleri. Toplama ya da maç başına ortalamaya göre sıralayabilir, tek bir mevkiye bakabilirsin. Tüm ligler
          seçiliyken oyuncunun bütün turnuvalardaki maçları sayılır.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
              · En az {board.minMatches} maç
            </span>
          )}
        </CardHeader>
        <CardContent>
          {board.rows.length === 0 ? (
            <p className="text-muted-foreground">Bu seçime uyan oyuncu verisi henüz yok.</p>
          ) : (
            <>
              {/* Podyum: ilk üç oyuncu büyük kartlarda; geniş ekranda 2 · 1 · 3 dizilir, birinci ortada ve yukarıda */}
              <div className="mb-8 grid gap-6 pt-6 lg:grid-cols-3 lg:items-end">
                {board.rows.slice(0, 3).map((r, i) => {
                  const st = PODIUM[i];
                  return (
                    <div
                      key={r.playerId}
                      style={{ "--pop": st.pop } as React.CSSProperties}
                      className={cn(
                        "relative flex flex-col items-center rounded-[1.6rem] border-[2.5px] border-foreground px-4 pb-5 text-center shadow-[7px_7px_0_var(--pop)] transition-transform hover:rotate-0 hover:-translate-y-1",
                        st.bg,
                        st.tilt,
                        i === 0 ? "pt-12 lg:order-2 lg:pb-8" : i === 1 ? "pt-7 lg:order-1" : "pt-7 lg:order-3",
                      )}
                    >
                      <span className="poster absolute -left-3 -top-4 flex size-12 -rotate-6 items-center justify-center rounded-full border-[2.5px] border-foreground bg-white text-2xl shadow-[3px_3px_0_var(--ink)]">
                        {r.rank}
                      </span>
                      <div className="relative">
                        {r.rank === 1 && <Crown className="wiggle absolute -top-9 left-1/2 w-16 -translate-x-1/2 -rotate-6" />}
                        <span className="photocard overflow-hidden border-[3px]">
                          <PlayerPhoto id={r.playerId} name={r.playerName} size={st.photo} />
                        </span>
                      </div>
                      <Link
                        href={`/players/${r.playerId}`}
                        className={cn("poster mt-3 leading-none hover:underline", i === 0 ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl")}
                      >
                        {r.playerName}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-sm font-semibold">
                        {r.teamId !== null && (
                          <Link href={`/teams/${r.teamId}`} className="flex items-center gap-1.5 hover:underline">
                            <TeamLogo id={r.teamId} name={r.teamName} size={22} />
                            {r.teamName}
                          </Link>
                        )}
                        {positionText(r.position, r.specificPosition) && <span className="opacity-70">· {positionText(r.position, r.specificPosition)}</span>}
                      </div>
                      <div className={cn("poster mt-3 leading-none", i === 0 ? "text-7xl" : "text-6xl")}>{mainValue(r)}</div>
                      <div className="marker text-xl leading-tight">{mainLabel}</div>
                      <div className="mt-2 flex gap-2 text-xs font-bold">
                        <span className="rounded-full border-2 border-foreground bg-white px-2 py-0.5">{r.matches} maç</span>
                        <span className="rounded-full border-2 border-foreground bg-white px-2 py-0.5">{r.minutes.toLocaleString("tr-TR")}′</span>
                        {!board.averageOnly && (
                          <span className="rounded-full border-2 border-foreground bg-white px-2 py-0.5">
                            {sort === "total" ? `Maç başına ${decimal(r.perMatch)}` : `Toplam ${num(r.total)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sütun başlıkları (geniş ekran) */}
              {board.rows.length > 3 && (
                <div className="poster hidden grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,15rem)_4rem_5rem_5rem_6rem] gap-x-4 border-b-2 border-foreground pb-2 text-sm lg:grid">
                  <span>#</span>
                  <span>Oyuncu</span>
                  <span>Takım</span>
                  <span className="text-right">Maç</span>
                  <span className="text-right">Dakika</span>
                  <span className="text-right">{sort === "total" ? "Maç başına" : board.averageOnly ? "" : "Toplam"}</span>
                  <span className="text-right">{mainLabel}</span>
                </div>
              )}
              {board.rows.slice(3).map((r, j) => {
                const i = j + 3;
                const sharedRank = board.rows[i - 1].rank === r.rank;
                return (
                  // Mobil: sıra | oyuncu + takım | toplam, altında maç bilgisi. Geniş ekran: tek satır, sütunlu.
                  <div
                    key={r.playerId}
                    className="group grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b-2 border-dashed border-border px-2 py-3 transition-colors hover:bg-[var(--yellow)] lg:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,15rem)_4rem_5rem_5rem_6rem] lg:gap-x-4"
                  >
                    <span className={cn("poster flex items-center gap-1 text-3xl tabular-nums", sharedRank && "opacity-40")}>
                      {r.rank}
                      {r.rank === 1 && <Crown className="w-6" />}
                    </span>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="photocard overflow-hidden transition-transform group-hover:-rotate-6">
                        <PlayerPhoto id={r.playerId} name={r.playerName} size={56} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                          <Link href={`/players/${r.playerId}`} className="truncate text-xl font-extrabold hover:text-primary">
                            {r.playerName}
                          </Link>
                          {positionText(r.position, r.specificPosition) && (
                            <span className="shrink-0 text-sm text-muted-foreground">{positionText(r.position, r.specificPosition)}</span>
                          )}
                        </div>
                        <div className="truncate text-sm text-muted-foreground lg:hidden">
                          {r.teamName} · {r.matches} maç ·{" "}
                          {sort === "total" ? `${decimal(r.perMatch)}/maç` : board.averageOnly ? `${r.minutes.toLocaleString("tr-TR")}′` : `toplam ${num(r.total)}`}
                        </div>
                      </div>
                    </div>
                    <div className="hidden min-w-0 items-center gap-2 font-semibold lg:flex">
                      {r.teamId !== null && (
                        <>
                          <TeamLogo id={r.teamId} name={r.teamName} size={28} />
                          <Link href={`/teams/${r.teamId}`} className="truncate hover:text-primary">
                            {r.teamName}
                          </Link>
                        </>
                      )}
                    </div>
                    <span className="hidden text-right tabular-nums lg:block">{r.matches}</span>
                    <span className="hidden text-right tabular-nums text-muted-foreground lg:block">
                      {r.minutes.toLocaleString("tr-TR")}′
                    </span>
                    <span className="hidden text-right tabular-nums lg:block">
                      {sort === "total" ? decimal(r.perMatch) : board.averageOnly ? "" : num(r.total)}
                    </span>
                    <span className="poster text-right text-3xl tabular-nums text-primary">{mainValue(r)}</span>
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
