// Günün trendleri: seçilen tarihteki tüm maçlarda eşiği geçen takım ve oyuncu istatistikleri.
// Trend başlıklarına göre gruplu; açılır listeyle tek trende filtrelenir.
// Sıralama: Yüzde (varsayılan) · Saat · Maç (maç maç gruplar).
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listable } from "@/lib/match-filters";
import { analyzeMatch, type EvidenceRow, type RateSummary } from "@/lib/analysis";
import { analysisOptions, DEFAULT_SAMPLE, sampleFromParams, sampleParams, type SampleSettings } from "@/lib/app-settings";
import { SampleBar } from "@/components/sample-bar";
import { sideCaption, trendTitle } from "@/lib/trend-labels";
import { TRENDS } from "@/lib/trend-config";
import { dayRange, formatLongDate, formatTime, matchDayKey, parseDateParam } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchStrip } from "@/components/match-strip";
import { PlayerPhoto } from "@/components/entity-image";
import { StripGroup } from "@/components/strip-group";
import { RatePercent } from "@/components/rate-percent";
import { FilterSelect } from "@/components/filter-select";
import { cn } from "@/lib/utils";
import { pickStrength } from "@/lib/engine/side";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Günün trendleri · Gokostats" } };

// Bir trendin dayandığı tek oran: takımda iki tane (ev sahibi, deplasman), oyuncuda bir tane.
// note: tek takıma bakan trendlerde satırın açıklaması ("Kazandı" / "Kaybetti").
interface Line {
  label: string;
  playerId?: number; // oyuncu trendi: etiketin yanında fotoğraf, şeritte skor yerine oyuncunun sayısı
  hits: number;
  total: number;
  rate: number | null;
  evidence: EvidenceRow[];
  note?: string | null;
}

interface Pick {
  code: string;
  trendName: string;
  matchId: number;
  time: Date;
  league: string;
  match: string;
  lines: Line[];
  rate: number; // sıralama: maç trendinde zayıf halka, tek takıma bakan trendde o takımın oranı
  sample: number; // eşit yüzdede çok maçlı olan önde
}

const toLine = (label: string, s: RateSummary, note: string | null = null): Line => ({
  label,
  note,
  hits: s.hits,
  total: s.total,
  rate: s.rate,
  evidence: s.evidence,
});

type SortKey = "yuzde" | "saat" | "mac";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "yuzde", label: "Yüzde" },
  { key: "saat", label: "Saat" },
  { key: "mac", label: "Maç" },
];

const byTime = (x: Pick, y: Pick) => x.time.getTime() - y.time.getTime() || x.match.localeCompare(y.match, "tr");
const byRate = (x: Pick, y: Pick) => y.rate - x.rate || y.sample - x.sample || byTime(x, y);

