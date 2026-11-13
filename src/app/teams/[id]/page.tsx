// src/app/teams/[id]/page.tsx
// Takım sayfası: son maçlarda takım istatistikleri (gol, korner, şut, kart...) ve oyuncu tablosu, liste ya da grafik.
// Filtreler adres satırında: ?tab=oyuncu&view=grafik&cat=corners&period=H1&venue=home&comp=league&last=20&stat=shotsTotal
// Oyuncu sekmesi yalnızca oyuncu verisi açık liglerde; ligde kapatılan istatistikler seçeneklerde görünmez.
// Oyuncu ortalamaları yalnızca ilk 11 maçlarından (öne çıkanlardaki örnek kuralıyla aynı).
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTeamPage, loadPlayerGrid } from "@/lib/team-page";
import { lineRate, DEFAULT_PLAYER_LINES } from "@/lib/engine/player-line";
import {
  teamMetrics, defaultLine, lineHitRate, CATEGORIES,
  type Category, type Period, type Venue, type CompFilter, type LineRate, type LineDir, type TeamMatch,
} from "@/lib/engine/team-metrics";
import type { GridStat, GridRow } from "@/lib/engine/player-grid";
import { TZ } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, type Bar } from "@/components/bar-chart";
import { FilterSelect } from "@/components/filter-select";
import { LeagueLogo, PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { Segmented } from "@/components/segmented";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Tab = "takim" | "oyuncu";
type View = "liste" | "grafik";
type Side = "total" | "for" | "against";
type Search = Partial<Record<"tab" | "view" | "cat" | "period" | "venue" | "comp" | "last" | "stat" | "side" | "dir" | "line" | "player", string>>;

const PERIODS: { key: Period; label: string }[] = [
  { key: "FULL", label: "Maç" },
  { key: "H1", label: "1. yarı" },
  { key: "H2", label: "2. yarı" },
];
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
const VIEWS: { key: View; label: string }[] = [
  { key: "liste", label: "Liste" },
  { key: "grafik", label: "Grafik" },
];
const DIRS: { key: LineDir; label: string }[] = [
  { key: "over", label: "Üstü" },
  { key: "under", label: "Altı" },
];
const LASTS = [5, 10, 20] as const;
const TEAM_CATEGORIES = CATEGORIES;

const pick = <T extends string>(value: string | undefined, options: readonly { key: T }[], fallback: T): T =>
  options.some((o) => o.key === value) ? (value as T) : fallback;

const shortDate = (d: Date) => d.toLocaleDateString("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" });
const fmt = (n: number | null, digits = 2) => (n === null ? "–" : n.toFixed(digits).replace(".", ","));
const fmtLine = (n: number) => String(n).replace(".", ",");
const pctOf = (r: number | null) => (r === null ? "–" : `%${Math.round(r * 100)}`);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const data = await loadTeamPage(Number((await params).id));
  return { title: { absolute: `${data?.team.name ?? "Takım bulunamadı"} · Gokostats` } };
}

function AvgTile({ label, value, tone }: { label: string; value: number | null; tone?: string }) {
  return (
    <div className="rounded-2xl border-2 border-foreground bg-secondary px-3 py-3 text-center">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-extrabold tabular-nums sm:text-3xl", tone)}>{fmt(value)}</div>
    </div>
  );
}

// Yeşil skala (trendlerle aynı): %80+ koyu yeşil, %60+ açık yeşil, altı gri
const rateTone = (rate: number) =>
  rate >= 0.8 ? "bg-hit-block text-white" : rate >= 0.6 ? "bg-hit/20 text-hit" : "bg-secondary text-muted-foreground";

function LineChips({ title, lines }: { title: string; lines: LineRate[] }) {
  if (!lines.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{title}</span>
      {lines.map((l) => (
        <span key={l.line} className={cn("rounded-md px-2.5 py-1 tabular-nums", rateTone(l.total ? l.hits / l.total : 0))}>
          {fmtLine(l.line)} üstü <strong>{l.hits}/{l.total}</strong>
        </span>
      ))}
    </div>
  );
}

