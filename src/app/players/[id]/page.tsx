// src/app/players/[id]/page.tsx
// Oyuncu sayfası: profil, seriler, sezon özeti, öne çıkan özellikler (maç maç sayılarla), detaylı istatistikler,
// istatistik grafiği ve maç maç kayıt.
// Filtreler adres satırında: ?venue=home&comp=league&last=20&stat=shotsTotal&line=2.5
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPlayerPage, type CareerRow, type PlayerPageGame } from "@/lib/player-page";
import { filterGames, summarize, highlights, type ProfileComp, type ProfileVenue } from "@/lib/engine/player-profile";
import {
  averageRating, DETAIL_GROUPS, EXTRA_CHART_STATS, isExtraKey, ladderLines, statValue, successRate, summarizeStat,
  type AnyStatKey, type DetailRow,
} from "@/lib/engine/player-extras";
import { currentStreaks } from "@/lib/engine/streaks";
import {
  ageOn, availabilityLabel, careerTotals, footName, formatEur, injuryName, specificPositionName, transferLabel,
} from "@/lib/engine/player-bio";
import { positionBenchmark } from "@/lib/position-benchmarks";
import { playerKingHighlights } from "@/lib/kings";
import { Crown, Trophy } from "lucide-react";
import {
  benchPer90, benchRates, LOWER_IS_BETTER, MIN_ATTEMPTS, MIN_MINUTES, TOP_SHARE, topPercent, topShare, type BenchPlayer,
} from "@/lib/engine/position-rank";
import { defaultLine, lineHitRate } from "@/lib/engine/team-metrics";
import { PLAYER_GRID_STATS, type GridStat } from "@/lib/engine/player-grid";
import { TRENDS } from "@/lib/trend-config";
import { isPlayerStatKey } from "@/lib/engine/trends";
import { TZ } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, type Bar } from "@/components/bar-chart";
import { GameChips } from "@/components/game-chips";
import { RatePercent } from "@/components/rate-percent";
import { StreakBadges } from "@/components/streak-badges";
import { FilterSelect } from "@/components/filter-select";
import { Segmented } from "@/components/segmented";
import { LeagueLogo, PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Search = Partial<Record<"venue" | "comp" | "last" | "stat" | "line", string>>;

const VENUES: { key: ProfileVenue; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "home", label: "İç saha" },
  { key: "away", label: "Deplasman" },
];
const COMPS: { key: ProfileComp; label: string }[] = [
  { key: "all", label: "Tüm turnuvalar" },
  { key: "league", label: "Lig" },
  { key: "europe", label: "Avrupa" },
];
const LASTS = ["5", "10", "20", "40"] as const;
const POSITIONS: Record<string, string> = { G: "Kaleci", D: "Defans", M: "Orta saha", F: "Forvet" };
const PEERS: Record<string, string> = { G: "kaleciler", D: "defans oyuncuları", M: "orta sahalar", F: "forvetler" };
// Güçlü yönlerde detay tablosuna ek olarak bakılan temel istatistikler (orta saha ama golcü gibi)
const CORE_STRENGTH_ROWS: DetailRow[] = [
  { kind: "count", key: "goals", label: "Gol" },
  { kind: "count", key: "assists", label: "Asist" },
  { kind: "count", key: "shotsOnTarget", label: "İsabetli şut" },
  { kind: "count", key: "shotsTotal", label: "Şut" },
  { kind: "count", key: "tackles", label: "Top kapma" },
];

