// src/app/page.tsx
// Maç listesi: seçilen günün maçları, lig bazında gruplu.
// Ligler popülerliğe göre (lib/league-order), lig içinde maçlar saat sırasıyla. ?sort=saat: tüm maçlar tek listede saat sırasıyla.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { byLeaguePopularity } from "@/lib/league-order";
import { statusLabel } from "@/lib/status";
import { listable } from "@/lib/match-filters";
import { dayRange, formatLongDate, formatTime, parseDateParam, todayTR } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { LeagueLogo, TeamLogo } from "@/components/entity-image";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Maçlar · Gokostats" } };

type ListMatch = Prisma.MatchGetPayload<{ include: { league: true; homeTeam: true; awayTeam: true } }>;

// Tek maç satırı. Saat sıralamasında lig adı da (logosuyla) takımların altında yazar.
function MatchRow({ m, date, showLeague }: { m: ListMatch; date: string; showLeague: boolean }) {
  // Çevirisi olmayan ham durum kodları (1st_half gibi) gösterilmez
  const label = statusLabel(m.status);
  const showLabel = label && label !== m.status;
  return (
    <Link
      href={`/matches/${m.id}?date=${date}`}
      className="group flex items-center gap-4 px-(--card-spacing) py-3.5 text-lg transition-colors hover:bg-[var(--yellow)]"
    >
      <span className="poster shrink-0 rounded-full bg-foreground px-2.5 py-0.5 text-base tabular-nums text-white">{formatTime(m.eventDate)}</span>
      {/* Mobilde takımlar alt alta, masaüstünde yan yana */}
      <span className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="photocard size-11 transition-transform group-hover:-rotate-6">
            <TeamLogo id={m.homeTeamId} name={m.homeTeam.name} size={30} />
          </span>
          <span className="truncate font-bold">{m.homeTeam.name}</span>
        </span>
        <span className="marker hidden text-2xl leading-none text-[var(--pink)] sm:inline">vs</span>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="photocard size-11 transition-transform group-hover:rotate-6">
            <TeamLogo id={m.awayTeamId} name={m.awayTeam.name} size={30} />
          </span>
          <span className="truncate font-bold">{m.awayTeam.name}</span>
        </span>
        {showLeague && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto sm:max-w-[40%] sm:pl-3">
            <LeagueLogo id={m.leagueId} name={m.league.name} size={14} />
            <span className="truncate">{m.league.name}</span>
          </span>
        )}
      </span>
      {m.status === "finished" ? (
        <span className="poster flex shrink-0 flex-col items-end text-3xl tabular-nums sm:flex-row sm:gap-1">
          <span>{m.homeScore}</span>
          <span className="hidden sm:inline">-</span>
          <span>{m.awayScore}</span>
        </span>
      ) : (
        showLabel && (
          <Badge variant="secondary" className="shrink-0">
            {label}
          </Badge>
        )
      )}
    </Link>
  );
}

type ListSort = "lig" | "saat";
const LIST_SORTS: { key: ListSort; label: string }[] = [
  { key: "lig", label: "Lig" },
  { key: "saat", label: "Saat" },
];

export default async function MatchListPage({ searchParams }: { searchParams: Promise<{ date?: string; sort?: string }> }) {
  const params = await searchParams;
  const date = parseDateParam(params.date);
  const sort: ListSort = params.sort === "saat" ? "saat" : "lig";
  const { start, end } = dayRange(date);

  const matches = await prisma.match.findMany({
    where: { eventDate: { gte: start, lt: end }, league: { isTracked: true }, ...listable },
    include: { league: true, homeTeam: true, awayTeam: true },
    orderBy: { eventDate: "asc" },
  });

  const byLeague = new Map<string, typeof matches>();
  for (const m of matches) {
    if (!byLeague.has(m.league.name)) byLeague.set(m.league.name, []);
    byLeague.get(m.league.name)!.push(m);
  }

  return (
    <main className="mx-auto w-full max-w-[92rem] space-y-9 px-4 py-8 sm:px-8 sm:py-12">
      {/* Tarih seçimi üst menüdeki gün şeridinde */}
      <h1>{date === todayTR() ? "Bugünün maçları" : "Günün maçları"}</h1>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xl font-bold">
            {formatLongDate(date)}{" "}
            <span className="marker ml-1 inline-block -rotate-2 rounded-full bg-[var(--yellow)] px-3 text-2xl">{matches.length} maç</span>
          </p>
          <div className="flex rounded-full border-2 border-foreground bg-white p-1 shadow-[3px_3px_0_var(--ink)] text-sm">
            {LIST_SORTS.map((o) => (
              <Link
                key={o.key}
                href={`/?date=${date}${o.key === "saat" ? "&sort=saat" : ""}`}
                scroll={false}
                className={cn(
                  "rounded-full px-3.5 py-1 font-bold transition-colors",
                  sort === o.key ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </Link>
            ))}
          </div>
        </div>
        {matches.length > 0 && (
          <Link href={`/trends?date=${date}`} className={buttonVariants({ size: "sm" })}>
            Günün trendleri
          </Link>
        )}
      </div>

      {matches.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Bu tarihte takip edilen turnuvalarda maç yok.
          </CardContent>
        </Card>
      )}

      {sort === "saat" && matches.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {/* Sorgu zaten saat sırasıyla; aynı saatte lig popülerliği */}
            {[...matches]
              .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime() || byLeaguePopularity(a.league.name, b.league.name))
              .map((m) => (
                <MatchRow key={m.id} m={m} date={date} showLeague />
              ))}
          </CardContent>
        </Card>
      )}

      {/* Ligler geniş ekranda iki sütuna akar */}
      {sort === "lig" && (
        <div className="gap-9 xl:columns-2">
          {[...byLeague.entries()].sort(([a], [b]) => byLeaguePopularity(a, b)).map(([league, list]) => (
            <Card key={league} className="mb-9 break-inside-avoid">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <LeagueLogo id={list[0].leagueId} name={league} size={36} />
                  {league}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y-2 divide-dashed p-0">
                {list.map((m) => (
                  <MatchRow key={m.id} m={m} date={date} showLeague={false} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}