// Grafik başlığı: çizgi ± düğmeleri, üst/alt, isabet
function ChartControls({
  line, dir, rate, avg, hrefLine, hrefDir, extra,
}: {
  line: number;
  dir: LineDir;
  rate: LineRate;
  avg: number | null;
  hrefLine: (l: number) => string;
  hrefDir: (d: LineDir) => string;
  extra?: React.ReactNode;
}) {
  const r = rate.total ? rate.hits / rate.total : 0;
  const step = "flex size-7 items-center justify-center rounded-md bg-secondary text-lg font-bold text-muted-foreground hover:text-foreground";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {extra}
      <Segmented options={DIRS} value={dir} href={hrefDir} />
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Çizgi</span>
        {line > 0.5 ? (
          <Link href={hrefLine(line - 1)} scroll={false} className={step} aria-label="Çizgiyi düşür">−</Link>
        ) : (
          <span className={cn(step, "opacity-40")}>−</span>
        )}
        <span className="w-8 text-center font-bold tabular-nums">{fmtLine(line)}</span>
        <Link href={hrefLine(line + 1)} scroll={false} className={step} aria-label="Çizgiyi yükselt">+</Link>
      </div>
      <div className="ml-auto flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          Ort. <strong className="tabular-nums text-foreground">{fmt(avg)}</strong>
        </span>
        <span className={cn("rounded-md px-2.5 py-1 font-bold tabular-nums", rateTone(r))}>
          %{Math.round(r * 100)} ({rate.hits}/{rate.total})
        </span>
      </div>
    </div>
  );
}

const RESULT_TONE = { W: "bg-hit-block text-white", D: "bg-secondary text-foreground", L: "bg-miss-block text-white" } as const;
const RESULT_LABEL = { W: "G", D: "B", L: "M" } as const;