// Maç kaydı sütunları. Oranlı olanlar "isabetli/toplam"; keys: grafikte seçiliyse sütun vurgulanır.
type LogColumn = { label: string; title?: string; keys: AnyStatKey[]; goalkeeper?: boolean } & (
  | { kind: "count"; key: AnyStatKey; decimals?: boolean }
  | { kind: "ratio"; won: AnyStatKey; other: AnyStatKey; mode: "total" | "lost" }
);
const count = (key: AnyStatKey, label: string, title?: string, decimals?: boolean): LogColumn => ({ kind: "count", key, label, title, decimals, keys: [key] });
const ratio = (won: AnyStatKey, other: AnyStatKey, mode: "total" | "lost", label: string, title: string): LogColumn => ({
  kind: "ratio", won, other, mode, label, title, keys: [won, other],
});
const LOG_COLUMNS: LogColumn[] = [
  count("goals", "Gol"),
  count("assists", "Asist"),
  count("shotsTotal", "Şut"),
  count("shotsOnTarget", "İs. şut", "İsabetli şut"),
  count("xg", "xG", "Beklenen gol", true),
  count("xa", "xA", "Beklenen asist", true),
  count("keyPasses", "Kilit pas"),
  ratio("passesAccurate", "passesTotal", "total", "Pas", "İsabetli / toplam pas"),
  ratio("longBallsAccurate", "longBallsTotal", "total", "Uzun top", "İsabetli / toplam uzun top"),
  ratio("crossesAccurate", "crossesTotal", "total", "Orta", "İsabetli / toplam orta"),
  ratio("dribblesWon", "dribblesTotal", "total", "Çalım", "Başarılı / toplam çalım"),
  ratio("duelsWon", "duelsLost", "lost", "İkili", "Kazanılan / toplam ikili mücadele"),
  ratio("aerialsWon", "aerialsLost", "lost", "Hava", "Kazanılan / toplam hava topu"),
  count("tackles", "Top kapma"),
  count("interceptions", "Pas arası"),
  count("clearances", "Uzakl.", "Uzaklaştırma"),
  count("ballRecoveries", "Top kaz.", "Top kazanma"),
  count("fouls", "Faul"),
  count("wasFouled", "Maruz", "Maruz kaldığı faul"),
  count("offsides", "Ofsayt"),
  count("possessionLost", "Top kaybı"),
  count("yellowCards", "Sarı", "Sarı kart"),
  { ...count("saves", "Kurtarış"), goalkeeper: true },
];

function logCell(c: LogColumn, g: PlayerPageGame): { text: string; zero: boolean } {
  if (c.kind === "count") {
    const v = statValue(g, c.key);
    if (v === null) return { text: "–", zero: true };
    return { text: c.decimals ? fmt(v) : String(v), zero: v === 0 };
  }
  const w = statValue(g, c.won);
  const o = statValue(g, c.other);
  if (w === null || o === null) return { text: "–", zero: true };
  const total = c.mode === "total" ? o : w + o;
  return { text: `${w}/${total}`, zero: total === 0 };
}

// Mevki kıyası: oyuncunun 90 dakikadaki değerinden (ya da isabet oranından) yüksek olan akranların oranı
function rankRow(row: DetailRow, games: PlayerPageGame[], bench: BenchPlayer[]): number | null {
  if (bench.length === 0) return null;
  if (row.kind === "count") {
    if (LOWER_IS_BETTER.has(row.key)) return null;
    const s = summarizeStat(games, row.key);
    if (s.per90 === null || s.minutes < MIN_MINUTES) return null;
    return topShare(benchPer90(bench, row.key, isExtraKey), s.per90);
  }
  const r = successRate(games, row.won, row.other, row.mode);
  if (r.rate === null || r.total < MIN_ATTEMPTS) return null;
  return topShare(benchRates(bench, row.won, row.other, row.mode), r.rate);
}

// Oyuncu trendleri (Gol 1+, Şut 3+...) öne çıkan özellik tanımı olarak
const HIGHLIGHT_DEFS = TRENDS.filter((t) => t.scope === "PLAYER" && isPlayerStatKey(t.statKey) && t.line !== null).map((t) => ({
  code: t.code,
  name: t.name,
  statKey: t.statKey as GridStat,
  line: t.line!,
  threshold: t.threshold,
}));

const pick = <T extends string>(value: string | undefined, options: readonly { key: T }[], fallback: T): T =>
  options.some((o) => o.key === value) ? (value as T) : fallback;
const shortDate = (d: number) => new Date(d).toLocaleDateString("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" });
const fmt = (n: number | null, digits = 2) => (n === null ? "–" : n.toFixed(digits).replace(".", ","));
const pct = (r: number) => `%${Math.round(r * 100)}`;
const rateTone = (rate: number) =>
  rate >= 0.8 ? "bg-hit-block text-white" : rate >= 0.6 ? "bg-hit/20 text-hit" : "bg-secondary text-muted-foreground";
const longDate = (d: Date) => d.toLocaleDateString("tr-TR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const monthYear = (d: Date) => d.toLocaleDateString("tr-TR", { timeZone: "UTC", month: "2-digit", year: "numeric" });
const gameLabel = (g: PlayerPageGame) =>
  `${shortDate(g.date)} · ${g.isHome ? "İç" : "Dış"} · ${g.teamName} ${g.goalsFor}-${g.goalsAgainst} ${g.opponentName} · ${g.competition}`;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const data = await loadPlayerPage(Number((await params).id));
  return {
    title: { absolute: `${data?.player.name ?? "Oyuncu bulunamadı"} · Gokostats` },
    description: data ? `${data.player.name} son maç istatistikleri: gol, asist, şut, pas, ikili mücadele, kart.` : undefined,
  };
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="tile rounded-2xl border-[2.5px] border-foreground bg-white px-3 py-4 text-center transition-transform hover:-translate-y-1 hover:-rotate-1">
      <div className="poster text-sm text-muted-foreground">{label}</div>
      <div className="poster mt-1 text-5xl leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1.5 text-xs font-semibold tabular-nums text-muted-foreground">{sub}</div>}
    </div>
  );
}

