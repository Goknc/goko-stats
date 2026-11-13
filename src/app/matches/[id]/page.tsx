// src/app/matches/[id]/page.tsx
// Maç detayı: skor, maç istatistikleri, öne çıkan trendler, skor tahmini, aralarındaki maçlar, takım ve oyuncu karneleri.
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_SAMPLE, sampleFromParams, type SampleSettings } from "@/lib/app-settings";
import { SampleBar } from "@/components/sample-bar";
import { analyzeMatch, type RateSummary, type LineupSource } from "@/lib/analysis";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";
import { formatTime, matchDayKey, TZ } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchStrip } from "@/components/match-strip";
import { StripGroup } from "@/components/strip-group";
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

// Karne satırı: üstte etiket, x/y ve vurgulu yüzde (az örnekse belirtilir); altta tam genişlikte maç şeridi
function RateLine({ label, s, slots }: { label: React.ReactNode; s: RateSummary; slots: number }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-lg font-bold">{label}</span>
        {s.total === 0 ? (
          <span className="text-sm text-muted-foreground">veri yok</span>
        ) : (
          <>
            <span className="text-sm tabular-nums text-muted-foreground">
              {s.hits}/{s.total}
            </span>
            {s.lowSample ? (
              <span className="rounded-full border-2 border-foreground bg-white px-2 text-xs font-bold">az örnek</span>
            ) : (
              <RatePercent rate={s.rate} className="poster w-20 text-right text-3xl font-normal" />
            )}
          </>
        )}
      </div>
      {s.total > 0 && <MatchStrip evidence={s.evidence} slots={slots} />}
    </div>
  );
}

