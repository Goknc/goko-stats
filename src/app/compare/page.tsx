// src/app/compare/page.tsx
// Takım karşılaştırma: iki takımın son maçlardaki formu, öne çıkan sayıları, ortalamaları, maç trendleri ve aralarındaki maçlar.
// Adres: /compare?a=12&b=34&venue=all&comp=all&last=10. Takımlar arama kutusuyla seçilir.
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { loadTeamPage, type TeamPageMatch } from "@/lib/team-page";
import { loadHeadToHead } from "@/lib/h2h-loader";
import { h2hFilterFromParams, h2hFilterParams } from "@/lib/engine/h2h";
import { teamProfile, type MatchTrendDef, type TeamProfile } from "@/lib/engine/matchup";
import type { CompFilter, Result, Venue } from "@/lib/engine/team-metrics";
import { TRENDS } from "@/lib/trend-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { H2HCard } from "@/components/h2h-card";
import { SearchBox } from "@/components/search-box";
import { Segmented } from "@/components/segmented";
import { LeagueLogo, TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Search = Partial<Record<"a" | "b" | "venue" | "comp" | "last" | "h2h" | "h2hn", string>>;

const VENUES: { key: Venue; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "home", label: "İç saha" },
  { key: "away", label: "Deplasman" },
];
const COMPS: { key: CompFilter; label: string }[] = [
  { key: "all", label: "Tüm turnuvalar" },
  { key: "league", label: "Lig" },
  { key: "europe", label: "Avrupa" },
];
const LASTS = ["5", "10", "20"] as const;

// Karşılaştırmada iki takımı birlikte ilgilendiren maç trendleri (tek takıma bakanlar hariç)
const MATCH_TRENDS: MatchTrendDef[] = TRENDS.filter((t) => t.scope === "TEAM" && t.side === null);

const RESULT_TONE: Record<Result, string> = { W: "bg-hit-block text-white", D: "bg-[var(--yellow)] text-foreground", L: "bg-miss-block text-white" };
const RESULT_LABEL: Record<Result, string> = { W: "G", D: "B", L: "M" };

const pick = <T extends string>(value: string | undefined, options: readonly { key: T }[], fallback: T): T =>
  options.some((o) => o.key === value) ? (value as T) : fallback;
const fmt = (n: number | null) => (n === null ? "–" : n.toFixed(2).replace(".", ","));
const pct = (r: number | null) => (r === null ? "–" : `%${Math.round(r * 100)}`);

export const metadata = { title: { absolute: "Karşılaştır · Gokostats" } };

type SlotTeam = { id: number; name: string; league: { id: number; name: string } | null };

// Takım seçici: büyük logo photocard'ı, altında arama kutusu. Renk tarafa göre (birinci mavi, ikinci pembe).
function TeamSlot({ team, param }: { team: SlotTeam | null; param: "a" | "b" }) {
  const pop = param === "a" ? "var(--blue)" : "var(--pink)";
  return (
    <div
      style={{ "--pop": pop } as React.CSSProperties}
      className="flex flex-col items-center gap-3 rounded-3xl border-[2.5px] border-foreground bg-card p-5 text-center shadow-[6px_6px_0_var(--pop)]"
    >
      {team ? (
        <Link href={`/teams/${team.id}`} className="group flex flex-col items-center gap-2">
          <span className={cn("photocard size-28 border-[3px] transition-transform group-hover:rotate-0 sm:size-32", param === "a" ? "-rotate-3" : "rotate-3")}>
            <TeamLogo id={team.id} name={team.name} size={88} className="size-20 sm:size-[88px]" />
          </span>
          <span className="poster text-3xl leading-none group-hover:underline sm:text-4xl">{team.name}</span>
          {team.league && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <LeagueLogo id={team.league.id} name={team.league.name} size={16} />
              {team.league.name}
            </span>
          )}
        </Link>
      ) : (
        <>
          <span className="photocard poster size-28 border-[3px] border-dashed text-5xl text-muted-foreground sm:size-32">?</span>
          <p className="poster text-2xl text-muted-foreground">{param === "a" ? "Birinci takımı seç" : "İkinci takımı seç"}</p>
        </>
      )}
      <SearchBox pickParam={param} placeholder={team ? "Takımı değiştir" : "Takım ara"} className="w-full max-w-xs" />
    </div>
  );
}

