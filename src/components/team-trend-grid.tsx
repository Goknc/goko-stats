// Maç detayı, takım trendleri: tablo yerine gruplanmış kart ızgarası (Gol · Ev / Dep · Korner · Kart).
// Her kartta iki takımın karnesi: oran, eşik çizgili ilerleme çubuğu ve form şeridi.
// Tek taraflı trendlerde (Ev kazanır...) kararı vermeyen takımın karnesi "bilgi" olarak işaretli.
import type { RateSummary, TeamTrendResult } from "@/lib/analysis";
import { isDeciding } from "@/lib/engine/side";
import { Badge } from "@/components/ui/badge";
import { FormStrip } from "@/components/form-strip";
import { RatePercent } from "@/components/rate-percent";
import { TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

interface Team {
  id: number;
  name: string;
  label: string; // "iç saha" / "deplasman" / "genel"
}

interface TeamTrendGridProps {
  trends: TeamTrendResult[];
  home: Team;
  away: Team;
}

const GROUPS = ["Gol", "Ev / Dep", "Korner", "Kart"] as const;
function groupOf(m: TeamTrendResult): (typeof GROUPS)[number] {
  if (m.statKey === "totalCorners") return "Korner";
  if (m.statKey === "totalCards") return "Kart";
  if (m.side) return "Ev / Dep";
  return "Gol";
}

export function TeamTrendGrid({ trends, home, away }: TeamTrendGridProps) {
  return (
    <div className="space-y-6">
      {GROUPS.map((group) => {
        const items = trends.filter((m) => groupOf(m) === group);
        if (!items.length) return null;
        return (
          <section key={group} className="space-y-3">
            <h3 className="poster text-xl text-foreground">{group}</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((m) => (
                <div
                  key={m.code}
                  className={cn(
                    "space-y-4 rounded-2xl border-2 border-foreground bg-white p-4",
                    m.recommended && "bg-[#fff6c2] shadow-[5px_5px_0_var(--pink)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="poster text-2xl leading-none">{m.name}</span>
                        {m.recommended && <Badge>Öne çıkan</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">eşik %{Math.round(m.threshold * 100)}</div>
                    </div>
                  </div>
                  <SideRow team={home} s={m.home} threshold={m.threshold} info={!isDeciding(m.side, "home")} />
                  <SideRow team={away} s={m.away} threshold={m.threshold} info={!isDeciding(m.side, "away")} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SideRow({ team, s, threshold, info }: { team: Team; s: RateSummary; threshold: number; info: boolean }) {
  const passes = !s.lowSample && s.rate !== null && s.rate >= threshold;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <TeamLogo id={team.id} name={team.name} size={22} />
          <span className="truncate font-bold">{team.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            · {team.label}
            {info && " · bilgi"}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            {s.hits}/{s.total}
          </span>
          {s.total === 0 ? (
            <span className="text-sm text-muted-foreground">veri yok</span>
          ) : s.lowSample ? (
            <span className="text-sm text-muted-foreground">az örnek</span>
          ) : (
            <RatePercent rate={s.rate} className={cn("poster text-2xl font-normal", passes && s.rate !== null && s.rate < 0.9 && "text-hit")} />
          )}
        </span>
      </div>
      {/* Oran çubuğu: dikey çizgi eşik */}
      <div className="relative h-3 rounded-full border-2 border-foreground bg-white">
        <div
          className={cn("h-full rounded-full", passes ? "bg-hit-block" : "bg-[var(--lilac)]")}
          style={{ width: `${Math.round((s.rate ?? 0) * 100)}%` }}
        />
        <div
          className="absolute -top-1.5 h-5 w-1 rounded-full bg-foreground"
          style={{ left: `${Math.round(threshold * 100)}%` }}
          title={`eşik %${Math.round(threshold * 100)}`}
        />
      </div>
      <FormStrip outcomes={s.evidence.map((e) => e.outcome)} labels={s.evidence.map((e) => e.label)} size="sm" />
    </div>
  );
}