// Detaylı istatistik tablosunun bir satırı: toplam · ilk 11 maçı başı · 90 dakikada
// Mevkideki ilk %20'deyse satır yeşil, yanında "ilk %X"
function DetailLine({ row, games, share, peers }: { row: DetailRow; games: PlayerPageGame[]; share: number | null; peers: string }) {
  const strong = share !== null && share <= TOP_SHARE;
  const rowClass = cn("border-t border-border", strong && "bg-hit/10");
  const rankBadge = strong && (
    <span title={`Güncel sezonda ${peers} arasında, 90 dakikada`} className="ml-2 whitespace-nowrap text-xs font-bold text-hit">
      ilk %{topPercent(share!)}
    </span>
  );
  const labelClass = cn("py-1.5 pl-1.5 pr-3", strong && "font-semibold text-hit");
  if (row.kind === "count") {
    const s = summarizeStat(games, row.key);
    if (s.apps === 0) return null;
    const d = row.decimals ? 2 : 0;
    return (
      <tr className={rowClass}>
        <td className={labelClass}>
          {row.label}
          {rankBadge}
        </td>
        <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{fmt(s.total, d)}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(s.perGame)}</td>
        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{fmt(s.per90)}</td>
      </tr>
    );
  }
  const r = successRate(games, row.won, row.other, row.mode);
  if (r.total === 0) return null;
  const won = summarizeStat(games, row.won);
  return (
    <tr className={rowClass}>
      <td className={labelClass}>
        {row.label}
        {r.rate !== null && <span className="ml-2 rounded bg-primary/10 px-1.5 text-xs font-bold tabular-nums text-primary">{pct(r.rate)}</span>}
        {rankBadge}
      </td>
      <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
        {r.won}
        <span className="font-normal text-muted-foreground">/{r.total}</span>
      </td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(won.perGame)}</td>
      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{fmt(won.per90)}</td>
    </tr>
  );
}

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const playerId = Number((await params).id);
  const sp = await searchParams;
  const data = await loadPlayerPage(playerId);
  if (!data) notFound();
  const [bench, kingRanks] = await Promise.all([
    positionBenchmark(data.player.position),
    playerKingHighlights(playerId, data.player.position),
  ]);
  // Krallık sıraları: en fazla 10 rozet (oynadığı her turnuva + tüm ligler, genel ya da mevki sırası)
  const kingBadges = kingRanks.slice(0, 10);
  const peers = PEERS[data.player.position ?? ""] ?? "aynı mevkidekiler";

  // Profil bilgileri (BSD profili çekilmişse)
  const profile = data.profile;
  const facts: { label: string; value: string; title?: string; teamId?: number }[] = [];
  if (profile.dateOfBirth) facts.push({ label: "Yaş", value: String(ageOn(profile.dateOfBirth, new Date())), title: `Doğum: ${longDate(profile.dateOfBirth)}` });
  if (profile.heightCm) facts.push({ label: "Boy", value: `${profile.heightCm} cm` });
  const foot = footName(profile.preferredFoot);
  if (foot) facts.push({ label: "Ayak", value: foot });
  if (profile.nationality) facts.push({ label: "Uyruk", value: profile.nationality });
  if (profile.nationalTeamName && profile.nationalTeamId)
    facts.push({ label: "Milli takım", value: profile.nationalTeamName, teamId: profile.nationalTeamId });
  const value = formatEur(profile.marketValueEur);
  if (value) facts.push({ label: "Piyasa değeri", value });
  if (profile.contractUntil) facts.push({ label: "Sözleşme", value: monthYear(profile.contractUntil), title: longDate(profile.contractUntil) });
  const injuryLabel = availabilityLabel(profile.availability);
  const injury = injuryLabel
    ? { label: injuryLabel, type: injuryName(profile.injuryType), back: profile.injuryReturn ? longDate(profile.injuryReturn) : null }
    : null;

  // Kariyer: kulüp ve milli takım toplamları ayrı
  const isNational = (r: { teamId: number }) => r.teamId === profile.nationalTeamId;
  const clubTotals = careerTotals(data.career, isNational);
  const nationalTotals = careerTotals(data.career, (r) => !isNational(r));
  const CAREER_PREVIEW = 12;

  const isKeeper = data.player.position === "G";
  // Grafikte seçilebilen istatistikler: temel + detaylı (kaleci istatistikleri yalnızca kalecide)
  const chartStats: { key: AnyStatKey; label: string; group: string }[] = [
    ...PLAYER_GRID_STATS.map((s) => ({ key: s.key as AnyStatKey, label: s.label, group: "Temel" })),
    ...EXTRA_CHART_STATS.filter((s) => !s.goalkeeper || isKeeper).map((s) => ({ key: s.key as AnyStatKey, label: s.label, group: "Detaylı" })),
  ];

  const venue = pick<ProfileVenue>(sp.venue, VENUES, "all");
  const comp = pick<ProfileComp>(sp.comp, COMPS, "all");
  const last = LASTS.find((n) => n === sp.last) ?? "20";
  const stat = pick<AnyStatKey>(sp.stat, chartStats, "shotsTotal");
  const state = { venue, comp, last, stat: stat as string, line: sp.line ?? "" };
  const defaults: Record<string, string> = { venue: "all", comp: "all", last: "20", stat: "shotsTotal", line: "" };
  // Filtre değişince çizgi ortalamaya göre yeniden seçilsin diye line sıfırlanır (yalnızca çizgi düğmeleri korur)
  const href = (change: Partial<typeof state>) => {
    const next = { ...state, line: "", ...change };
    const q = Object.entries(next)
      .filter(([k, v]) => v !== defaults[k])
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return `/players/${playerId}${q ? `?${q}` : ""}`;
  };

  // Seriler: filtreden bağımsız, oynadığı bütün maçlar (en yeniden eskiye)
  const streaks = currentStreaks(data.games, { position: data.player.position });

  const games = filterGames(data.games, { venue, comp, last: Number(last) });
  const summary = summarize(games);
  const rating = averageRating(games);
  const hl = highlights(games, HIGHLIGHT_DEFS);
  const statLabel = chartStats.find((s) => s.key === stat)!.label;
  const allStarts = games.filter((g) => g.started);
  const extrasCount = games.filter((g) => g.extras).length;

  // Mevki kıyası: detay satırları + temel istatistikler; ilk %10'dakiler güçlü yön olarak başta
  const detailGroups = DETAIL_GROUPS.filter((grp) => !grp.goalkeeper || isKeeper);
  const shareOf = new Map<string, number | null>();
  for (const row of [...detailGroups.flatMap((g) => g.rows), ...CORE_STRENGTH_ROWS]) shareOf.set(row.label, rankRow(row, games, bench));
  const strengths = [...detailGroups.flatMap((g) => g.rows), ...CORE_STRENGTH_ROWS]
    .filter((row, i, all) => all.findIndex((r) => r.label === row.label) === i)
    .map((row) => ({ row, share: shareOf.get(row.label) ?? null }))
    .filter((x): x is { row: DetailRow; share: number } => x.share !== null && x.share <= 0.1)
    .sort((a, b) => a.share - b.share)
    .slice(0, 6);

  // Grafik: seçilen istatistik, yalnızca ilk 11 maçları (oranlar gibi); detaylı istatistikte verisi olan maçlar
  const starts = allStarts.filter((g) => statValue(g, stat) !== null);
  const values = starts.map((g) => statValue(g, stat)!);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const lineParam = Number(sp.line);
  const line = lineParam > 0 ? lineParam : defaultLine(avg);
  const rate = lineHitRate(values, line, "over");
  const ladder = ladderLines(avg)
    .map((l) => ({ line: l, hits: values.filter((v) => v >= l).length, total: values.length }))
    .filter((l, i) => i === 0 || l.hits > 0);
  const bars: Bar[] = starts.map((g) => ({
    key: g.matchId,
    value: statValue(g, stat)!,
    label: shortDate(g.date).slice(0, 5),
    sub: `${g.isHome ? "İç" : "Dış"} · ${g.opponentName}`,
    title: `${g.teamName} ${g.goalsFor}-${g.goalsAgainst} ${g.opponentName} · ${g.competition} · ${g.minutes}'`,
    href: `/matches/${g.matchId}`,
  }));
  const step = "flex size-7 items-center justify-center rounded-md bg-secondary text-lg font-bold text-muted-foreground hover:text-foreground";

  const logColumns = LOG_COLUMNS.filter((c) => !c.goalkeeper || isKeeper);

  return (
    <main className="mx-auto w-full max-w-[92rem] space-y-9 px-4 py-8 sm:px-8 sm:py-12">
      {/* Başlık */}
      <header className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            {/* Büyük photocard: eğik, renkli gölgeli */}
            <div className="relative w-fit shrink-0">
              <span
                style={{ "--pop": "var(--pink)" } as React.CSSProperties}
                className="photocard -rotate-3 overflow-hidden border-[3px] shadow-[8px_8px_0_var(--pink)] transition-transform hover:rotate-0"
              >
                <PlayerPhoto id={data.player.id} name={data.player.name} size={200} />
              </span>
              {profile.jerseyNumber !== null && (
                <span className="poster absolute -bottom-2 -right-3 flex size-16 rotate-6 items-center justify-center rounded-full border-[3px] border-foreground bg-[var(--yellow)] text-3xl shadow-[3px_3px_0_var(--ink)]">
                  {profile.jerseyNumber}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold sm:text-3xl">{data.player.name}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-base font-bold [&>*]:rounded-full [&>*]:border-2 [&>*]:border-foreground [&>*]:bg-white [&>*]:px-3 [&>*]:py-1">
                {data.team && (
                  <Link href={`/teams/${data.team.id}`} className="flex items-center gap-2 !bg-[var(--lilac)] hover:underline">
                    <TeamLogo id={data.team.id} name={data.team.name} size={26} />
                    {data.team.name}
                  </Link>
                )}
                {data.league && (
                  <span className="flex items-center gap-1.5">
                    <LeagueLogo id={data.league.id} name={data.league.name} size={22} />
                    {data.league.name}
                  </span>
                )}
                {data.player.position && POSITIONS[data.player.position] && (
                  <span>{specificPositionName(profile.specificPosition) ?? POSITIONS[data.player.position]}</span>
                )}
              </div>
              {facts.length > 0 && (
                <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
                  {facts.map((f) => (
                    <div key={f.label} title={f.title}>
                      <dt className="marker text-lg leading-none text-[var(--purple)]">{f.label.toLocaleLowerCase("tr")}</dt>
                      <dd className="flex items-center gap-1.5 text-lg font-extrabold">
                        {f.teamId !== undefined && <TeamLogo id={f.teamId} name={f.value} size={20} />}
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
          {data.nextMatch && (
            <Link
              href={`/matches/${data.nextMatch.id}`}
              className="pop rotate-1 rounded-2xl bg-[var(--yellow)] px-5 py-3"
            >
              <div className="marker text-xl leading-none">sıradaki maç →</div>
              <div className="text-lg font-extrabold">
                {data.nextMatch.homeName} – {data.nextMatch.awayName}
              </div>
              <div className="text-sm font-semibold">
                {data.nextMatch.eventDate.toLocaleString("tr-TR", { timeZone: TZ, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
              </div>
            </Link>
          )}
        </div>
        {kingBadges.length > 0 && (
          <section>
            <h2 className="poster mb-3 flex items-center gap-2 text-2xl" title="Güncel sezon toplamında ilk 10">
              <Trophy className="size-6 text-[var(--purple)]" aria-hidden="true" />
              Krallık vitrini
              <span className="marker rounded-full bg-[var(--yellow)] px-2.5 text-xl normal-case">{kingBadges.length} ödül</span>
            </h2>
            {/* Eşit boyutlu ödül kartları: büyük sıra numarası, altında kategori ve kapsam */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {kingBadges.map((k) => (
              <Link
                key={`${k.statKey}-${k.leagueId ?? "all"}-${k.position ?? "all"}`}
                href={`/kings?stat=${k.statKey}${k.leagueId !== null ? `&league=${k.leagueId}` : ""}${k.position ? `&pos=${k.position}` : ""}`}
                title={`${k.scope}${k.positionLabel ? ` · ${k.positionLabel}` : ""} · ${k.statName}: ${k.decimals ? fmt(k.total) : k.total}`}
                className={cn(
                  "pop flex items-center gap-3 rounded-2xl px-3 py-2.5",
                  k.position === null && k.rank === 1
                    ? "bg-[var(--yellow)]"
                    : k.rank === 1 || (k.position === null && k.rank <= 3)
                      ? "bg-[var(--lilac)]"
                      : "bg-white",
                )}
              >
                <span className="poster flex w-11 shrink-0 flex-col items-center text-4xl leading-none">
                  {k.rank === 1 && <Crown className="-mb-0.5 size-5 fill-[var(--pink)]" aria-hidden="true" />}
                  {k.rank}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-extrabold">{k.statName}</span>
                  <span className="block truncate text-xs font-medium opacity-75">
                    {k.scope}
                    {k.positionLabel && ` · ${k.positionLabel}`}
                  </span>
                </span>
              </Link>
            ))}
            </div>
          </section>
        )}
        {injury && (
          <div className="flex w-fit flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border-[2.5px] border-foreground bg-[#ffc2dc] px-4 py-2 font-semibold shadow-[4px_4px_0_var(--ink)]">
            <span className="font-bold text-miss">{injury.label}</span>
            {injury.type && <span>{injury.type}</span>}
            {injury.back && <span className="text-muted-foreground">· tahmini dönüş {injury.back}</span>}
          </div>
        )}
        {streaks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="poster text-xl" title="Oynadığı son maçlardan geriye, bütün turnuvalar">
              Seriler
            </span>
            <StreakBadges streaks={streaks} />
          </div>
        )}
      </header>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2">
        <Segmented options={LASTS.map((n) => ({ key: n, label: `Son ${n}` }))} value={last} href={(k) => href({ last: k })} />
        <Segmented options={VENUES} value={venue} href={(k) => href({ venue: k })} />
        <Segmented options={COMPS} value={comp} href={(k) => href({ comp: k })} />
      </div>

      {games.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Bu filtrelerle maç yok.</CardContent>
        </Card>
      ) : (
        <>
          {/* Özet */}
          <div className="tiles grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
            <Tile label="Maç" value={summary.apps} sub={`${summary.starts} ilk 11`} />
            <Tile label="Dakika" value={summary.minutes.toLocaleString("tr-TR")} />
            <Tile label="Gol" value={summary.totals.goals} sub={`${fmt(summary.per90.goals)} / 90 dk`} />
            <Tile label="Asist" value={summary.totals.assists} sub={`${fmt(summary.per90.assists)} / 90 dk`} />
            <Tile label="Şut" value={summary.totals.shotsTotal} sub={`${fmt(summary.perGame.shotsTotal)} / maç`} />
            <Tile label="İsabetli şut" value={summary.totals.shotsOnTarget} sub={`${fmt(summary.perGame.shotsOnTarget)} / maç`} />
            <Tile label="Top kapma" value={summary.totals.tackles} sub={`${fmt(summary.perGame.tackles)} / maç`} />
            <Tile label="Ort. puan" value={fmt(rating.avg)} sub={rating.count ? `${rating.count} maç` : "veri yok"} />
          </div>

          {/* Öne çıkan özellikler */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Öne çıkan özellikler</CardTitle>
              <p className="text-sm text-muted-foreground">
                Son {summary.starts} ilk 11 maçında en istikrarlı istatistikler · her kutucukta o maçta yaptığı sayı, rakip ve dakika
                (soldan sağa eskiden yeniye)
              </p>
            </CardHeader>
            <CardContent>
              {hl.length === 0 ? (
                <p className="text-muted-foreground">Öne çıkan özellik için en az 5 ilk 11 maçı gerekiyor.</p>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {hl.map((h) => (
                    <div
                      key={h.code}
                      className="space-y-3 rounded-2xl border-2 border-foreground bg-secondary/50 p-4"
                    >
                      <Link
                        href={href({ stat: h.statKey, line: String(h.line - 0.5) })}
                        scroll={false}
                        className="flex items-baseline justify-between gap-2 hover:text-primary"
                      >
                        <span className="poster text-2xl">{h.name}</span>
                        <span className="flex items-baseline gap-2">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {h.hits}/{h.total}
                          </span>
                          <RatePercent rate={h.rate} className="poster text-3xl font-normal" />
                        </span>
                      </Link>
                      <GameChips
                        line={h.line}
                        items={allStarts.map((g) => ({
                          matchId: g.matchId,
                          value: g.stats[h.statKey],
                          minutes: g.minutes,
                          opponentId: g.opponentId,
                          opponentName: g.opponentName,
                          label: gameLabel(g),
                        }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detaylı istatistikler */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Detaylı istatistikler</CardTitle>
              <p className="text-sm text-muted-foreground">
                Toplam · ilk 11 maçı başına · 90 dakikada
                {extrasCount > 0 && extrasCount < games.length && ` · detaylı veri ${games.length} maçın ${extrasCount} tanesinde var`}
                {bench.length > 0 && (
                  <>
                    {" · "}
                    <span className="text-hit">yeşil</span>: güncel sezonda {peers} arasında 90 dakikada ilk %20 (en az {MIN_MINUTES} dk
                    oynayan {bench.length} oyuncu)
                  </>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {strengths.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Güçlü yönleri</span>
                  {strengths.map(({ row, share }) => (
                    <span key={row.label} className="rounded-full border border-hit/50 bg-hit/12 px-2.5 py-1 text-xs font-semibold text-hit">
                      {row.label}
                      {row.kind === "ratio" && " başarısı"} · {peers} arasında ilk %{topPercent(share)}
                    </span>
                  ))}
                </div>
              )}
              {extrasCount === 0 ? (
                <p className="text-muted-foreground">Bu maçlar için detaylı istatistik (pas, ikili mücadele, hava topu...) henüz yok.</p>
              ) : (
                <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                  {detailGroups.map((grp) => (
                    <table key={grp.title} className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="pb-1.5 pl-1.5 pr-3 font-semibold uppercase tracking-wider text-foreground">{grp.title}</th>
                          <th className="pb-1.5 pr-3 text-right font-normal">Toplam</th>
                          <th className="pb-1.5 pr-3 text-right font-normal">Maç başı</th>
                          <th className="pb-1.5 text-right font-normal">90 dk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grp.rows.map((row) => (
                          <DetailLine key={row.label} row={row} games={games} share={shareOf.get(row.label) ?? null} peers={peers} />
                        ))}
                      </tbody>
                    </table>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grafik */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Maç maç</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterSelect
                label="İstatistik"
                selected={stat}
                groups={["Temel", "Detaylı"].map((group) => ({
                  title: group,
                  options: chartStats.filter((s) => s.group === group).map((s) => ({ value: s.key, label: s.label, href: href({ stat: s.key }) })),
                }))}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="flex flex-wrap gap-2 text-sm">
                  {ladder.map((l) => (
                    <Link
                      key={l.line}
                      href={href({ line: String(l.line - 0.5) })}
                      scroll={false}
                      className={cn(
                        "rounded-md px-2.5 py-1 tabular-nums transition-opacity hover:opacity-80",
                        rateTone(l.total ? l.hits / l.total : 0),
                        line === l.line - 0.5 && "ring-2 ring-foreground/70",
                      )}
                    >
                      {l.line}+ <strong>{l.hits}/{l.total}</strong>
                    </Link>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Çizgi</span>
                  {line > 0.5 ? (
                    <Link href={href({ line: String(line - 1) })} scroll={false} className={step} aria-label="Çizgiyi düşür">
                      −
                    </Link>
                  ) : (
                    <span className={cn(step, "opacity-40")}>−</span>
                  )}
                  <span className="w-8 text-center font-bold tabular-nums">{String(line).replace(".", ",")}</span>
                  <Link href={href({ line: String(line + 1) })} scroll={false} className={step} aria-label="Çizgiyi yükselt">
                    +
                  </Link>
                </div>
                <div className="ml-auto flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Ort. <strong className="tabular-nums text-foreground">{fmt(avg)}</strong>
                  </span>
                  <span className={cn("rounded-md px-2.5 py-1 font-bold tabular-nums", rateTone(rate.total ? rate.hits / rate.total : 0))}>
                    {pct(rate.total ? rate.hits / rate.total : 0)} ({rate.hits}/{rate.total})
                  </span>
                </div>
              </div>
              {bars.length > 0 ? (
                <BarChart bars={bars} line={line} dir="over" />
              ) : (
                <p className="py-4 text-center text-muted-foreground">
                  {allStarts.length && isExtraKey(stat)
                    ? "Bu istatistik için ilk 11 maçlarında detaylı veri yok."
                    : "Bu filtrelerle ilk 11'de başladığı maç yok."}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {statLabel} · yalnızca ilk 11&apos;de başladığı maçlar · soldan sağa en yeniden eskiye · çizgiyi geçen maçlar yeşil.
              </p>
            </CardContent>
          </Card>

          {/* Maç kaydı */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Maç kaydı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="sticky left-0 z-10 bg-card py-2 pr-3 font-normal">Maç</th>
                      <th className="hidden py-2 pr-3 font-normal lg:table-cell">Turnuva</th>
                      <th className="py-2 pr-3 text-right font-normal">Skor</th>
                      <th className="py-2 pr-3 text-right font-normal">Dk</th>
                      <th className="py-2 pr-3 text-right font-normal">Puan</th>
                      {logColumns.map((c) => (
                        <th
                          key={c.label}
                          title={c.title}
                          className={cn("py-2 pr-3 text-right font-normal", c.keys.includes(stat) && "text-foreground")}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((g) => (
                      <tr key={g.matchId} className={cn("border-t border-border", !g.started && "text-muted-foreground")}>
                        <td className="sticky left-0 z-10 bg-card py-2 pr-3 shadow-[1px_0_0_var(--border)]">
                          <Link href={`/matches/${g.matchId}`} className="flex items-center gap-2 hover:text-primary">
                            <span className="w-14 text-xs tabular-nums text-muted-foreground">{shortDate(g.date)}</span>
                            <span className="w-6 text-xs text-muted-foreground">{g.isHome ? "İç" : "Dış"}</span>
                            <TeamLogo id={g.opponentId} name={g.opponentName} size={16} />
                            <span className="max-w-36 truncate">{g.opponentName}</span>
                          </Link>
                        </td>
                        <td className="hidden py-2 pr-3 text-muted-foreground lg:table-cell">{g.competition}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                          {g.goalsFor}-{g.goalsAgainst}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums" title={g.started ? "İlk 11" : "Yedekten girdi"}>
                          {g.minutes}&apos;{!g.started && "*"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{g.extras?.rating != null ? fmt(g.extras.rating, 1) : "–"}</td>
                        {logColumns.map((c) => {
                          const cell = logCell(c, g);
                          return (
                            <td
                              key={c.label}
                              className={cn(
                                "py-2 pr-3 text-right tabular-nums",
                                c.keys.includes(stat) && "font-bold text-foreground",
                                cell.zero && "text-muted-foreground/50",
                              )}
                            >
                              {cell.text}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">* Yedekten girdi; ortalama ve oranlara katılmaz. – = detaylı veri yok. Tablo yana kaydırılır.</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Kariyer ve transferler (filtrelerden bağımsız) */}
      {(data.career.length > 0 || data.transfers.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.career.length > 0 && (
            <Card className={cn(data.transfers.length > 0 && "lg:col-span-2")}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Kariyer</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Kulüp: {clubTotals.matches} maç · {clubTotals.goals} gol · {clubTotals.assists} asist
                  {nationalTotals.matches > 0 &&
                    ` · Milli takım: ${nationalTotals.matches} maç · ${nationalTotals.goals} gol · ${nationalTotals.assists} asist`}
                </p>
              </CardHeader>
              <CardContent>
                <CareerTable rows={data.career.slice(0, CAREER_PREVIEW)} isNational={isNational} />
                {data.career.length > CAREER_PREVIEW && (
                  <details className="group mt-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      <span className="group-open:hidden">Tüm kariyer ({data.career.length} satır)</span>
                      <span className="hidden group-open:inline">Gizle</span>
                    </summary>
                    <CareerTable rows={data.career.slice(CAREER_PREVIEW)} isNational={isNational} header={false} />
                  </details>
                )}
              </CardContent>
            </Card>
          )}
          {data.transfers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Transferler</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {data.transfers.map((t) => (
                    <li key={t.id} className="border-l-2 border-border pl-3">
                      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">{t.date.toLocaleDateString("tr-TR", { timeZone: "UTC" })}</span>
                        <span className={cn("font-semibold", t.transferType === 3 && t.feeEur && "text-primary")}>
                          {transferLabel(t.transferType, t.feeDescription)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                        {t.fromTeamId !== null && <TeamLogo id={t.fromTeamId} name={t.fromTeamName ?? ""} size={16} />}
                        <span className="text-muted-foreground">{t.fromTeamName ?? "–"}</span>
                        <span className="text-muted-foreground">→</span>
                        {t.toTeamId !== null && <TeamLogo id={t.toTeamId} name={t.toTeamName ?? ""} size={16} />}
                        <span className="font-semibold">{t.toTeamName ?? "–"}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}

function CareerTable({ rows, isNational, header = true }: { rows: CareerRow[]; isNational: (r: CareerRow) => boolean; header?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-sm">
        {header && (
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-normal">Sezon</th>
              <th className="py-2 pr-3 font-normal">Takım</th>
              <th className="py-2 pr-3 text-right font-normal">Maç</th>
              <th className="py-2 pr-3 text-right font-normal">Dk</th>
              <th className="py-2 pr-3 text-right font-normal">Gol</th>
              <th className="py-2 pr-3 text-right font-normal">Asist</th>
              <th className="py-2 text-right font-normal">Puan</th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.seasonId}-${r.teamId}`} className="border-t border-border">
              <td className="max-w-64 truncate py-2 pr-3 text-muted-foreground" title={r.seasonName ?? undefined}>
                {r.seasonName ?? r.leagueName ?? "–"}
              </td>
              <td className="py-2 pr-3">
                <span className="flex items-center gap-1.5">
                  <TeamLogo id={r.teamId} name={r.teamName ?? ""} size={16} />
                  <span className="max-w-44 truncate">{r.teamName ?? "–"}</span>
                  {isNational(r) && <span className="rounded bg-primary/15 px-1.5 text-[10px] font-bold uppercase text-primary">Milli</span>}
                </span>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.matches}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{r.minutes.toLocaleString("tr-TR")}</td>
              <td className={cn("py-2 pr-3 text-right tabular-nums", r.goals ? "font-semibold" : "text-muted-foreground/50")}>{r.goals}</td>
              <td className={cn("py-2 pr-3 text-right tabular-nums", r.assists ? "font-semibold" : "text-muted-foreground/50")}>{r.assists}</td>
              <td className="py-2 text-right tabular-nums">{r.avgRating !== null ? fmt(r.avgRating) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
