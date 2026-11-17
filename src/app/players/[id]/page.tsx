// src/app/players/[id]/page.tsx
// Oyuncu sayfası: profil, seriler, sezon özeti, öne çıkan özellikler (maç maç sayılarla), detaylı istatistikler,
// istatistik grafiği ve maç maç kayıt.
// Filtreler adres satırında: ?venue=home&comp=league&last=20&stat=shotsTotal&line=2.5
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPlayerPage, type PlayerPageGame } from "@/lib/player-page";
import { CareerCard, TransfersCard } from "@/components/career-sections";
import { trCountry, trTeam } from "@/lib/team-names";
import { filterGames, summarize, highlights, type ProfileComp, type ProfileVenue } from "@/lib/engine/player-profile";
import {
  averageRating, DETAIL_GROUPS, EXTRA_CHART_STATS, isExtraKey, ladderLines, statValue, successRate, summarizeStat,
  type AnyStatKey, type DetailRow,
} from "@/lib/engine/player-extras";
import { currentStreaks } from "@/lib/engine/streaks";
import {
  ageOn, availabilityLabel, footName, formatEur, injuryName, specificPositionName,
} from "@/lib/engine/player-bio";
import { positionBenchmark } from "@/lib/position-benchmarks";
import { playerKingHighlights } from "@/lib/kings";
import { Crown, Grab, Send, Shield, Sparkles, Star, Trophy, Whistle, Zap } from "lucide-react";
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
    // Değeri 0 olan (ekranda 0 ya da 0,00 görünen) istatistik sıralamaya girmez: kalecinin 0 ofsaytı "ilk %1" değildir
    if (s.per90 === null || s.minutes < MIN_MINUTES || s.total < 0.005) return null;
    return topShare(benchPer90(bench, row.key, isExtraKey), s.per90);
  }
  const r = successRate(games, row.won, row.other, row.mode);
  if (r.rate === null || r.total < MIN_ATTEMPTS || r.won === 0) return null;
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

