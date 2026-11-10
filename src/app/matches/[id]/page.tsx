// src/app/matches/[id]/page.tsx
// Maç detayı: skor, maç istatistikleri, öne çıkan trendler, skor tahmini, aralarındaki maçlar, takım ve oyuncu karneleri.
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_SAMPLE, sampleFromParams, type SampleSettings } from "@/lib/app-settings";
import { SampleBar } from "@/components/sample-bar";
import { analyzeMatch, type RateSummary, type LineupSource } from "@/lib/analysis";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";
import { formatTime, matchDayKey, TZ } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormStrip } from "@/components/form-strip";
import { RatePercent } from "@/components/rate-percent";
import { EvidenceTable } from "@/components/evidence-table";
import { PlayerSection } from "@/components/player-section";
import { TeamTrendGrid } from "@/components/team-trend-grid";
import { LeagueLogo, PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { H2HCard } from "@/components/h2h-card";
import { loadHeadToHead } from "@/lib/h2h-loader";
import { h2hFilterFromParams, h2hFilterParams, type H2HFilter } from "@/lib/engine/h2h";
import { loadH2HPlayers } from "@/lib/h2h-players-loader";
import { PredictionCard } from "@/components/prediction-card";
import { MatchStatsCard } from "@/components/match-stats-card";
import { predictMatch } from "@/lib/prediction";

export const dynamic = "force-dynamic";

// Sekme başlığı: "Tottenham Hotspur – Coventry City" (bittiyse skorla)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { title: { absolute: "Maç bulunamadı · Gokostats" } };
  const m = await prisma.match.findUnique({
    where: { id: Number(id) },
    select: { status: true, homeScore: true, awayScore: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });
  if (!m) return { title: { absolute: "Maç bulunamadı · Gokostats" } };
  const score = m.status === "finished" ? ` ${m.homeScore}-${m.awayScore} ` : " – ";
  return { title: { absolute: `${m.homeTeam.name}${score}${m.awayTeam.name} · Gokostats` } };
}

const LINEUP_LABELS: Record<LineupSource, { text: string; className: string }> = {
  CONFIRMED: { text: "Kesin ilk 11", className: "bg-hit/15 text-hit" },
  PREDICTED: { text: "Tahmini ilk 11", className: "bg-primary/15 text-primary" },
  LAST_MATCH: { text: "Son maçın ilk 11'i", className: "bg-secondary text-muted-foreground" },
  NONE: { text: "Kadro bilgisi yok", className: "bg-secondary text-muted-foreground" },
};

const formatDateTime = (d: Date) =>
  d.toLocaleString("tr-TR", { timeZone: TZ, day: "numeric", month: "long", weekday: "long", hour: "2-digit", minute: "2-digit" });

// Form şeridi + x/y + renkli yüzde (az örnekse belirtilir)
function RateCell({ s }: { s: RateSummary }) {
  if (s.total === 0) return <span className="text-sm text-muted-foreground">veri yok</span>;
  return (
    <div className="flex items-center gap-2">
      <FormStrip outcomes={s.evidence.map((e) => e.outcome)} labels={s.evidence.map((e) => e.label)} size="sm" />
      <span className="text-sm tabular-nums">
        {s.hits}/{s.total}
      </span>
      {s.lowSample ? (
        <span className="text-xs text-muted-foreground">az örnek</span>
      ) : (
        <RatePercent rate={s.rate} className="text-sm" />
      )}
    </div>
  );
}

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; n?: string; team?: string; player?: string; h2h?: string; h2hn?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const defaults = DEFAULT_SAMPLE;
  // Maça özel form seçimi (adres çubuğu); varsayılandan farklıysa analiz önbelleksiz o seçimle yapılır
  const sample = sampleFromParams(query, defaults);
  const custom = sample.size !== defaults.size || sample.teamMode !== defaults.teamMode || sample.playerMode !== defaults.playerMode;
  const a = await analyzeMatch(
    Number(id),
    custom ? { maxMatches: sample.size, teamMode: sample.teamMode, playerMode: sample.playerMode } : {},
  );
  if (!a) notFound();

  // Aralarındaki maçlar seçimi (saha, maç sayısı)
  const h2hFilter = h2hFilterFromParams(query);

  // Form ve aralarındaki maçlar seçimleri birbirini bozmadan adres çubuğunda durur
  const hrefFor = (next: SampleSettings, nextH2h: H2HFilter = h2hFilter) => {
    const q = new URLSearchParams();
    if (query.date) q.set("date", query.date);
    if (next.size !== defaults.size) q.set("n", String(next.size));
    if (next.teamMode !== defaults.teamMode) q.set("team", next.teamMode);
    if (next.playerMode !== defaults.playerMode) q.set("player", next.playerMode);
    for (const [k, v] of Object.entries(h2hFilterParams(nextH2h))) q.set(k, v);
    const qs = q.toString();
    return `/matches/${id}${qs ? `?${qs}` : ""}`;
  };

  // Takım karnelerinin başlıkları form türüne göre
  const generalForm = sample.teamMode === "all";
  const homeLabel = generalForm ? "genel" : "iç saha";
  const awayLabel = generalForm ? "genel" : "deplasman";

  const [match, h2h, prediction, h2hPlayers] = await Promise.all([
    prisma.match.findUnique({
      where: { id: a.matchId },
      include: {
        teamStats: {
          select: {
            period: true, teamId: true, corners: true, yellowCards: true, redCards: true,
            shotsTotal: true, shotsOnTarget: true, fouls: true, offsides: true,
          },
        },
      },
    }),
    loadHeadToHead(a.homeTeam.id, a.awayTeam.id, a.eventDate, h2hFilter),
    predictMatch(a.matchId),
    a.playerStatsEnabled ? loadH2HPlayers(a.homeTeam.id, a.awayTeam.id, a.eventDate) : null,
  ]);
  const finished = match?.status === "finished";
  // Çevirisi olmayan ham durum kodları (1st_half gibi) gösterilmez
  const label = match && statusLabel(match.status) !== match.status ? statusLabel(match.status) : "";

  const teamRows = a.teamTrends;
  const teamPicks = teamRows.filter((t) => t.recommended);
  const playerPicks = a.playerTrends
    .filter((p) => p.recommended)
    .sort((x, y) => (y.summary.rate ?? 0) - (x.summary.rate ?? 0));

  const teams = [
    { team: a.homeTeam, source: a.lineups.home },
    { team: a.awayTeam, source: a.lineups.away },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <Link href={`/?date=${matchDayKey(a.eventDate)}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        ← Maç listesi
      </Link>

      {/* Skorbord */}
      <header className="rounded-xl border border-border bg-card p-5">
        <h1 className="sr-only">
          {a.homeTeam.name} – {a.awayTeam.name}
        </h1>
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <LeagueLogo id={a.leagueId} name={a.leagueName} size={16} />
          {a.leagueName} · {formatDateTime(a.eventDate)}
        </p>
        {/* Mobilde logo adın üstünde, masaüstünde skorun yanında */}
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Link
            href={`/teams/${a.homeTeam.id}`}
            className="flex flex-col items-center gap-2 text-center text-lg font-bold hover:text-primary sm:flex-row sm:justify-end sm:text-right sm:text-2xl"
          >
            <TeamLogo id={a.homeTeam.id} name={a.homeTeam.name} size={56} className="sm:order-last" />
            {a.homeTeam.name}
          </Link>
          <div className="rounded-lg bg-background px-4 py-2 text-2xl font-bold tabular-nums">
            {finished && match ? `${match.homeScore} - ${match.awayScore}` : formatTime(a.eventDate)}
          </div>
          <Link
            href={`/teams/${a.awayTeam.id}`}
            className="flex flex-col items-center gap-2 text-center text-lg font-bold hover:text-primary sm:flex-row sm:text-left sm:text-2xl"
          >
            <TeamLogo id={a.awayTeam.id} name={a.awayTeam.name} size={56} />
            {a.awayTeam.name}
          </Link>
        </div>
        {!finished && label && (
          <div className="mt-2 text-center">
            <Badge variant="secondary">{label}</Badge>
          </div>
        )}
        <div className="mt-3 text-center">
          <Link href={`/compare?a=${a.homeTeam.id}&b=${a.awayTeam.id}`} className="text-sm text-muted-foreground hover:text-primary">
            Takımları karşılaştır →
          </Link>
        </div>
      </header>

      {/* Form ayarı: bu maça özel ya da varsayılan */}
      <SampleBar value={sample} defaults={defaults} hrefFor={hrefFor} />

      {/* Biten maçın istatistikleri */}
      {finished && match && (
        <MatchStatsCard
          stats={match.teamStats}
          homeId={a.homeTeam.id}
          awayId={a.awayTeam.id}
          homeName={a.homeTeam.name}
          awayName={a.awayTeam.name}
        />
      )}

      {/* Öne çıkan trendler */}
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Öne çıkan trendler</CardTitle>
          <p className="text-sm text-muted-foreground">Son {sample.size} maçta eşiği geçen istatistikler</p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {teamPicks.length === 0 && playerPicks.length === 0 && (
            <p className="text-muted-foreground">Bu maç için eşiği geçen trend yok.</p>
          )}
          {teamPicks.map((t) => (
            <div key={t.code} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0">
              <div className="flex w-40 items-center gap-2">
                <Badge>{t.name}</Badge>
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-44 truncate text-sm text-muted-foreground">{a.homeTeam.name} {generalForm ? "(genel)" : "evinde"}</span>
                  <RateCell s={t.home} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-44 truncate text-sm text-muted-foreground">{a.awayTeam.name} {generalForm ? "(genel)" : "deplasmanda"}</span>
                  <RateCell s={t.away} />
                </div>
              </div>
            </div>
          ))}
          {playerPicks.map((p) => (
            <div key={`${p.playerId}-${p.code}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0">
              <div className="flex w-40 items-center gap-2">
                <Badge variant="secondary">{p.name}</Badge>
              </div>
              <div className="flex flex-1 items-center gap-3">
                <Link href={`/players/${p.playerId}`} className="flex w-44 min-w-0 items-center gap-2 hover:text-primary">
                  <PlayerPhoto id={p.playerId} name={p.playerName} size={28} />
                  <span className="truncate text-sm font-medium">{p.playerName}</span>
                </Link>
                <RateCell s={p.summary} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Skor tahmini */}
      {prediction && (
        <PredictionCard
          p={prediction}
          homeName={a.homeTeam.name}
          awayName={a.awayTeam.name}
          actual={
            finished && match && match.homeScore !== null && match.awayScore !== null
              ? { home: match.homeScore, away: match.awayScore }
              : null
          }
        />
      )}

      {/* Aralarındaki maçlar */}
      <H2HCard
        h={h2h}
        home={a.homeTeam}
        away={a.awayTeam}
        players={h2hPlayers}
        filterHref={(f) => hrefFor(sample, f)}
      />

      {/* Takım karneleri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Takım istatistikleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TeamTrendGrid
            trends={teamRows}
            home={{ id: a.homeTeam.id, name: a.homeTeam.name, label: homeLabel }}
            away={{ id: a.awayTeam.id, name: a.awayTeam.name, label: awayLabel }}
          />

          {/* Maç maç kanıt */}
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer font-medium">Kanıt: {a.homeTeam.name} son {sample.size} {generalForm ? "" : "iç saha "}maçı</summary>
            <div className="mt-3">
              <EvidenceTable columns={a.teamTrends.map((t) => ({ name: t.name, evidence: t.home.evidence }))} />
            </div>
          </details>
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer font-medium">Kanıt: {a.awayTeam.name} son {sample.size} {generalForm ? "" : "deplasman "}maçı</summary>
            <div className="mt-3">
              <EvidenceTable columns={a.teamTrends.map((t) => ({ name: t.name, evidence: t.away.evidence }))} />
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Oyuncu karneleri */}
      {!a.playerStatsEnabled && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Bu ligde oyuncu istatistikleri takip edilmiyor, yalnızca takım istatistikleri gösteriliyor.
          </CardContent>
        </Card>
      )}

      {/* Geniş ekranda iki takımın oyuncuları yan yana */}
      {a.playerStatsEnabled && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {teams.map(({ team, source }) => (
            <PlayerSection
              key={team.id}
              teamId={team.id}
              teamName={team.name}
              lineup={LINEUP_LABELS[source]}
              trends={a.playerTrends.filter((p) => p.teamId === team.id)}
              players={a.players}
            />
          ))}
        </div>
      )}
    </main>
  );
}