// Sayfa içi atlama menüsü
const SECTIONS = [
  { id: "trendler", label: "Hot trendler" },
  { id: "tahmin", label: "Skor tahmini" },
  { id: "aralarinda", label: "Aralarında" },
  { id: "takimlar", label: "Takımlar" },
  { id: "oyuncular", label: "Oyuncular" },
];
const POPS = ["var(--purple)", "var(--pink)", "var(--blue)", "var(--yellow)"];

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

  const kickoff = finished && match ? `${match.homeScore} - ${match.awayScore}` : formatTime(a.eventDate);

  // Posterdeki takım yarısı
  const side = (team: { id: number; name: string }, tag: string, align: "left" | "right") => (
    <Link
      href={`/teams/${team.id}`}
      className={cn("group flex min-w-0 flex-col items-center gap-3 text-center", align === "left" ? "lg:flex-row-reverse lg:text-right" : "lg:flex-row lg:text-left")}
    >
      <span className="photocard size-20 border-[3px] shadow-[6px_6px_0_var(--ink)] transition-transform group-hover:scale-105 group-hover:-rotate-6 sm:size-44">
        <TeamLogo id={team.id} name={team.name} size={128} className="size-14 sm:size-32" />
      </span>
      <span className="min-w-0">
        <span className="marker block text-xl leading-none text-white sm:text-3xl">{tag}</span>
        <span className="poster block text-2xl leading-[0.95] text-white [overflow-wrap:anywhere] [text-shadow:2px_2px_0_var(--ink)] sm:text-5xl sm:[text-shadow:3px_3px_0_var(--ink)] xl:text-6xl">
          {team.name}
        </span>
      </span>
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-[92rem] space-y-9 px-4 py-8 sm:px-8 sm:py-10">
      <Link href={`/?date=${matchDayKey(a.eventDate)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        ← Maç listesi
      </Link>

      {/* VS posteri: sol yarı ev sahibi (mavi), sağ yarı deplasman (pembe), ortada skor/saat sticker'ı */}
      <header className="relative overflow-hidden rounded-[2rem] border-[3px] border-foreground shadow-[10px_10px_0_var(--ink)]">
        <h1 className="sr-only">
          {a.homeTeam.name} – {a.awayTeam.name}
        </h1>
        <div className="absolute inset-0 bg-[linear-gradient(105deg,var(--blue)_0%,#7c9dff_49.7%,var(--ink)_49.7%,var(--ink)_50.3%,#ff8cc4_50.3%,var(--pink)_100%)]" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.22)_1.5px,transparent_1.6px)] bg-[length:16px_16px]" aria-hidden="true" />
        <div className="relative px-3 py-7 sm:px-10 sm:py-12">
          <p className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-full border-2 border-foreground bg-white px-4 py-1 text-center text-sm font-bold shadow-[3px_3px_0_var(--ink)] sm:text-base">
            <LeagueLogo id={a.leagueId} name={a.leagueName} size={22} />
            {a.leagueName} · {formatDateTime(a.eventDate)}
          </p>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-8">
            {side(a.homeTeam, "ev sahibi", "left")}
            <div className="flex flex-col items-center gap-2">
              <div className="poster -rotate-3 whitespace-nowrap rounded-2xl border-[3px] border-foreground bg-[var(--yellow)] px-2 py-1 text-3xl tabular-nums shadow-[5px_5px_0_var(--ink)] sm:px-6 sm:py-2 sm:text-7xl">
                {kickoff}
              </div>
              {!finished && label ? <Badge variant="secondary">{label}</Badge> : <span className="marker text-2xl text-white sm:text-3xl">{finished ? "bitti" : "vs"}</span>}
            </div>
            {side(a.awayTeam, "deplasman", "right")}
          </div>
          <div className="mt-8 text-center">
            <Link href={`/compare?a=${a.homeTeam.id}&b=${a.awayTeam.id}`} className="pop inline-block rounded-full bg-white px-5 py-1.5 font-bold">
              Takımları karşılaştır →
            </Link>
          </div>
        </div>
      </header>

      {/* Atlama menüsü + form ayarı */}
      <div className="space-y-4">
        <nav className="flex flex-wrap gap-2" aria-label="Bölümler">
          {SECTIONS.filter((x) => x.id !== "tahmin" || prediction).map((x, i) => (
            <a
              key={x.id}
              href={`#${x.id}`}
              style={{ "--tw-shadow-color": POPS[i % 4] } as React.CSSProperties}
              className="poster rounded-full border-2 border-foreground bg-white px-4 py-1 text-lg shadow-[3px_3px_0_var(--tw-shadow-color)] transition-transform hover:-translate-y-0.5 hover:-rotate-2 hover:bg-[var(--yellow)]"
            >
              {x.label}
            </a>
          ))}
        </nav>
        <SampleBar value={sample} defaults={defaults} hrefFor={hrefFor} />
      </div>

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

      {/* Öne çıkan trendler: her trend bir photocard; takım trendlerinde iki karne alt alta ve birlikte kayar */}
      <section id="trendler" className="scroll-mt-36">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Hot trendler</CardTitle>
            <p className="text-muted-foreground">Son {sample.size} maçta eşiği geçen istatistikler · en soldaki kutucuk en son maç</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {teamPicks.length === 0 && playerPicks.length === 0 && (
              <p className="text-muted-foreground">Bu maç için eşiği geçen trend yok.</p>
            )}
            {teamPicks.map((t, i) => {
              const slots = Math.max(t.home.evidence.length, t.away.evidence.length);
              return (
                <article
                  key={t.code}
                  style={{ "--pop": POPS[i % 4] } as React.CSSProperties}
                  className="rounded-2xl border-[2.5px] border-foreground bg-white p-4 shadow-[5px_5px_0_var(--pop)] sm:p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h3 className="poster -rotate-1 rounded-xl bg-foreground px-3 py-0.5 text-2xl text-white sm:text-3xl">{t.name}</h3>
                    <Badge variant="secondary">Takım</Badge>
                  </div>
                  <StripGroup className="space-y-2">
                    <RateLine
                      label={
                        <>
                          {a.homeTeam.name} <span className="text-sm font-normal text-muted-foreground">{generalForm ? "genel" : "evinde"}</span>
                        </>
                      }
                      s={t.home}
                      slots={slots}
                    />
                    <RateLine
                      label={
                        <>
                          {a.awayTeam.name} <span className="text-sm font-normal text-muted-foreground">{generalForm ? "genel" : "deplasmanda"}</span>
                        </>
                      }
                      s={t.away}
                      slots={slots}
                    />
                  </StripGroup>
                </article>
              );
            })}
            {playerPicks.length > 0 && (
              <div className="grid gap-6 xl:grid-cols-2">
                {playerPicks.map((p, i) => (
                  <article
                    key={`${p.playerId}-${p.code}`}
                    style={{ "--pop": POPS[(i + teamPicks.length) % 4] } as React.CSSProperties}
                    className="rounded-2xl border-[2.5px] border-foreground bg-white p-4 shadow-[5px_5px_0_var(--pop)]"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="poster -rotate-1 rounded-xl bg-foreground px-3 py-0.5 text-xl text-white">{p.name}</h3>
                      <Badge variant="secondary">Oyuncu</Badge>
                    </div>
                    <RateLine
                      label={
                        <Link href={`/players/${p.playerId}`} className="flex min-w-0 items-center gap-3 hover:text-primary">
                          <span className="photocard overflow-hidden">
                            <PlayerPhoto id={p.playerId} name={p.playerName} size={52} />
                          </span>
                          <span className="truncate">{p.playerName}</span>
                        </Link>
                      }
                      s={p.summary}
                      slots={0}
                    />
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Skor tahmini ve aralarındaki maçlar: geniş ekranda yan yana */}
      <div className="grid items-start gap-9 2xl:grid-cols-2">
        {prediction && (
          <section id="tahmin" className="scroll-mt-36">
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
          </section>
        )}
        <section id="aralarinda" className="scroll-mt-36">
          <H2HCard
            h={h2h}
            home={a.homeTeam}
            away={a.awayTeam}
            players={h2hPlayers}
            filterHref={(f) => hrefFor(sample, f)}
          />
        </section>
      </div>

      {/* Takım karneleri */}
      <section id="takimlar" className="scroll-mt-36">
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
            <details className="rounded-2xl border-2 border-foreground bg-secondary/50 px-4 py-3">
              <summary className="cursor-pointer text-lg font-extrabold">Kanıt: {a.homeTeam.name} son {sample.size} {generalForm ? "" : "iç saha "}maçı</summary>
              <div className="mt-3">
                <EvidenceTable columns={a.teamTrends.map((t) => ({ name: t.name, evidence: t.home.evidence }))} />
              </div>
            </details>
            <details className="rounded-2xl border-2 border-foreground bg-secondary/50 px-4 py-3">
              <summary className="cursor-pointer text-lg font-extrabold">Kanıt: {a.awayTeam.name} son {sample.size} {generalForm ? "" : "deplasman "}maçı</summary>
              <div className="mt-3">
                <EvidenceTable columns={a.teamTrends.map((t) => ({ name: t.name, evidence: t.away.evidence }))} />
              </div>
            </details>
          </CardContent>
        </Card>
      </section>

      {/* Oyuncu karneleri */}
      <section id="oyuncular" className="scroll-mt-36">
        {!a.playerStatsEnabled && (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              Bu ligde oyuncu istatistikleri takip edilmiyor, yalnızca takım istatistikleri gösteriliyor.
            </CardContent>
          </Card>
        )}

        {/* Geniş ekranda iki takımın oyuncuları yan yana */}
        {a.playerStatsEnabled && (
          <div className="grid items-start gap-9 xl:grid-cols-2">
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
      </section>
    </main>
  );
}
