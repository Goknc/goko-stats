// Gokostats logosu: poster harfli yazı + yükselen üç sütun (istatistik işareti).
import { cn } from "@/lib/utils";

// Yükselen sütunlar: sarı, mürekkep çerçeveli. Liste işareti olarak da kullanılır.
export function StatsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} aria-hidden="true">
      <g fill="var(--yellow)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round">
        <rect x="2" y="13" width="5.5" height="9" rx="1" />
        <rect x="9.25" y="8" width="5.5" height="14" rx="1" />
        <rect x="16.5" y="2" width="5.5" height="20" rx="1" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("group inline-flex items-end gap-1.5", className)}>
      <span className="poster text-2xl leading-none tracking-wide sm:text-4xl">
        Goko<span className="text-[var(--pink)]">stats</span>
      </span>
      <StatsMark className="wiggle mb-0.5 size-5 sm:mb-1 sm:size-7" />
    </span>
  );
}
