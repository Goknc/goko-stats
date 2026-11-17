// Maç detayı, takım trendleri: gruplanmış kart ızgarası (Gol · Takım bazında · Korner · Kart).
// Her kartta iki takımın karnesi: oran, eşik çizgili ilerleme çubuğu ve form şeridi.
// Tek takıma bakan trendlerde başlıkta takımın adı yazar ("Letonya kazandı"); rakibin satırı aynı olayı
// kendi açısından söyler ("Kaybetti") ve karara katılmadığı için daha sakin görünür.
import type { RateSummary, TeamTrendResult } from "@/lib/analysis";
import { isDeciding } from "@/lib/engine/side";
import { sideCaption, trendTitle } from "@/lib/trend-labels";
import { Badge } from "@/components/ui/badge";
import { FormStrip } from "@/components/form-strip";
import { RatePercent } from "@/components/rate-percent";
import { TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

interface Team {
  id: number;
  name: string;
}

interface TeamTrendGridProps {
  trends: TeamTrendResult[];
  home: Team;
  away: Team;
}

const GROUPS = ["Gol", "Takım bazında", "Korner", "Kart"] as const;
function groupOf(m: TeamTrendResult): (typeof GROUPS)[number] {
  if (m.statKey === "totalCorners") return "Korner";
  if (m.statKey === "totalCards") return "Kart";
  if (m.side) return "Takım bazında";
  return "Gol";
}

export function TeamTrendGrid({ trends, home, away }: TeamTrendGridProps) {
  return (
    <div className="space-y-10">
      {GROUPS.map((group) => {
        const items = trends.filter((m) => groupOf(m) === group);
        if (!items.length) return null;
        return (
          <section key={group} className="space-y-4">
            <h3 className="poster text-xl text-foreground">{group}</h3>
            <div className="grid gap-x-6 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
              {items.map((m) => (
                <div
                  key={m.code}
                  className={cn(
                    "rounded-2xl border-2 border-foreground bg-white p-4 sm:p-5",
                    m.recommended && "bg-[#fff6c2] shadow-[5px_5px_0_var(--pink)]",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="poster text-2xl leading-none">{trendTitle(m, home.name, away.name)}</span>
                    {m.recommended && <Badge>Öne çıkan</Badge>}
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">Eşik %{Math.round(m.threshold * 100)}</div>
                  <div className="mt-4 divide-y-2 divide-dashed divide-border">
                    <SideRow team={home} s={m.home} threshold={m.threshold} caption={sideCaption(m, "home")} muted={!isDeciding(m.side, "home")} />
                    <SideRow team={away} s={m.away} threshold={m.threshold} caption={sideCaption(m, "away")} muted={!isDeciding(m.side, "away")} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SideRow({ team, s, threshold, caption, muted }: { team: Team; s: RateSummary; threshold: number; caption: string | null; muted: boolean }) {
  const passes = !s.lowSample && s.rate !== null && s.rate >= threshold;
  return (
    <div className="space-y-2.5 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <TeamLogo id={team.id} name={team.name} size={28} />
          <span className="min-w-0">
            <span className="block truncate text-base font-extrabold leading-tight">{team.name}</span>
            {caption && <span className="block text-xs font-semibold leading-tight text-muted-foreground">{caption}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span className="text-sm tabular-nums text-muted-foreground">
            {s.hits}/{s.total}
          </span>
          {s.total === 0 ? (
            <span className="text-sm text-muted-foreground">Veri yok</span>
          ) : s.lowSample ? (
            <span className="text-sm text-muted-foreground">Az maç</span>
          ) : (
            <RatePercent
              rate={s.rate}
              className={cn("poster text-3xl font-normal", !muted && passes && s.rate !== null && s.rate < 0.9 && "text-hit", muted && "!text-foreground/60 ![animation:none] ![text-shadow:none] !text-3xl")}
            />
          )}
        </span>
      </div>
      {/* Oran çubuğu: dikey çizgi eşik (karara katılmayan satırda eşik çizgisi yok) */}
      <div className="relative h-3.5 rounded-full border-2 border-foreground bg-white">
        <div
          className={cn("h-full rounded-full", muted ? "bg-foreground/25" : passes ? "bg-hit-block" : "bg-[var(--lilac)]")}
          style={{ width: `${Math.round((s.rate ?? 0) * 100)}%` }}
        />
        {!muted && (
          <div
            className="absolute -top-1.5 h-5.5 w-1 rounded-full bg-foreground"
            style={{ left: `${Math.round(threshold * 100)}%` }}
            title={`Eşik %${Math.round(threshold * 100)}`}
          />
        )}
      </div>
      <FormStrip outcomes={s.evidence.map((e) => e.outcome)} labels={s.evidence.map((e) => e.label)} size="lg" />
    </div>
  );
}