// Son maçlar şeridi: rakip logosu, skor ve sonuç rengi (en yeni solda)
function RecentStrip({ matches, teamId }: { matches: TeamPageMatch[]; teamId: number }) {
  return (
    <div className="pop-scroll flex gap-1 overflow-x-auto pb-2 pt-2">
      {matches.map((m, i) => {
        const isHome = m.homeTeamId === teamId;
        const f = isHome ? m.homeScore : m.awayScore;
        const a = isHome ? m.awayScore : m.homeScore;
        const result: Result | null = f === null || a === null ? null : f > a ? "W" : f < a ? "L" : "D";
        return (
          <Link
            key={m.id}
            href={`/matches/${m.id}`}
            title={`${m.homeName} ${m.homeScore}-${m.awayScore} ${m.awayName} · ${m.competition}`}
            className={cn(
              "relative flex min-w-[40px] max-w-14 flex-1 basis-0 flex-col items-center gap-0.5 rounded-xl border-2 border-foreground px-0.5 pb-1 pt-1.5 transition-transform hover:-translate-y-1 hover:-rotate-3",
              result === "W" ? "bg-[#b9f5df]" : result === "L" ? "bg-[#ffc2dc]" : "bg-[#fff3a6]",
            )}
          >
            <TeamLogo id={isHome ? m.awayTeamId : m.homeTeamId} name={isHome ? m.awayName : m.homeName} size={24} />
            <span className="poster text-sm leading-none tabular-nums">
              {f}-{a}
            </span>
            {i === 0 && <span className="absolute -right-1 -top-1.5 size-3 rounded-full border-2 border-foreground bg-[var(--yellow)]" />}
          </Link>
        );
      })}
    </div>
  );
}

// Karşılıklı çubuk: ortada etiket, iki yana büyüyen kalın çubuklar; iyi olan taraf renkli ve kalın yazılı
function CompareRow({ label, a, b, format, higherIsBetter = true }: { label: string; a: number | null; b: number | null; format: (n: number | null) => string; higherIsBetter?: boolean }) {
  const better = a !== null && b !== null && a !== b ? ((a > b) === higherIsBetter ? "a" : "b") : null;
  const max = Math.max(a ?? 0, b ?? 0) || 1;
  const bar = (v: number | null, side: "a" | "b") => (
    <div className={cn("flex h-4 flex-1 overflow-hidden rounded-full border-2 border-foreground bg-white", side === "a" && "justify-end")}>
      <div
        className={cn("h-full", better === side ? (side === "a" ? "bg-home" : "bg-away") : "bg-foreground/20")}
        style={{ width: `${((v ?? 0) / max) * 100}%` }}
      />
    </div>
  );
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={cn("poster w-14 shrink-0 text-right text-2xl tabular-nums sm:w-16", better === "a" ? "text-home-text" : "text-foreground/70")}>{format(a)}</span>
        <div className="hidden flex-1 sm:flex">{bar(a, "a")}</div>
      </div>
      <span className="w-28 text-center text-sm font-bold sm:w-44">{label}</span>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden flex-1 sm:flex">{bar(b, "b")}</div>
        <span className={cn("poster w-14 shrink-0 text-2xl tabular-nums sm:w-16", better === "b" ? "text-away-text" : "text-foreground/70")}>{format(b)}</span>
      </div>
    </div>
  );
}

