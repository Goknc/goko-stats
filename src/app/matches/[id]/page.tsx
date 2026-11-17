// src/app/matches/[id]/page.tsx
// Maç detayı: skor, maç istatistikleri, öne çıkan trendler, skor tahmini, aralarındaki maçlar, takım karneleri,
// sahaya dizilmiş kadrolar (oyuncu başına son maç kutucukları) ve oyuncu eşik tablosu.
import Link from "next/link";
import { notFound } from "next/navigation";
import { analysisOptions, DEFAULT_SAMPLE, sampleFromParams, sampleParams, type SampleSettings } from "@/lib/app-settings";
import { SampleBar } from "@/components/sample-bar";
import { analyzeMatch, type RateSummary } from "@/lib/analysis";
import { sideCaption, trendTitle } from "@/lib/trend-labels";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";
import { formatTime, matchDayKey, TZ } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchStrip } from "@/components/match-strip";
import { StripGroup } from "@/components/strip-group";
import { RatePercent } from "@/components/rate-percent";
import { EvidenceTable } from "@/components/evidence-table";
import { TeamTrendGrid } from "@/components/team-trend-grid";
import { LineupPitch } from "@/components/lineup-pitch";
import { TeamAura } from "@/components/team-aura";
import { LeagueLogo, PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { H2HCard } from "@/components/h2h-card";
import { loadHeadToHead } from "@/lib/h2h-loader";
import { h2hFilterFromParams, h2hFilterParams, type H2HFilter } from "@/lib/engine/h2h";
import { loadH2HPlayers } from "@/lib/h2h-players-loader";
import { PredictionCard } from "@/components/prediction-card";
import { MatchStatsCard } from "@/components/match-stats-card";
import { predictMatch } from "@/lib/prediction";
import { PlayerBoard } from "@/components/player-board";
import { loadPlayerBoard } from "@/lib/player-board";
import { isNationalTeamLeague } from "@/lib/engine/leagues";

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

const formatDateTime = (d: Date) =>
  d.toLocaleString("tr-TR", { timeZone: TZ, day: "numeric", month: "long", weekday: "long", hour: "2-digit", minute: "2-digit" });

// Karne satırı: üstte etiket, x/y ve vurgulu yüzde (az maç varsa belirtilir); altta tam genişlikte maç şeridi
function RateLine({ label, s, slots }: { label: React.ReactNode; s: RateSummary; slots: number }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-lg font-bold">{label}</span>
        {s.total === 0 ? (
          <span className="text-sm text-muted-foreground">Veri yok</span>
        ) : (
          <>
            <span className="text-sm tabular-nums text-muted-foreground">
              {s.hits}/{s.total}
            </span>
            {s.lowSample ? (
              <span className="rounded-full border-2 border-foreground bg-white px-2 text-xs font-bold">Az maç</span>
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
  { id: "trendler", label: "Trendler" },
  { id: "tahmin", label: "Skor tahmini" },
  { id: "aralarinda", label: "Aralarında" },
  { id: "takimlar", label: "Takımlar" },
  { id: "kadrolar", label: "Kadrolar" },
  { id: "tablo", label: "Oyuncu tablosu" },
];
const POPS = ["var(--purple)", "var(--pink)", "var(--blue)", "var(--yellow)"];

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; n?: string; team?: string; player?: string; esik?: string; h2h?: string; h2hn?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const defaults = DEFAULT_SAMPLE;
  // Maça özel seçim (adres çubuğu): son maç sayısı, form türü, eşik
  const sample = sampleFromParams(query, defaults);
  const a = await analyzeMatch(Number(id), analysisOptions(sample, defaults));
  if (!a) notFound();

  // Aralarındaki maçlar seçimi (saha, maç sayısı)
  const h2hFilter = h2hFilterFromParams(query);

  // Form ve aralarındaki maçlar seçimleri birbirini bozmadan adres çubuğunda durur
  const hrefFor = (next: SampleSettings, nextH2h: H2HFilter = h2hFilter) => {
    const q = new URLSearchParams();
    if (query.date) q.set("date", query.date);
    for (const [k, v] of Object.entries(sampleParams(next, defaults))) q.set(k, v);
    for (const [k, v] of Object.entries(h2hFilterParams(nextH2h))) q.set(k, v);
    const qs = q.toString();
    return `/matches/${id}${qs ? `?${qs}` : ""}`;
  };

  const generalForm = sample.teamMode === "all";
  const [match, h2h, prediction, h2hPlayers, board] = await Promise.all([
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
    a.playerStatsEnabled ? loadPlayerBoard(a.squads, a.eventDate) : [],
  ]);
  const finished = match?.status === "finished";
  // Çevirisi olmayan ham durum kodları (1st_half gibi) gösterilmez
  const label = match && statusLabel(match.status) !== match.status ? statusLabel(match.status) : "";

  const teamRows = a.teamTrends;
  const teamPicks = teamRows.filter((t) => t.recommended);
  const playerPicks = a.playerTrends
    .filter((p) => p.recommended)
    .sort((x, y) => (y.summary.rate ?? 0) - (x.summary.rate ?? 0));

  const hasSquad = a.squads.home.source !== "NONE" || a.squads.away.source !== "NONE";

  const kickoff = finished && match ? `${match.homeScore} - ${match.awayScore}` : formatTime(a.eventDate);

  // Trend kartında takım satırının etiketi: ad + (tek takıma bakan trendde) "Kazandı / Kaybetti", saha modunda "Evinde / Deplasmanda"
  const lineLabel = (t: (typeof teamRows)[number], which: "home" | "away") => {
    const note = sideCaption(t, which) ?? (generalForm ? null : which === "home" ? "Evinde" : "Deplasmanda");
    return (
      <>
        {which === "home" ? a.homeTeam.name : a.awayTeam.name}
        {note && <span className="ml-2 text-sm font-semibold text-muted-foreground">{note}</span>}
      </>
    );
  };

  // Posterdeki takım yarısı. Üstüne gelince logo öne çıkar, arkasında takıma özel animasyon (listede yoksa alev halkası) döner.
  const side = (team: { id: number; name: string }, tag: string, align: "left" | "right") => (
    <Link
      href={`/teams/${team.id}`}
      className={cn("group flex min-w-0 flex-col items-center gap-3 text-center", align === "left" ? "lg:flex-row-reverse lg:text-right" : "lg:flex-row lg:text-left")}
    >
      <span className="relative shrink-0">
        <TeamAura teamId={team.id} className="absolute -inset-[38%] size-[176%]" />
        <span className="photocard relative size-20 border-[3px] shadow-[6px_6px_0_var(--ink)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 sm:size-44">
          <TeamLogo id={team.id} name={team.name} size={128} className="size-14 sm:size-32" />
        </span>
      </span>
      <span className="relative min-w-0">
        <span className="marker block text-xl leading-none text-white sm:text-3xl">{tag}</span>
        <span
          className={cn(
            "poster block leading-[0.95] text-white [text-shadow:2px_2px_0_var(--ink)] sm:[text-shadow:3px_3px_0_var(--ink)]",
            // Uzun adlar bölünmesin diye küçülür; çok kelimeli adlar kelime aralarından kırılır
            team.name.length > 9 ? "text-lg sm:text-4xl xl:text-5xl" : "text-2xl sm:text-5xl xl:text-6xl",
            team.name.includes(" ") ? "" : "max-sm:[overflow-wrap:anywhere]",
          )}
        >
          {team.name}
        </span>
      </span>
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-[92rem] space-y-9 px-4 py-8 sm:px-8 sm:py-10">
      <Link href={`/?date=${matchDayKey(a.eventDate)}`} className="pop inline-block rounded-full bg-[var(--yellow)] px-4 py-1.5 text-sm font-bold">
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
          <p className="relative z-10 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-full border-2 border-foreground bg-white px-4 py-1 text-center text-sm font-bold shadow-[3px_3px_0_var(--ink)] sm:text-base">
            <LeagueLogo id={a.leagueId} name={a.leagueName} size={22} />
            {a.leagueName} · {formatDateTime(a.eventDate)}
          </p>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-8">
            {side(a.homeTeam, "Ev sahibi", "left")}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="poster -rotate-3 whitespace-nowrap rounded-2xl border-[3px] border-foreground bg-[var(--yellow)] px-2 py-1 text-3xl tabular-nums shadow-[5px_5px_0_var(--ink)] sm:px-6 sm:py-2 sm:text-7xl">
                {kickoff}
              </div>
              {!finished && label ? <Badge variant="secondary">{label}</Badge> : <span className="marker text-2xl text-white sm:text-3xl">{finished ? "Bitti" : "vs"}</span>}
            </div>
            {side(a.awayTeam, "Deplasman", "right")}
          </div>
          <div className="relative z-10 mt-8 text-center">
            <Link href={`/compare?a=${a.homeTeam.id}&b=${a.awayTeam.id}`} className="pop inline-block rounded-full bg-white px-5 py-1.5 font-bold">
              Takımları karşılaştır →
            </Link>
          </div>
        </div>
      </header>

      {/* Atlama menüsü + analiz ayarı */}
      <div className="space-y-4">
        <nav className="flex flex-wrap gap-2" aria-label="Bölümler">
          {SECTIONS.filter((x) => (x.id !== "tahmin" || prediction) && (x.id !== "kadrolar" || hasSquad) && (x.id !== "tablo" || board.length > 0)).map((x, i) => (
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
            <CardTitle className="text-xl">Trendler</CardTitle>
            <p className="text-muted-foreground">Son {sample.size} maçta eşiği geçen istatistikler. En soldaki kutucuk en son maçtır.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {teamPicks.length === 0 && playerPicks.length === 0 && (
              <p className="text-muted-foreground">Bu maçta eşiği geçen bir istatistik yok.</p>
            )}
            {teamPicks.map((t, i) => {
              const slots = Math.max(t.home.evidence.length, t.away.evidence.length);
              // Tek takıma bakan trendde kararı veren takım üstte
              const order = t.side === "AWAY" ? (["away", "home"] as const) : (["home", "away"] as const);
              return (
                <article
                  key={t.code}
                  style={{ "--pop": POPS[i % 4] } as React.CSSProperties}
                  className="rounded-2xl border-[2.5px] border-foreground bg-white p-4 shadow-[5px_5px_0_var(--pop)] sm:p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h3 className="poster -rotate-1 rounded-xl bg-foreground px-3 py-0.5 text-2xl text-white sm:text-3xl">
                      {trendTitle(t, a.homeTeam.name, a.awayTeam.name)}
                    </h3>
                    <Badge variant="secondary">Takım</Badge>
                  </div>
                  <StripGroup className="space-y-2">
                    {order.map((which) => (
                      <RateLine key={which} label={lineLabel(t, which)} s={t[which]} slots={slots} />
                    ))}
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
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Takım istatistikleri</CardTitle>
            <p className="text-muted-foreground">
              {generalForm
                ? `Her takımın son ${sample.size} maçı. Çubuktaki dikey çizgi eşiği gösterir.`
                : `Ev sahibinin son ${sample.size} iç saha, deplasman takımının son ${sample.size} deplasman maçı. Çubuktaki dikey çizgi eşiği gösterir.`}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <TeamTrendGrid trends={teamRows} home={a.homeTeam} away={a.awayTeam} />

            {/* Maç maç döküm */}
            {[
              { team: a.homeTeam, key: "home" as const, venue: "iç saha " },
              { team: a.awayTeam, key: "away" as const, venue: "deplasman " },
            ].map(({ team, key, venue }) => (
              <details key={team.id} className="group rounded-2xl border-2 border-foreground bg-secondary/50 px-4 py-3">
                <summary className="flex cursor-pointer items-center gap-2 text-lg font-extrabold">
                  <TeamLogo id={team.id} name={team.name} size={24} />
                  {team.name}: son {sample.size} {generalForm ? "" : venue}maç
                  <span className="ml-auto text-sm font-semibold text-muted-foreground group-open:hidden">Göster</span>
                  <span className="ml-auto hidden text-sm font-semibold text-muted-foreground group-open:inline">Gizle</span>
                </summary>
                <div className="mt-3">
                  <EvidenceTable
                    columns={a.teamTrends.map((t) => ({ name: trendTitle(t, a.homeTeam.name, a.awayTeam.name), evidence: t[key].evidence }))}
                  />
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Kadrolar: ilk 11 sahada, yedekler altında */}
      {hasSquad && (
        <section id="kadrolar" className="scroll-mt-36">
          <LineupPitch home={a.homeTeam} away={a.awayTeam} squads={a.squads} board={board} national={isNationalTeamLeague(a.leagueId)} />
        </section>
      )}

      {/* Oyuncu eşik tablosu: seçilen istatistikte son maçlar kutucuk kutucuk */}
      {board.length > 0 && (
        <section id="tablo" className="scroll-mt-36">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Oyuncu tablosu</CardTitle>
              <p className="text-muted-foreground">İstatistiği, maç sayısını ve eşiği seç; her oyuncunun son maçlarında eşiği kaç kez geçtiğini gör.</p>
            </CardHeader>
            <CardContent>
              <PlayerBoard home={a.homeTeam} away={a.awayTeam} players={board} national={isNationalTeamLeague(a.leagueId)} />
            </CardContent>
          </Card>
        </section>
      )}

      {!a.playerStatsEnabled && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Bu turnuvada oyuncu istatistikleri tutulmuyor; yalnızca takım istatistikleri gösteriliyor.
          </CardContent>
        </Card>
      )}
    </main>
  );
}
