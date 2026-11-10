// src/app/page.tsx
// Maç listesi: seçilen günün maçları, lig bazında gruplu.
// Ligler popülerliğe göre (lib/league-order), lig içinde maçlar saat sırasıyla. ?sort=saat: tüm maçlar tek listede saat sırasıyla.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { byLeaguePopularity } from "@/lib/league-order";
import { statusLabel } from "@/lib/status";
import { listable } from "@/lib/match-filters";
import { dayRange, formatLongDate, formatTime, parseDateParam } from "@/lib/dates";
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
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 sm:px-6"
    >
      <span className="w-11 shrink-0 text-sm tabular-nums text-muted-foreground">{formatTime(m.eventDate)}</span>
      {/* Mobilde takımlar alt alta, masaüstünde yan yana */}
      <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <TeamLogo id={m.homeTeamId} name={m.homeTeam.name} />
          <span className="truncate">{m.homeTeam.name}</span>
        </span>
        <span className="hidden sm:inline">–</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <TeamLogo id={m.awayTeamId} name={m.awayTeam.name} />
          <span className="truncate">{m.awayTeam.name}</span>
        </span>
        {showLeague && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto sm:max-w-[40%] sm:pl-3">
            <LeagueLogo id={m.leagueId} name={m.league.name} size={14} />
            <span className="truncate">{m.league.name}</span>
          </span>
        )}
      </span>
      {m.status === "finished" ? (
        <span className="flex shrink-0 flex-col items-end font-medium tabular-nums sm:flex-row sm:gap-0.5">
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
    <main className="mx-auto w-full max-w-7xl space-y-4 p-4">
      {/* Tarih seçimi üst menüdeki gün şeridinde */}
      <h1 className="sr-only">Maçlar</h1>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground">
            {formatLongDate(date)} · {matches.length} maç
          </p>
          <div className="flex rounded-lg bg-secondary p-1 text-sm">
            {LIST_SORTS.map((o) => (
              <Link
                key={o.key}
                href={`/?date=${date}${o.key === "saat" ? "&sort=saat" : ""}`}
                scroll={false}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-colors",
                  sort === o.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
            Bu tarihte takip edilen liglerde maç yok.
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

      {sort === "lig" && [...byLeague.entries()].sort(([a], [b]) => byLeaguePopularity(a, b)).map(([league, list]) => (
        <Card key={league}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LeagueLogo id={list[0].leagueId} name={league} />
              {league}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {list.map((m) => (
              <MatchRow key={m.id} m={m} date={date} showLeague={false} />
            ))}
          </CardContent>
        </Card>
      ))}
    </main>
  );
}