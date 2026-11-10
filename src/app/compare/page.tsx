// src/app/compare/page.tsx
// Takım karşılaştırma (matchup): iki takımın son maçlardaki formu, ortalamaları, maç trendleri ve aralarındaki maçlar.
// Adres: /compare?a=12&b=34&venue=all&comp=all&last=10. Takımlar arama kutusuyla seçilir.
import Link from "next/link";
import { loadTeamPage } from "@/lib/team-page";
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

// Karşılaştırmada iki takımı birlikte ilgilendiren maç trendleri (tek tarafa bakan Ev/Dep trendleri hariç)
const MATCH_TRENDS: MatchTrendDef[] = TRENDS.filter((t) => t.scope === "TEAM" && t.side === null);

const RESULT_TONE: Record<Result, string> = { W: "bg-hit-block text-white", D: "bg-secondary text-foreground", L: "bg-miss-block text-white" };
const RESULT_LABEL: Record<Result, string> = { W: "G", D: "B", L: "M" };

const pick = <T extends string>(value: string | undefined, options: readonly { key: T }[], fallback: T): T =>
  options.some((o) => o.key === value) ? (value as T) : fallback;
const fmt = (n: number | null) => (n === null ? "–" : n.toFixed(2).replace(".", ","));
const pct = (r: number | null) => (r === null ? "–" : `%${Math.round(r * 100)}`);

export const metadata = { title: { absolute: "Karşılaştır · Gokostats" } };

function TeamSlot({ team, param }: { team: { id: number; name: string; league: { id: number; name: string } | null } | null; param: "a" | "b" }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      {team ? (
        <Link href={`/teams/${team.id}`} className="flex items-center gap-3 hover:text-primary">
          <TeamLogo id={team.id} name={team.name} size={48} />
          <span className="min-w-0">
            <span className="block truncate text-lg font-bold">{team.name}</span>
            {team.league && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LeagueLogo id={team.league.id} name={team.league.name} size={14} />
                {team.league.name}
              </span>
            )}
          </span>
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">{param === "a" ? "Birinci" : "İkinci"} takımı seç</p>
      )}
      <SearchBox pickParam={param} placeholder={team ? "Değiştir…" : "Takım ara"} />
    </div>
  );
}

function Form({ form }: { form: Result[] }) {
  return (
    <span className="flex gap-1">
      {form.map((r, i) => (
        <span key={i} className={cn("inline-flex size-6 items-center justify-center rounded text-xs font-bold", RESULT_TONE[r])}>
          {RESULT_LABEL[r]}
        </span>
      ))}
    </span>
  );
}