// Detaylı istatistik kartı: büyük toplam, altında çubuk (oranlı satırda başarı yüzdesi, diğerlerinde mevkisindeki
// oyuncular arasındaki yeri) ve ilk 11 maçı başına / 90 dakikada ortalamalar. Mevkisinde ilk %20'deyse yeşil ve rozetli.
function DetailLine({ row, games, share, peers }: { row: DetailRow; games: PlayerPageGame[]; share: number | null; peers: string }) {
  const strong = share !== null && share <= TOP_SHARE;
  let total: React.ReactNode;
  let perGame: number | null;
  let per90: number | null;
  let bar: { fill: number; text: string } | null = null;
  if (row.kind === "count") {
    const s = summarizeStat(games, row.key);
    if (s.apps === 0) return null;
    total = fmt(s.total, row.decimals ? 2 : 0);
    perGame = s.perGame;
    per90 = s.per90;
    if (share !== null) bar = { fill: 1 - share, text: `${peers} arasında ilk %${topPercent(share)}` };
  } else {
    const r = successRate(games, row.won, row.other, row.mode);
    if (r.total === 0) return null;
    const won = summarizeStat(games, row.won);
    total = (
      <>
        {r.won}
        <span className="text-lg text-muted-foreground">/{r.total}</span>
      </>
    );
    perGame = won.perGame;
    per90 = won.per90;
    if (r.rate !== null) bar = { fill: r.rate, text: `${pct(r.rate)} başarı` };
  }
  return (
    <div
      title={strong ? `Güncel sezonda ${peers} arasında, 90 dakikada` : undefined}
      className={cn(
        "rounded-2xl border-2 px-3 py-2.5 transition-transform hover:-translate-y-0.5",
        strong ? "border-foreground bg-[#b9f5df] shadow-[3px_3px_0_var(--ink)]" : "border-foreground/20 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-bold leading-tight">
          {row.label}
          {strong && (
            <span className="ml-1.5 inline-flex -rotate-2 items-center gap-0.5 whitespace-nowrap rounded-full border-[1.5px] border-foreground bg-[var(--yellow)] px-1.5 text-[11px] font-black">
              <Star className="size-3 fill-foreground" aria-hidden="true" />
              İlk %{topPercent(share!)}
            </span>
          )}
        </span>
        <span className="poster shrink-0 text-3xl leading-none tabular-nums">{total}</span>
      </div>
      {bar && (
        <div className="mt-2">
          <div className="h-2.5 overflow-hidden rounded-full border-[1.5px] border-foreground bg-white">
            <div
              className={cn("h-full rounded-full", row.kind === "ratio" ? "bg-[var(--pink)]" : strong ? "bg-hit-block" : "bg-[var(--lilac)]")}
              style={{ width: `${Math.round(Math.max(0.03, bar.fill) * 100)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] font-semibold text-foreground/70">{bar.text}</div>
        </div>
      )}
      <div className="mt-1.5 flex justify-between gap-2 text-xs tabular-nums text-muted-foreground">
        <span>
          Maç başına <strong className="text-foreground">{fmt(perGame)}</strong>
        </span>
        <span>
          90 dk <strong className="text-foreground">{fmt(per90)}</strong>
        </span>
      </div>
    </div>
  );
}

const GROUP_STYLE: Record<string, { icon: typeof Zap; pop: string }> = {
  "Hücum": { icon: Zap, pop: "var(--pink)" },
  "Pas": { icon: Send, pop: "var(--blue)" },
  "Mücadele ve savunma": { icon: Shield, pop: "var(--purple)" },
  "Faul ve top kaybı": { icon: Whistle, pop: "var(--yellow)" },
  "Kaleci": { icon: Grab, pop: "var(--mint)" },
};

// Puan rozeti: 7,5+ yeşil, 6,5+ sarı, altı pembe
const ratingTone = (r: number) => (r >= 7.5 ? "bg-[#b9f5df]" : r >= 6.5 ? "bg-[var(--yellow)]" : "bg-[#ffc2dc]");
const RESULT_STYLE = { W: "bg-hit-block text-white", D: "bg-[var(--yellow)] text-foreground", L: "bg-miss-block text-white" } as const;
const RESULT_LETTER = { W: "G", D: "B", L: "M" } as const;
const resultOf = (g: PlayerPageGame) =>
  g.goalsFor === null || g.goalsAgainst === null ? null : g.goalsFor > g.goalsAgainst ? "W" : g.goalsFor < g.goalsAgainst ? "L" : "D";

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
  if (profile.nationality) facts.push({ label: "Uyruk", value: trCountry(profile.nationality) });
  if (profile.nationalTeamName && profile.nationalTeamId)
    facts.push({ label: "Milli takım", value: trTeam(profile.nationalTeamName), teamId: profile.nationalTeamId });
  const value = formatEur(profile.marketValueEur);
  if (value) facts.push({ label: "Piyasa değeri", value });
  if (profile.contractUntil) facts.push({ label: "Sözleşme", value: monthYear(profile.contractUntil), title: longDate(profile.contractUntil) });
  const injuryLabel = availabilityLabel(profile.availability);
  const injury = injuryLabel
    ? { label: injuryLabel, type: injuryName(profile.injuryType), back: profile.injuryReturn ? longDate(profile.injuryReturn) : null }
    : null;

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
                      <dt className="marker text-lg leading-none text-[var(--purple)]">{f.label}</dt>
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
              <div className="marker text-xl leading-none">Sıradaki maç →</div>
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
              <span className="marker rounded-full bg-[var(--yellow)] px-2.5 text-xl normal-case">{kingBadges.length} sıralama</span>
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
            {injury.back && <span className="text-muted-foreground">· Tahmini dönüş: {injury.back}</span>}
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
          <CardContent className="py-8 text-center text-muted-foreground">Bu filtrelere uyan maç yok.</CardContent>
        </Card>
      ) : (
        <>
          {/* Özet */}
          <div className="tiles grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
            <Tile label="Maç" value={summary.apps} sub={`${summary.starts} maçta ilk 11`} />
            <Tile label="Dakika" value={summary.minutes.toLocaleString("tr-TR")} />
            <Tile label="Gol" value={summary.totals.goals} sub={`${fmt(summary.per90.goals)} / 90 dk`} />
            <Tile label="Asist" value={summary.totals.assists} sub={`${fmt(summary.per90.assists)} / 90 dk`} />
            <Tile label="Şut" value={summary.totals.shotsTotal} sub={`${fmt(summary.perGame.shotsTotal)} / maç`} />
            <Tile label="İsabetli şut" value={summary.totals.shotsOnTarget} sub={`${fmt(summary.perGame.shotsOnTarget)} / maç`} />
            <Tile label="Top kapma" value={summary.totals.tackles} sub={`${fmt(summary.perGame.tackles)} / maç`} />
            <Tile label="Ort. puan" value={fmt(rating.avg)} sub={rating.count ? `${rating.count} maç` : "Veri yok"} />
          </div>

          {/* Öne çıkan özellikler */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Öne çıkan özellikler</CardTitle>
              <p className="text-sm text-muted-foreground">
                İlk 11 başladığı son {summary.starts} maçta en istikrarlı olduğu istatistikler. Her kutucukta rakip, o maçta yaptığı sayı ve
                oynadığı dakika yer alır; en soldaki kutucuk en son maçtır.
              </p>
            </CardHeader>
            <CardContent>
              {hl.length === 0 ? (
                <p className="text-muted-foreground">Öne çıkan özelliklerin hesaplanması için ilk 11 başladığı en az 5 maç gerekiyor.</p>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
                  {hl.map((h) => (
                    <div
                      key={h.code}
                      className="space-y-1 rounded-2xl border-2 border-foreground bg-secondary/50 p-4"
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

          {/* Detaylı istatistikler: grup grup kartlar */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Detaylı istatistikler</CardTitle>
              <p className="text-sm text-muted-foreground">
                Büyük sayı toplamı, altındaki sayılar ilk 11 maçı başına ve 90 dakikadaki ortalamayı gösterir.
                {extrasCount > 0 && extrasCount < games.length && ` Detaylı veri ${games.length} maçın ${extrasCount} tanesinde var.`}
                {bench.length > 0 && (
                  <>
                    {" "}
                    <span className="rounded-full border-[1.5px] border-foreground bg-[#b9f5df] px-1.5 font-bold text-foreground">Yeşil kartlar</span>{" "}
                    güncel sezonda {peers} arasında ilk %20&apos;ye girdiği alanlardır (en az {MIN_MINUTES} dakika oynayan {bench.length} oyuncu
                    içinde, 90 dakika ortalamasına göre).
                  </>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {strengths.length > 0 && (
                <div className="rounded-2xl border-[2.5px] border-foreground bg-[var(--yellow)] p-4 shadow-[5px_5px_0_var(--ink)]">
                  <div className="poster mb-3 flex items-center gap-2 text-2xl">
                    <Sparkles className="size-6" aria-hidden="true" />
                    Güçlü yönleri
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {strengths.map(({ row, share }, i) => (
                      <div
                        key={row.label}
                        className={cn(
                          "flex items-center gap-2.5 rounded-2xl border-2 border-foreground bg-white py-1.5 pl-2 pr-3 transition-transform hover:rotate-0",
                          i % 2 ? "rotate-1" : "-rotate-1",
                        )}
                      >
                        <span className="poster flex size-11 items-center justify-center rounded-full border-2 border-foreground bg-[var(--pink)] text-lg leading-none text-white">
                          %{topPercent(share)}
                        </span>
                        <span className="leading-tight">
                          <span className="block font-extrabold">
                            {row.label}
                            {row.kind === "ratio" && " başarısı"}
                          </span>
                          <span className="block text-xs font-medium text-muted-foreground">{peers} arasında ilk %{topPercent(share)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {extrasCount === 0 ? (
                <p className="text-muted-foreground">Bu maçlar için detaylı istatistik (pas, ikili mücadele, hava topu gibi) henüz yok.</p>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
                  {detailGroups.map((grp) => {
                    const style = GROUP_STYLE[grp.title] ?? GROUP_STYLE["Hücum"];
                    const Icon = style.icon;
                    return (
                      <section
                        key={grp.title}
                        style={{ "--pop": style.pop } as React.CSSProperties}
                        className="rounded-3xl border-[2.5px] border-foreground bg-secondary/50 p-3 shadow-[5px_5px_0_var(--pop)] sm:p-4"
                      >
                        <h3 className="poster mb-3 flex w-fit -rotate-1 items-center gap-2 rounded-full bg-foreground px-3.5 py-1 text-xl text-white">
                          <Icon className="size-5" aria-hidden="true" />
                          {grp.title}
                        </h3>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {grp.rows.map((row) => (
                            <DetailLine key={row.label} row={row} games={games} share={shareOf.get(row.label) ?? null} peers={peers} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grafik */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">İstatistik grafiği</CardTitle>
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
                  <span className="text-muted-foreground">Eşik</span>
                  {line > 0.5 ? (
                    <Link href={href({ line: String(line - 1) })} scroll={false} className={step} aria-label="Eşiği düşür">
                      −
                    </Link>
                  ) : (
                    <span className={cn(step, "opacity-40")}>−</span>
                  )}
                  <span className="w-8 text-center font-bold tabular-nums">{Math.ceil(line)}+</span>
                  <Link href={href({ line: String(line + 1) })} scroll={false} className={step} aria-label="Eşiği yükselt">
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
                    : "Bu filtrelere uyan, ilk 11'de başladığı maç yok."}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {statLabel}: yalnızca ilk 11&apos;de başladığı maçlar, soldan sağa en yeniden eskiye. {Math.ceil(line)} ve üzeri yaptığı maçlar yeşil görünür.
              </p>
            </CardContent>
          </Card>

          {/* Maç kaydı: sonuç rozeti, rakip, skor, puan ve bütün sayılar; başlık ve maç sütunu kaydırırken sabit */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Maç kaydı</CardTitle>
              <p className="text-sm text-muted-foreground">
                Son {games.length} maçın dökümü. Tablo yana ve aşağı kayar; maça tıklayınca maç sayfası açılır.
              </p>
            </CardHeader>
            <CardContent>
              <div className="pop-scroll max-h-[40rem] overflow-auto rounded-2xl border-2 border-foreground bg-white">
                <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-sm">
                  <thead>
                    <tr className="poster text-left text-sm">
                      <th className="sticky left-0 top-0 z-30 border-b-2 border-foreground bg-[var(--yellow)] px-3 py-2.5 font-normal">Maç</th>
                      <th className="sticky top-0 z-20 border-b-2 border-foreground bg-[var(--yellow)] px-3 py-2.5 text-center font-normal">Skor</th>
                      <th className="sticky top-0 z-20 border-b-2 border-foreground bg-[var(--yellow)] px-3 py-2.5 text-right font-normal">Dk</th>
                      <th className="sticky top-0 z-20 border-b-2 border-foreground bg-[var(--yellow)] px-3 py-2.5 text-center font-normal">Puan</th>
                      {logColumns.map((c) => (
                        <th
                          key={c.label}
                          title={c.title}
                          className={cn(
                            "sticky top-0 z-20 border-b-2 border-foreground px-3 py-2.5 text-right font-normal",
                            c.keys.includes(stat) ? "bg-foreground text-white" : "bg-[var(--yellow)]",
                          )}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((g, i) => {
                      const result = resultOf(g);
                      const zebra = i % 2 ? "bg-secondary" : "bg-white";
                      return (
                        <tr key={g.matchId} className={cn("group", !g.started && "text-muted-foreground")}>
                          <td className={cn("sticky left-0 z-10 border-r-2 border-foreground/15 px-3 py-2 group-hover:bg-[#fff3a6]", zebra)}>
                            <Link href={`/matches/${g.matchId}`} className="flex items-center gap-2.5 hover:text-primary" title={g.competition}>
                              {result ? (
                                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border-[1.5px] border-foreground text-xs font-black", RESULT_STYLE[result])}>
                                  {RESULT_LETTER[result]}
                                </span>
                              ) : (
                                <span className="size-6 shrink-0" />
                              )}
                              <TeamLogo id={g.opponentId} name={g.opponentName} size={24} />
                              <span className="min-w-0">
                                <span className="block max-w-28 truncate font-bold leading-tight sm:max-w-40">{g.opponentName}</span>
                                <span className="block text-[11px] leading-tight text-muted-foreground">
                                  {shortDate(g.date)} · {g.isHome ? "İç saha" : "Deplasman"}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className={cn("px-3 py-2 text-center group-hover:bg-[#fff3a6]", zebra)}>
                            <span className="poster text-lg tabular-nums">
                              {g.goalsFor}-{g.goalsAgainst}
                            </span>
                          </td>
                          <td className={cn("px-3 py-2 text-right tabular-nums group-hover:bg-[#fff3a6]", zebra)} title={g.started ? "İlk 11" : "Yedekten girdi"}>
                            {g.minutes}&apos;{!g.started && "*"}
                          </td>
                          <td className={cn("px-3 py-2 text-center group-hover:bg-[#fff3a6]", zebra)}>
                            {g.extras?.rating != null ? (
                              <span className={cn("inline-block min-w-10 rounded-full border-[1.5px] border-foreground px-1.5 text-center font-bold tabular-nums text-foreground", ratingTone(g.extras.rating))}>
                                {fmt(g.extras.rating, 1)}
                              </span>
                            ) : (
                              "–"
                            )}
                          </td>
                          {logColumns.map((c) => {
                            const cell = logCell(c, g);
                            const award = !cell.zero && c.kind === "count" && (c.key === "goals" || c.key === "assists");
                            return (
                              <td
                                key={c.label}
                                className={cn(
                                  "px-3 py-2 text-right tabular-nums group-hover:bg-[#fff3a6]",
                                  zebra,
                                  c.keys.includes(stat) && "font-bold text-foreground",
                                  cell.zero && "text-muted-foreground/45",
                                )}
                              >
                                {award ? (
                                  <span className="inline-flex size-6 items-center justify-center rounded-full border-[1.5px] border-foreground bg-[var(--yellow)] font-black text-foreground">
                                    {cell.text}
                                  </span>
                                ) : cell.zero ? (
                                  cell.text
                                ) : (
                                  <span className={cn("inline-block min-w-6 rounded-full border-[1.5px] border-foreground px-1.5 text-center font-bold text-foreground", c.keys.some((k) => LOWER_IS_BETTER.has(k)) ? "bg-[#ffc2dc]" : "bg-[#b9f5df]")}>
                                    {cell.text}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                * Yedekten girdiği maç; ortalama ve oranlara katılmaz. – işareti o maç için detaylı veri olmadığını gösterir.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Kariyer ve transferler (filtrelerden bağımsız) */}
      {(data.career.length > 0 || data.transfers.length > 0) && (
        <div className="grid items-start gap-9 lg:grid-cols-5">
          {data.career.length > 0 && (
            <CareerCard rows={data.career} nationalTeamId={profile.nationalTeamId} className={data.transfers.length > 0 ? "lg:col-span-3" : "lg:col-span-5"} />
          )}
          {data.transfers.length > 0 && (
            <div className={data.career.length > 0 ? "lg:col-span-2" : "lg:col-span-5"}>
              <TransfersCard transfers={data.transfers} />
            </div>
          )}
        </div>
      )}
      {data.career.length === 0 && data.transfers.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Bu oyuncunun kariyer ve transfer geçmişi henüz yüklenmedi.
          </CardContent>
        </Card>
      )}
    </main>
  );
}
