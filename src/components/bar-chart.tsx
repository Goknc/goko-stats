// src/components/bar-chart.tsx
// Maç maç sütun grafiği (statshub "Charts" gibi): çizgiyi geçen sütun yeşil, geçmeyen kırmızı.
// Soldan sağa en yeniden eskiye. Sütun genişliği sınırlı (az maçta dev sütun olmaz), ölçek çizginin
// üstünde ve altında pay bırakır. Sunucu bileşeni; üzerine gelince maç bilgisi (title) görünür.
import Link from "next/link";
import { cn } from "@/lib/utils";
import { passesLine, type LineDir } from "@/lib/engine/team-metrics";

export interface Bar {
  key: number | string;
  value: number;
  label: string; // altta: tarih
  sub?: string; // altta ikinci satır: rakip / iç-dış
  title: string; // üzerine gelince
  href?: string;
}

// Eksen üst sınırı: en büyük değer ya da çizginin %20 üstü, yukarı yuvarlanmış; en az 2
export function axisMax(values: number[], line: number): number {
  const top = Math.max(line + 0.5, ...values);
  return Math.max(2, Math.ceil(top * 1.2));
}

export function BarChart({ bars, line, dir }: { bars: Bar[]; line: number; dir: LineDir }) {
  const max = axisMax(bars.map((b) => b.value), line);
  const pct = (v: number) => (v / max) * 100;
  const ticks = [...new Set([0, Math.round(max / 2), max])];
  const col = "w-full max-w-12 min-w-5 flex-1";

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[22rem] gap-2">
        {/* Y ekseni */}
        <div className="relative h-56 w-5 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${pct(t)}%` }}>
              {t}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-56">
            {/* Yatay kılavuz çizgileri */}
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${pct(t)}%` }} />
            ))}
            {/* Çizgi */}
            <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-[var(--purple)]" style={{ bottom: `${pct(line)}%` }}>
              <span className="absolute -top-3 right-0 rounded-full bg-[var(--purple)] px-2 text-xs font-bold tabular-nums text-white">
                {String(line).replace(".", ",")}
              </span>
            </div>

            <div className="relative flex h-full items-end justify-center gap-1.5 pr-10">
              {bars.map((b) => {
                const ok = passesLine(b.value, line, dir);
                const body = (
                  <div className="flex h-full flex-col justify-end">
                    {b.value === 0 && <div className="mb-0.5 text-center text-xs font-bold tabular-nums text-muted-foreground">0</div>}
                    <div
                      className={cn(
                        "flex items-start justify-center rounded-t-xl pt-1.5 text-xs font-bold tabular-nums text-foreground/80",
                        ok ? "bg-[#9eecd0]" : "bg-[#ffb9d6]",
                      )}
                      style={{ height: b.value > 0 ? `${pct(b.value)}%` : "3px" }}
                    >
                      {b.value > 0 && pct(b.value) > 8 ? b.value : null}
                    </div>
                  </div>
                );
                return (
                  <div key={b.key} className={cn("h-full", col)} title={b.title}>
                    {b.href ? (
                      <Link href={b.href} className="block h-full transition-opacity hover:opacity-80">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center gap-1.5 border-t border-border pr-10 pt-1.5">
            {bars.map((b) => (
              <div key={b.key} className={cn("text-center text-[10px] leading-tight text-muted-foreground", col)}>
                <div className="tabular-nums">{b.label}</div>
                {b.sub && <div className="truncate">{b.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