// İki değer yan yana; büyük olan vurgulanır (higherIsBetter=false ise küçük olan)
function CompareRow({ label, a, b, format, higherIsBetter = true }: { label: string; a: number | null; b: number | null; format: (n: number | null) => string; higherIsBetter?: boolean }) {
  const better = a !== null && b !== null && a !== b ? ((a > b) === higherIsBetter ? "a" : "b") : null;
  const max = Math.max(a ?? 0, b ?? 0) || 1;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
      <div className="flex items-center justify-end gap-2">
        <div className="hidden h-1.5 w-24 justify-end overflow-hidden rounded-full bg-secondary sm:flex">
          <div className={cn("h-full rounded-full", better === "a" ? "bg-home" : "bg-muted-foreground/40")} style={{ width: `${((a ?? 0) / max) * 100}%` }} />
        </div>
        <span className={cn("w-14 text-right tabular-nums", better === "a" && "font-bold text-foreground")}>{format(a)}</span>
      </div>
      <span className="w-36 text-center text-sm text-muted-foreground sm:w-44">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("w-14 tabular-nums", better === "b" && "font-bold text-foreground")}>{format(b)}</span>
        <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-secondary sm:flex">
          <div className={cn("h-full rounded-full", better === "b" ? "bg-away" : "bg-muted-foreground/40")} style={{ width: `${((b ?? 0) / max) * 100}%` }} />
        </div>
      </div>
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
  let pa: TeamProfile | null = null;
  let pb: TeamProfile | null = null;
  if (ready) {
    pa = teamProfile(dataA.matches, dataA.team.id, filter, MATCH_TRENDS);
    pb = teamProfile(dataB.matches, dataB.team.id, filter, MATCH_TRENDS);
  }
  const h2h = ready ? await loadHeadToHead(dataA.team.id, dataB.team.id, new Date(), h2hFilter) : null;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Karşılaştır</h1>
        <p className="text-muted-foreground">İki takımın son maçlarını yan yana incele</p>
      </div>

      <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <TeamSlot team={dataA ? { ...dataA.team, league: dataA.league } : null} param="a" />
        <span className="self-center text-center font-display text-xl font-bold text-muted-foreground">vs</span>
        <TeamSlot team={dataB ? { ...dataB.team, league: dataB.league } : null} param="b" />
      </div>

      {dataA && dataB && dataA.team.id === dataB.team.id && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">Aynı takımı iki kez seçtin; farklı bir takım seç.</CardContent>
        </Card>
      )}

      {ready && pa && pb && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={LASTS.map((n) => ({ key: n, label: `Son ${n}` }))} value={last} href={(k) => href({ last: k })} />
            <Segmented options={VENUES} value={venue} href={(k) => href({ venue: k })} />
            <Segmented options={COMPS} value={comp} href={(k) => href({ comp: k })} />
            <Link href={href({ a: state.b, b: state.a })} scroll={false} className="ml-auto text-sm text-muted-foreground hover:text-foreground">
              ⇄ Yer değiştir
            </Link>
          </div>

          {/* Form ve kayıt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Form</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                { data: dataA, p: pa },
                { data: dataB, p: pb },
              ].map(({ data, p }) => (
                <div key={data.team.id} className="space-y-2 rounded-lg bg-secondary/40 p-3">
                  <div className="flex items-center gap-2 font-semibold">
                    <TeamLogo id={data.team.id} name={data.team.name} size={20} />
                    {data.team.name}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="tabular-nums text-muted-foreground">
                      {p.games} maç · <span className="text-hit">{p.record.W}G</span> {p.record.D}B <span className="text-miss">{p.record.L}M</span>
                    </span>
                    <Form form={p.form} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Ortalamalar */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Maç başı ortalamalar</CardTitle>
              <p className="text-sm text-muted-foreground">Takımın kendi değeri / rakibe izin verdiği</p>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <CompareRow label="Galibiyet oranı" a={pa.games ? pa.record.W / pa.games : null} b={pb.games ? pb.record.W / pb.games : null} format={pct} />
              {pa.categories.map((c, i) => {
                const cb = pb.categories[i];
                return (
                  <div key={c.key}>
                    <CompareRow label={c.key === "goals" ? "Attığı gol" : c.label} a={c.for} b={cb.for} format={fmt} />
                    <CompareRow
                      label={c.key === "goals" ? "Yediği gol" : `${c.label} (rakip)`}
                      a={c.against}
                      b={cb.against}
                      format={fmt}
                      higherIsBetter={c.key === "cards" || c.key === "fouls"}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Maç trendleri */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Maç trendleri</CardTitle>
              <p className="text-sm text-muted-foreground">Takımların son maçlarında ne sıklıkla gerçekleşti</p>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {pa.trends.map((t, i) => {
                const tb = pb.trends[i];
                return (
                  <div key={t.code} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 text-sm">
                    <span className="text-right tabular-nums">
                      <span className="mr-2 text-xs text-muted-foreground">
                        {t.hits}/{t.total}
                      </span>
                      <strong className={cn((t.rate ?? 0) >= 0.6 && "text-hit")}>{pct(t.rate)}</strong>
                    </span>
                    <span className="w-36 text-center text-muted-foreground sm:w-44">{t.name}</span>
                    <span className="tabular-nums">
                      <strong className={cn((tb.rate ?? 0) >= 0.6 && "text-hit")}>{pct(tb.rate)}</strong>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {tb.hits}/{tb.total}
                      </span>
                    </span>
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