// showTrend: maça göre görünümde maç başlıkta olduğu için satırda trend adı gösterilir.
// Geniş ekranda üç sütun (saat · maç · karneler); karnelerde etiket, maç şeridi (rakip logosu + skor, sığmazsa yana kayar), x/y ve yüzde alt alta hizalı.
function PickRow({ pick, showTrend = false }: { pick: Pick; showTrend?: boolean }) {
  // İki karnenin kutucukları aynı genişlikte ve alt alta dursun diye ikisi de en uzun karne kadar yer ayırır
  const slots = Math.max(...pick.lines.map((l) => l.evidence.length));
  return (
    <div className="space-y-2 border-t-2 border-dashed border-border py-6 first:border-t-0 first:pt-0">
      {/* Üst satır: saat · maç (ya da trend adı) · lig */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="poster rounded-full bg-foreground px-2.5 py-0.5 text-base tabular-nums text-white">{formatTime(pick.time)}</span>
        {showTrend ? (
          <Badge variant="secondary" className="h-7 px-3 text-sm">{pick.trendName}</Badge>
        ) : (
          <>
            <Link href={`/matches/${pick.matchId}?date=${matchDayKey(pick.time)}`} className="text-xl font-extrabold leading-tight hover:text-primary">
              {pick.match}
            </Link>
            <span className="text-sm text-muted-foreground">{pick.league}</span>
          </>
        )}
      </div>
      {/* Karneler: şeritler tam genişlikte, birlikte kayar (StripGroup) */}
      <StripGroup className="space-y-1">
        {pick.lines.map((line) => (
          // Mobilde etiket, x/y ve yüzde üstte; şerit altta tam satır
          <div
            key={line.label}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem_4.75rem]"
          >
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              {line.playerId !== undefined && (
                <span className="photocard shrink-0 overflow-hidden">
                  <PlayerPhoto id={line.playerId} name={line.label} size={30} />
                </span>
              )}
              <span className="min-w-0 truncate">
                {line.label}
                {line.note && <span className="ml-1.5 text-xs font-semibold text-muted-foreground">{line.note}</span>}
              </span>
            </span>
            <div className="order-last col-span-full min-w-0 lg:order-none lg:col-span-1">
              <MatchStrip evidence={line.evidence} slots={slots} show={line.playerId !== undefined ? "value" : "score"} />
            </div>
            <span className="text-right text-sm tabular-nums text-muted-foreground">
              {line.hits}/{line.total}
            </span>
            <RatePercent rate={line.rate} className="poster text-right text-2xl font-normal" />
          </div>
        ))}
      </StripGroup>
    </div>
  );
}

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; trend?: string; sort?: string; n?: string; esik?: string }>;
}) {
  const params = await searchParams;
  const date = parseDateParam(params.date);
  const { start, end } = dayRange(date);
  const sort: SortKey = SORTS.some((o) => o.key === params.sort) ? (params.sort as SortKey) : "yuzde";

  const trends = TRENDS;
  // Maç sayısı ve eşik sayfadan seçilebilir (?n=10&esik=70); form türü varsayılan
  const sample: SampleSettings = { ...sampleFromParams(params), teamMode: DEFAULT_SAMPLE.teamMode, playerMode: DEFAULT_SAMPLE.playerMode };
  const options = analysisOptions(sample);
  const matches = await prisma.match.findMany({
    where: { eventDate: { gte: start, lt: end }, league: { isTracked: true }, ...listable },
    select: { id: true },
  });
  // Karne etiketi: genel formda yalnızca takım adı, saha modunda "X evinde" / "X deplasmanda"
  const venueLabel = (name: string, side: "home" | "away") =>
    sample.teamMode === "all" ? name : `${name} ${side === "home" ? "evinde" : "deplasmanda"}`;
  const analyses = (await Promise.all(matches.map((m) => analyzeMatch(m.id, options)))).filter((a) => a !== null);
  const trendName = new Map(trends.map((m) => [m.code, m.name]));

  const picks: Pick[] = [];
  for (const a of analyses) {
    const base = { matchId: a.matchId, time: a.eventDate, league: a.leagueName, match: `${a.homeTeam.name} – ${a.awayTeam.name}` };

    for (const t of a.teamTrends.filter((t) => t.recommended)) {
      const homeLine = toLine(venueLabel(a.homeTeam.name, "home"), t.home, sideCaption(t, "home"));
      const awayLine = toLine(venueLabel(a.awayTeam.name, "away"), t.away, sideCaption(t, "away"));
      const strength = pickStrength(t.side, t.home, t.away);
      picks.push({
        ...base,
        code: t.code,
        trendName: trendTitle(t, a.homeTeam.name, a.awayTeam.name),
        // Karar veren karne üstte
        lines: t.side === "AWAY" ? [awayLine, homeLine] : [homeLine, awayLine],
        rate: strength.rate ?? 0,
        sample: strength.total,
      });
    }

    for (const p of a.playerTrends.filter((p) => p.recommended)) {
      const team = p.teamId === a.homeTeam.id ? a.homeTeam.name : a.awayTeam.name;
      picks.push({
        ...base,
        code: p.code,
        trendName: trendName.get(p.code) ?? p.name,
        lines: [{ ...toLine(`${p.playerName} (${team})`, p.summary), playerId: p.playerId }],
        rate: p.summary.rate ?? 0,
        sample: p.summary.total,
      });
    }
  }

  const order = sort === "yuzde" ? byRate : byTime;

  // Trend başlıklarına göre grupla, her grup kendi içinde seçilen sırayla
  const groups = trends
    .map((trend) => ({ trend, picks: picks.filter((p) => p.code === trend.code).sort(order) }))
    .filter((g) => g.picks.length > 0);

  const selected = groups.some((g) => g.trend.code === params.trend) ? params.trend : undefined;
  const visible = selected ? groups.filter((g) => g.trend.code === selected) : groups;

  // Maça göre: seçili trend filtresine uyan trendler maç maç, maçlar saat sırasıyla
  const byMatch = new Map<number, Pick[]>();
  for (const p of picks.filter((p) => !selected || p.code === selected).sort(byTime)) {
    if (!byMatch.has(p.matchId)) byMatch.set(p.matchId, []);
    byMatch.get(p.matchId)!.push(p);
  }
  for (const list of byMatch.values()) list.sort(byRate);

  const link = (trend: string | undefined, s: SortKey, next: SampleSettings = sample) => {
    const q = new URLSearchParams({ date });
    if (trend) q.set("trend", trend);
    if (s !== "yuzde") q.set("sort", s);
    for (const [k, v] of Object.entries(sampleParams(next))) if (k === "n" || k === "esik") q.set(k, v);
    return `/trends?${q.toString()}`;
  };
  const filterLink = (trend?: string) => link(trend, sort);

  return (
    <main className="mx-auto w-full max-w-[92rem] space-y-9 px-4 py-8 sm:px-8 sm:py-12">
      <div>
        <h1 className="text-2xl font-bold">Günün trendleri</h1>
        <p className="text-muted-foreground">
          {formatLongDate(date)}: {analyses.length} maçta öne çıkan {picks.length} istatistik. Her takımın ve oyuncunun son {sample.size} maçına bakılır.
        </p>
      </div>

      <SampleBar value={sample} defaults={DEFAULT_SAMPLE} hrefFor={(next) => link(selected, sort, next)} modes={false} />

      {/* Filtre çubuğu: trend açılır listesi + sıralama */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterSelect
            label="Trend"
            selected={selected ?? ""}
            groups={[
              { options: [{ value: "", label: "Tümü", count: picks.length, href: filterLink() }] },
              ...(["TEAM", "PLAYER"] as const).map((scope) => ({
                title: scope === "TEAM" ? "Takım" : "Oyuncu",
                options: groups
                  .filter((g) => g.trend.scope === scope)
                  .map((g) => ({ value: g.trend.code, label: g.trend.name, count: g.picks.length, href: filterLink(g.trend.code) })),
              })),
            ].filter((g) => g.options.length > 0)}
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden font-bold sm:inline">Sırala</span>
            <div className="flex rounded-full border-2 border-foreground bg-white p-1 shadow-[3px_3px_0_var(--ink)]">
              {SORTS.map((o) => (
                <Link
                  key={o.key}
                  href={link(selected, o.key)}
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
        </div>
      )}

      {picks.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {matches.length === 0
              ? "Bu tarihte takip edilen liglerde maç yok."
              : "Bu tarihte eşiği geçen bir istatistik yok. Başka bir güne ya da daha düşük bir eşiğe bakabilirsin."}
          </CardContent>
        </Card>
      )}

      {sort === "mac" &&
        [...byMatch.values()].map((list) => (
          <Card key={list[0].matchId}>
            <CardHeader className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="poster rounded-full bg-foreground px-2.5 py-0.5 text-base tabular-nums text-white">{formatTime(list[0].time)}</span>
              <Link href={`/matches/${list[0].matchId}?date=${date}`} className="text-xl font-extrabold hover:text-primary">
                {list[0].match}
              </Link>
              <span className="text-sm text-muted-foreground">{list[0].league}</span>
              <span className="ml-auto text-sm font-semibold text-muted-foreground">{list.length} istatistik</span>
            </CardHeader>
            <CardContent>
              {list.map((p, i) => (
                <PickRow key={`${p.code}-${i}`} pick={p} showTrend />
              ))}
            </CardContent>
          </Card>
        ))}

      {sort !== "mac" && visible.map((g) => (
        <Card key={g.trend.code}>
          <CardHeader className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <CardTitle className="text-xl">{g.trend.name}</CardTitle>
            <Badge variant="secondary">{g.trend.scope === "TEAM" ? "Takım" : "Oyuncu"}</Badge>
            <span className="text-sm text-muted-foreground">
              Eşik %{sample.threshold ?? Math.round(g.trend.threshold * 100)} · {g.picks.length} maç
            </span>
          </CardHeader>
          <CardContent>
            {g.picks.map((p, i) => (
              <PickRow key={`${p.matchId}-${p.code}-${i}`} pick={p} />
            ))}
          </CardContent>
        </Card>
      ))}
    </main>
  );
}