// Seçilen maçlardan öne çıkan sayılar (takım sayfasındaki verilerle aynı kaynak)
function quickFacts(matches: TeamPageMatch[], teamId: number) {
  let points = 0, cleanSheets = 0, blanks = 0, firstHalf = 0, halves = 0, scored = 0, conceded = 0, games = 0;
  let biggest: { diff: number; text: string } | null = null;
  for (const m of matches) {
    const isHome = m.homeTeamId === teamId;
    const f = isHome ? m.homeScore : m.awayScore;
    const a = isHome ? m.awayScore : m.homeScore;
    if (f === null || a === null) continue;
    games++;
    scored += f;
    conceded += a;
    points += f > a ? 3 : f === a ? 1 : 0;
    if (a === 0) cleanSheets++;
    if (f === 0) blanks++;
    const hf = isHome ? m.homeScoreHt : m.awayScoreHt;
    if (hf !== null) {
      firstHalf += hf;
      halves++;
    }
    if (f - a > (biggest?.diff ?? 0)) biggest = { diff: f - a, text: `${f}-${a} · ${isHome ? m.awayName : m.homeName}` };
  }
  return {
    games,
    pointsPerGame: games ? points / games : null,
    goalDiff: scored - conceded,
    cleanSheets,
    blanks,
    firstHalfShare: scored && halves ? firstHalf / scored : null,
    biggest: biggest?.text ?? null,
  };
}