export default async function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const teamId = Number((await params).id);
  const sp = await searchParams;
  const data = await loadTeamPage(teamId);
  if (!data) notFound();

  const playersAvailable = data.playerStats.length > 0;
  const tab: Tab = sp.tab === "oyuncu" && playersAvailable ? "oyuncu" : "takim";
  const view = pick<View>(sp.view, VIEWS, "liste");

  const catOptions = TEAM_CATEGORIES;
  const category = pick<Category>(sp.cat, catOptions, catOptions[0].key);
  const periodOptions = PERIODS;
  const period = pick<Period>(sp.period, periodOptions, periodOptions[0].key);
  const statOptions = data.playerStats;
  const venue = pick<Venue>(sp.venue, VENUES, "all");
  const comp = pick<CompFilter>(sp.comp, COMPS, "all");
  const last = LASTS.find((n) => String(n) === sp.last) ?? 10;
  const stat = pick<GridStat>(sp.stat, statOptions, statOptions[0]?.key ?? "goals");
  const side = pick<Side>(sp.side, [{ key: "total" }, { key: "for" }, { key: "against" }], "total");
  const dir = pick<LineDir>(sp.dir, DIRS, "over");
  const lineParam = Number(sp.line);

  const state = {
    tab, view, cat: category, period, venue, comp, last: String(last), stat, side, dir,
    line: sp.line ?? "", player: sp.player ?? "",
  };
  const defaults: Record<string, string | undefined> = {
    tab: "takim", view: "liste", cat: catOptions[0].key, period: periodOptions[0].key, venue: "all", comp: "all", last: "10",
    stat: statOptions[0]?.key, side: "total", dir: "over", line: "", player: "",
  };
  // Filtre değişince çizgi ortalamaya göre yeniden seçilsin diye line sıfırlanır (yalnızca çizgi düğmeleri korur)
  const href = (change: Partial<typeof state>) => {
    const next = { ...state, line: "", ...change };
    const q = Object.entries(next)
      .filter(([k, v]) => v !== defaults[k])
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return `/teams/${teamId}${q ? `?${q}` : ""}`;
  };

  const metrics = teamMetrics(data.matches, teamId, { category, period, venue, comp, last });

  // Oyuncu sekmesi: oyuncu verisi olan maçlardan son N (yarı filtresi yok, oyuncu verisi maç geneli)
  let gridMatches: typeof data.matches = [];
  let grid: GridRow[] = [];
  if (tab === "oyuncu") {
    gridMatches = data.matches
      .filter((m) => m.hasPlayerData)
      .filter((m) => venue === "all" || (venue === "home") === (m.homeTeamId === teamId))
      .filter((m) => comp === "all" || m.competitionType === (comp === "league" ? "LEAGUE" : "EUROPE"))
      .slice(0, last);
    grid = await loadPlayerGrid(teamId, gridMatches.map((m) => m.id), stat);
  }

  // Listede: ilk 11'de en az bir maçı olanlar; adı bilinmeyen kayıtlar ("Oyuncu #4501") gösterilmez
  const starters = grid.filter((r) => r.starts > 0 && !/^Oyuncu #\d+$/.test(r.name));
  const matchById = new Map(gridMatches.map((m) => [m.id, m]));

  // İsabet: istatistiğin varsayılan çizgisini (Top kapma 3+...) geçtiği ilk 11 maçlarının payı
  const defaultPlayerLine = DEFAULT_PLAYER_LINES[stat] ?? 1;
  const rateOf = new Map(starters.map((r) => [r.playerId, lineRate(r.played, defaultPlayerLine)]));
  const listPlayers = starters.sort(
    (x, y) => (rateOf.get(y.playerId) ?? -1) - (rateOf.get(x.playerId) ?? -1) || y.starts - x.starts,
  );

  const catLabel = catOptions.find((c) => c.key === category)!.label;
  const statLabel = data.playerStats.find((s) => s.key === stat)?.label ?? "";
  const shown = tab === "takim" ? metrics.rows.length : gridMatches.length;
  const forLabel = category === "goals" ? "Attığı" : "Takım";
  const againstLabel = category === "goals" ? "Yediği" : "Rakip";
  const opponentOf = (m: TeamMatch) => (m.homeTeamId === teamId ? m.awayName : m.homeName);

  // ----- Takım grafiği -----
  const teamValues = metrics.rows.map((r) => (side === "for" ? r.for : side === "against" ? r.against : r.total));
  const teamAvg = side === "for" ? metrics.avgFor : side === "against" ? metrics.avgAgainst : metrics.avgTotal;
  const teamLine = lineParam > 0 ? lineParam : defaultLine(teamAvg);
  const teamDir: LineDir = dir;
  const teamBars: Bar[] = metrics.rows.map((r, i) => ({
    key: r.match.id,
    value: teamValues[i],
    label: shortDate(r.match.eventDate).slice(0, 5),
    sub: `${r.isHome ? "İç" : "Dış"} · ${opponentOf(r.match)}`,
    title: `${r.match.homeName} ${r.match.homeScore}-${r.match.awayScore} ${r.match.awayName} · ${r.match.competition}`,
    href: `/matches/${r.match.id}`,
  }));

  // ----- Oyuncu grafiği: seçilen oyuncunun ilk 11 maçları -----
  const chartPlayers = listPlayers;
  const chosen = chartPlayers.find((r) => String(r.playerId) === sp.player) ?? chartPlayers[0];
  const playerBars: Bar[] = chosen
    ? chosen.played
        .filter((p) => p.started)
        .map((p) => {
          const m = matchById.get(p.matchId)!;
          return {
            key: m.id,
            value: p.value,
            label: shortDate(m.eventDate).slice(0, 5),
            sub: `${m.homeTeamId === teamId ? "İç" : "Dış"} · ${opponentOf(m)}`,
            title: `${m.homeName} ${m.homeScore}-${m.awayScore} ${m.awayName} · ${p.minutes}'`,
            href: `/matches/${m.id}`,
          };
        })
    : [];
  const playerLine = lineParam > 0 ? lineParam : defaultLine(chosen?.avg ?? null);

  return (
    <main className="mx-auto w-full max-w-[92rem] space-y-9 px-4 py-8 sm:px-8 sm:py-12">
      {/* Başlık */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
          {/* Büyük logo photocard'ı */}
          <span className="photocard size-36 -rotate-3 border-[3px] shadow-[8px_8px_0_var(--blue)] transition-transform hover:rotate-0 sm:size-48">
            <TeamLogo id={data.team.id} name={data.team.name} size={140} className="size-24 sm:size-36" />
          </span>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{data.team.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2 font-bold">
              {data.league && (
                <span className="flex items-center gap-2 rounded-full border-2 border-foreground bg-[var(--lilac)] px-3 py-1">
                  <LeagueLogo id={data.league.id} name={data.league.name} size={22} />
                  {data.league.name}
                </span>
              )}
              <Link href={`/compare?a=${data.team.id}`} className="pop rounded-full bg-white px-3 py-1">
                Başka bir takımla karşılaştır →
              </Link>
            </div>
          </div>
        </div>
        {tab === "takim" && metrics.rows.length > 0 && (
          <div className="tiles flex gap-3 text-center">
            {(
              [
                ["Maç", metrics.rows.length, ""],
                ["G", metrics.record.W, "text-hit"],
                ["B", metrics.record.D, "text-muted-foreground"],
                ["M", metrics.record.L, "text-miss"],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className="tile min-w-16 rounded-2xl border-[2.5px] border-foreground bg-white px-3 py-2">
                <div className="poster text-sm text-muted-foreground">{label}</div>
                <div className={cn("poster text-4xl leading-none tabular-nums", tone)}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Sekmeler */}
      <nav className="flex flex-wrap gap-2.5">
        {(playersAvailable ? (["takim", "oyuncu"] as const) : (["takim"] as const)).map((key) => (
          <Link
            key={key}
            href={href({ tab: key })}
            scroll={false}
            className={cn(
              "poster rounded-full border-2 border-foreground px-5 py-1.5 text-xl transition-transform hover:-rotate-1",
              tab === key ? "-rotate-1 bg-[var(--yellow)] shadow-[3px_3px_0_var(--pink)]" : "bg-white",
            )}
          >
            {key === "takim" ? "Takım istatistikleri" : "Oyuncu istatistikleri"}
          </Link>
        ))}
      </nav>
      {!playersAvailable && (
        <p className="text-sm text-muted-foreground">Bu ligde oyuncu istatistikleri takip edilmiyor, yalnızca takım istatistikleri var.</p>
      )}

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2">
        <Segmented options={VIEWS} value={view} href={(k) => href({ view: k })} />
        <Segmented options={VENUES} value={venue} href={(k) => href({ venue: k })} />
        <Segmented options={LASTS.map((n) => ({ key: String(n), label: `Son ${n}` }))} value={String(last)} href={(k) => href({ last: k })} />
        {tab === "takim" && periodOptions.length > 1 && <Segmented options={periodOptions} value={period} href={(k) => href({ period: k })} />}
        <Segmented options={COMPS} value={comp} href={(k) => href({ comp: k })} />
      </div>
      <div className="overflow-x-auto">
        {tab === "takim" ? (
          <Segmented options={catOptions} value={category} href={(k) => href({ cat: k })} />
        ) : (
          <Segmented options={statOptions} value={stat} href={(k) => href({ stat: k })} />
        )}
      </div>

      {shown === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Bu filtrelerle {tab === "takim" && category !== "goals" ? `${catLabel.toLocaleLowerCase("tr")} verisi olan ` : ""}maç yok.
          </CardContent>
        </Card>
      )}

      {/* Takım: liste */}
      {tab === "takim" && view === "liste" && shown > 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-3 gap-2">
              <AvgTile label="Toplam" value={metrics.avgTotal} />
              <AvgTile label={forLabel} value={metrics.avgFor} tone="text-hit" />
              <AvgTile label={againstLabel} value={metrics.avgAgainst} />
            </div>
            <div className="space-y-2">
                  <LineChips title="Toplam" lines={metrics.totalLines} />
                  <LineChips title={forLabel} lines={metrics.forLines} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-normal">Tarih</th>
                    <th className="py-2 pr-3 font-normal">Maç</th>
                    <th className="hidden py-2 pr-3 font-normal md:table-cell">Turnuva</th>
                    <th className="py-2 pr-3 text-right font-normal">{forLabel}</th>
                    <th className="py-2 pr-3 text-right font-normal">{againstLabel}</th>
                    <th className="py-2 text-right font-normal">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.rows.map((r) => {
                    const m = r.match;
                    return (
                      <tr key={m.id} className="border-t border-border">
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">{shortDate(m.eventDate)}</td>
                        <td className="py-2 pr-3">
                          <Link href={`/matches/${m.id}`} className="flex items-center gap-2 hover:text-primary">
                            {r.result && (
                              <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-bold", RESULT_TONE[r.result])}>
                                {RESULT_LABEL[r.result]}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className={cn(r.isHome && "font-semibold")}>{m.homeName}</span>{" "}
                              <strong className="tabular-nums">
                                {m.homeScore}-{m.awayScore}
                              </strong>{" "}
                              <span className={cn(!r.isHome && "font-semibold")}>{m.awayName}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="hidden py-2 pr-3 text-muted-foreground md:table-cell">{m.competition}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums text-hit">
                          {r.for}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{r.against}</td>
                        <td className="py-2 text-right font-bold tabular-nums">
                          {r.total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {catLabel}
              {period !== "FULL" ? ` · ${PERIODS.find((p) => p.key === period)!.label}` : ""} ·{" "}
              çizgilerde &quot;üstü&quot; = çizginin üstünde biten maç sayısı.{" "}
              Yalnızca takip edilen lig ve Avrupa maçları; yerel kupalar yok.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Takım: grafik */}
      {tab === "takim" && view === "grafik" && shown > 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <ChartControls
              line={teamLine}
              dir={teamDir}
              avg={teamAvg}
              rate={lineHitRate(teamValues, teamLine, teamDir)}
              hrefLine={(l) => href({ line: String(l), dir: teamDir })}
              hrefDir={(d) => href({ dir: d, line: String(teamLine) })}
              extra={
                <Segmented
                  options={[
                    { key: "total", label: "Toplam" },
                    { key: "for", label: forLabel },
                    { key: "against", label: againstLabel },
                  ] as const}
                  value={side}
                  href={(k) => href({ side: k })}
                />
              }
            />
            <BarChart bars={teamBars} line={teamLine} dir={teamDir} />
            <p className="text-xs text-muted-foreground">
              {catLabel}
              {period !== "FULL" ? ` · ${PERIODS.find((p) => p.key === period)!.label}` : ""} · soldan sağa en yeniden eskiye · çizgiyi{" "}
              {teamDir === "over" ? "geçen" : "geçmeyen"} maçlar yeşil.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Oyuncu: liste. Her oyuncunun yalnızca oynadığı maçlar, boşluksuz ve en yeniden eskiye */}
      {tab === "oyuncu" && view === "liste" && shown > 0 && (
        <Card>
          <CardContent className="pt-6">
            {/* Tablo: ad sütunu en uzun ada göre genişler (kısaltma yok), sonra ortalama, maç sayısı ve maç kutuları */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="whitespace-nowrap pb-2 pr-6 font-normal">Oyuncu</th>
                    <th className="whitespace-nowrap pb-2 pr-6 text-right font-normal">
                      İsabet ({defaultPlayerLine}+)
                    </th>
                    <th className="whitespace-nowrap pb-2 pr-6 text-right font-normal">Maç</th>
                    <th className="w-full pb-2 font-normal">Son maçlar · en yeni solda</th>
                  </tr>
                </thead>
                <tbody>
                  {listPlayers.map((row) => (
                    <tr key={row.playerId} className="border-t border-border">
                      <td className="whitespace-nowrap py-2 pr-6">
                        <Link href={`/players/${row.playerId}`} className="flex items-center gap-2 font-semibold hover:text-primary">
                          <PlayerPhoto id={row.playerId} name={row.name} size={28} />
                          {row.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-6 text-right font-bold tabular-nums text-hit">{pctOf(rateOf.get(row.playerId) ?? null)}</td>
                      <td className="py-2 pr-6 text-right tabular-nums text-muted-foreground">{row.starts}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {row.played.map((p) => {
                            const m = matchById.get(p.matchId)!;
                            const title = `${m.homeName} ${m.homeScore}-${m.awayScore} ${m.awayName} · ${shortDate(m.eventDate)} · ${p.minutes}'`;
                            const line = defaultPlayerLine;
                            return (
                              <Link
                                key={p.matchId}
                                href={`/matches/${p.matchId}`}
                                title={p.started ? title : `${title} · yedekten girdi, ortalamaya katılmaz`}
                                className={cn(
                                  "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-opacity hover:opacity-80",
                                  !p.started
                                    ? "border border-dashed border-border text-muted-foreground/60"
                                    : p.value >= line
                                      ? "bg-hit-block text-white"
                                      : "bg-secondary text-muted-foreground",
                                )}
                              >
                                {p.value}
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {statLabel} · son {gridMatches.length} maç, yalnızca oynadığı maçlar. İsabet = {defaultPlayerLine}+ yaptığı ilk 11 maçı ÷ ilk 11
              maç sayısı (Maç sütunu). Yedekten girdiği maçlar kesikli çerçeveyle gösterilir, hesaba katılmaz. Kutunun üzerine gelince maç,
              tıklayınca maç sayfası; oyuncu adına tıklayınca oyuncu sayfası açılır.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Oyuncu: grafik */}
      {tab === "oyuncu" && view === "grafik" && shown > 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {chosen ? (
              <>
                <ChartControls
                  line={playerLine}
                  dir={dir}
                  avg={chosen.avg}
                  rate={lineHitRate(playerBars.map((b) => b.value), playerLine, dir)}
                  hrefLine={(l) => href({ line: String(l), player: String(chosen.playerId) })}
                  hrefDir={(d) => href({ dir: d, line: String(playerLine), player: String(chosen.playerId) })}
                  extra={
                    <span className="flex items-center gap-3">
                    <PlayerPhoto id={chosen.playerId} name={chosen.name} size={40} />
                    <FilterSelect
                      label="Oyuncu"
                      selected={String(chosen.playerId)}
                      groups={[
                        {
                          options: chartPlayers.map((r) => ({
                            value: String(r.playerId),
                            label: r.name,
                            count: r.starts,
                            href: href({ player: String(r.playerId) }),
                          })),
                        },
                      ]}
                    />
                    </span>
                  }
                />
                <BarChart bars={playerBars} line={playerLine} dir={dir} />
                <p className="text-xs text-muted-foreground">
                  {statLabel} · yalnızca ilk 11&apos;de başladığı maçlar · soldan sağa en yeniden eskiye · çizgiyi{" "}
                  {dir === "over" ? "geçen" : "geçmeyen"} maçlar yeşil. Listedeki sayı ilk 11 maç sayısı.
                </p>
              </>
            ) : (
              <p className="py-4 text-center text-muted-foreground">Bu maçlarda ilk 11&apos;de başlayan oyuncu yok.</p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