function Fact({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border-2 border-foreground px-2 py-2 text-center", highlight ? "bg-[var(--yellow)] shadow-[3px_3px_0_var(--ink)]" : "bg-white")}>
      <div className="poster text-3xl leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-bold leading-tight text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const venue = pick<Venue>(sp.venue, VENUES, "all");
  const comp = pick<CompFilter>(sp.comp, COMPS, "all");
  const last = LASTS.find((n) => n === sp.last) ?? "10";
  const idA = Number(sp.a);
  const idB = Number(sp.b);

  const [dataA, dataB] = await Promise.all([
    Number.isInteger(idA) && idA > 0 ? loadTeamPage(idA) : null,
    Number.isInteger(idB) && idB > 0 ? loadTeamPage(idB) : null,
  ]);
  const ready = dataA && dataB && dataA.team.id !== dataB.team.id;

  const h2hFilter = h2hFilterFromParams(sp);
  const state: Record<string, string> = { a: sp.a ?? "", b: sp.b ?? "", venue, comp, last, ...h2hFilterParams(h2hFilter) };
  const defaults: Record<string, string> = { a: "", b: "", venue: "all", comp: "all", last: "10" };
  const href = (change: Record<string, string | undefined>) => {
    const next = { ...state, ...change };
    const q = Object.entries(next)
      .filter(([k, v]) => v !== undefined && v !== (defaults[k] ?? ""))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return `/compare${q ? `?${q}` : ""}`;
  };

  const filter = { venue, comp, last: Number(last) };
  // Filtreye uyan son maçlar (şerit ve öne çıkan sayılar için; engine/matchup ile aynı seçim)
  const sampleOf = (matches: TeamPageMatch[], teamId: number) =>
    matches
      .filter((m) => venue === "all" || (venue === "home") === (m.homeTeamId === teamId))
      .filter((m) => comp === "all" || m.competitionType === (comp === "league" ? "LEAGUE" : "EUROPE"))
      .slice(0, filter.last);

  let pa: TeamProfile | null = null;
  let pb: TeamProfile | null = null;
  if (ready) {
    pa = teamProfile(dataA.matches, dataA.team.id, filter, MATCH_TRENDS);
    pb = teamProfile(dataB.matches, dataB.team.id, filter, MATCH_TRENDS);
  }
  const h2h = ready ? await loadHeadToHead(dataA.team.id, dataB.team.id, new Date(), h2hFilter) : null;

  return (
    <main className="mx-auto w-full max-w-[84rem] space-y-9 px-4 py-8 sm:px-8 sm:py-12">
      <div>
        <h1 className="text-2xl font-bold">Karşılaştır</h1>
        <p className="mt-3 text-lg text-muted-foreground">İki takım seç; son maçlarını, ortalamalarını ve aralarındaki maçları yan yana incele.</p>
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <TeamSlot team={dataA ? { ...dataA.team, league: dataA.league } : null} param="a" />
        <div className="flex flex-col items-center gap-2">
          <span className="poster -rotate-6 rounded-2xl border-[3px] border-foreground bg-[var(--yellow)] px-4 py-1 text-4xl shadow-[4px_4px_0_var(--ink)]">VS</span>
          {dataA && dataB && (
            <Link href={href({ a: state.b, b: state.a })} scroll={false} className="pop flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-bold">
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Yer değiştir
            </Link>
          )}
        </div>
        <TeamSlot team={dataB ? { ...dataB.team, league: dataB.league } : null} param="b" />
      </div>

      {dataA && dataB && dataA.team.id === dataB.team.id && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">Aynı takımı iki kez seçtin. Karşılaştırmak için farklı bir takım seç.</CardContent>
        </Card>
      )}

      {ready && pa && pb && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={LASTS.map((n) => ({ key: n, label: `Son ${n}` }))} value={last} href={(k) => href({ last: k })} />
            <Segmented options={VENUES} value={venue} href={(k) => href({ venue: k })} />
            <Segmented options={COMPS} value={comp} href={(k) => href({ comp: k })} />
          </div>

          {/* Form: her takım için sonuç karnesi, son maç şeridi ve öne çıkan sayılar */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Form</CardTitle>
              <p className="text-sm text-muted-foreground">Seçilen son maçlar. Şeritte en soldaki kutucuk en son maçtır; yeşil galibiyet, sarı beraberlik, pembe mağlubiyet.</p>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-2">
              {[
                { data: dataA, p: pa, pop: "var(--blue)" },
                { data: dataB, p: pb, pop: "var(--pink)" },
              ].map(({ data, p, pop }) => {
                const sample = sampleOf(data.matches, data.team.id);
                const q = quickFacts(sample, data.team.id);
                return (
                  <div
                    key={data.team.id}
                    style={{ "--pop": pop } as React.CSSProperties}
                    className="space-y-3 rounded-3xl border-[2.5px] border-foreground bg-secondary/60 p-4 shadow-[5px_5px_0_var(--pop)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="photocard size-12">
                          <TeamLogo id={data.team.id} name={data.team.name} size={32} />
                        </span>
                        <span className="poster text-2xl leading-none">{data.team.name}</span>
                      </div>
                      <div className="flex gap-1.5">
                        {(["W", "D", "L"] as const).map((r) => (
                          <span key={r} className={cn("poster flex h-9 min-w-12 items-center justify-center gap-1 rounded-full border-2 border-foreground px-2 text-lg", RESULT_TONE[r])}>
                            {p.record[r]}
                            <span className="text-xs">{RESULT_LABEL[r]}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    {sample.length === 0 ? (
                      <p className="py-4 text-center text-muted-foreground">Bu filtrelere uyan maç yok.</p>
                    ) : (
                      <>
                        <RecentStrip matches={sample} teamId={data.team.id} />
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Fact label="Maç başına puan" value={fmt(q.pointsPerGame)} highlight />
                          <Fact label="Gol farkı" value={`${q.goalDiff > 0 ? "+" : ""}${q.goalDiff}`} />
                          <Fact label="Gol yemediği maç" value={`${q.cleanSheets}/${q.games}`} />
                          <Fact label="Gol atamadığı maç" value={`${q.blanks}/${q.games}`} />
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-muted-foreground">
                          {q.firstHalfShare !== null && (
                            <span>
                              Gollerinin <strong className="text-foreground">{pct(q.firstHalfShare)}</strong> kadarını ilk yarıda attı
                            </span>
                          )}
                          {q.biggest && (
                            <span>
                              En farklı galibiyeti: <strong className="text-foreground">{q.biggest}</strong>
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Ortalamalar */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Maç başına ortalamalar</CardTitle>
              <p className="text-sm text-muted-foreground">Her istatistikte önce takımın kendi ortalaması, altında rakiplerinin ona karşı ortalaması yer alır.</p>
            </CardHeader>
            <CardContent>
              <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b-2 border-foreground pb-3 sm:gap-4">
                <span className="flex items-center justify-start gap-2 font-extrabold text-home-text">
                  <TeamLogo id={dataA.team.id} name={dataA.team.name} size={24} />
                  <span className="truncate">{dataA.team.name}</span>
                </span>
                <span className="w-28 sm:w-44" />
                <span className="flex items-center justify-end gap-2 font-extrabold text-away-text">
                  <span className="truncate">{dataB.team.name}</span>
                  <TeamLogo id={dataB.team.id} name={dataB.team.name} size={24} />
                </span>
              </div>
              <div className="divide-y-2 divide-dashed divide-border">
                <CompareRow label="Galibiyet oranı" a={pa.games ? pa.record.W / pa.games : null} b={pb.games ? pb.record.W / pb.games : null} format={pct} />
                {pa.categories.map((c, i) => {
                  const cb = pb.categories[i];
                  return (
                    <div key={c.key}>
                      <CompareRow label={c.key === "goals" ? "Attığı gol" : c.label} a={c.for} b={cb.for} format={fmt} />
                      <CompareRow
                        label={c.key === "goals" ? "Yediği gol" : `Rakibin: ${c.label.toLocaleLowerCase("tr")}`}
                        a={c.against}
                        b={cb.against}
                        format={fmt}
                        higherIsBetter={c.key === "cards" || c.key === "fouls"}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Maç trendleri: iki takımın oranı karşılıklı çubuklarla */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Maç trendleri</CardTitle>
              <p className="text-sm text-muted-foreground">Her takımın seçilen son maçlarının kaçında gerçekleştiği.</p>
            </CardHeader>
            <CardContent className="divide-y-2 divide-dashed divide-border">
              {pa.trends.map((t, i) => {
                const tb = pb.trends[i];
                const cell = (x: typeof t, side: "a" | "b") => (
                  <div className={cn("flex items-center gap-2 sm:gap-3", side === "a" && "flex-row-reverse")}>
                    <div className={cn("hidden h-4 flex-1 overflow-hidden rounded-full border-2 border-foreground bg-white sm:flex", side === "a" && "justify-end")}>
                      <div className={cn("h-full", (x.rate ?? 0) >= 0.6 ? "bg-hit-block" : "bg-[var(--lilac)]")} style={{ width: `${Math.round((x.rate ?? 0) * 100)}%` }} />
                    </div>
                    <span className={cn("flex shrink-0 items-baseline gap-1.5", side === "a" && "flex-row-reverse")}>
                      <span className={cn("poster w-14 text-2xl tabular-nums", side === "a" && "text-right", (x.rate ?? 0) >= 0.6 && "text-hit")}>{pct(x.rate)}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {x.hits}/{x.total}
                      </span>
                    </span>
                  </div>
                );
                return (
                  <div key={t.code} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 sm:gap-4">
                    {cell(t, "a")}
                    <span className="w-28 text-center text-sm font-bold sm:w-44">{t.name}</span>
                    {cell(tb, "b")}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {h2h && (
            <H2HCard
              h={h2h}
              home={dataA.team}
              away={dataB.team}
              // h2h/h2hn önce silinir, sonra yalnızca varsayılandan farklı olanlar yazılır
              filterHref={(f) => href({ h2h: undefined, h2hn: undefined, ...h2hFilterParams(f) })}
            />
          )}
        </>
      )}
    </main>
  );
}
