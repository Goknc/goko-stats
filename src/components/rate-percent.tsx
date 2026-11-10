// Oranın yüzdesi, güce göre renkli: %90+ yeşil, %75-89 camgöbeği, altı beyaz.
import { cn } from "@/lib/utils";

export function RatePercent({ rate, className }: { rate: number | null; className?: string }) {
  if (rate === null) return <span className={cn("text-muted-foreground", className)}>-</span>;
  const pct = Math.round(rate * 100);
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        pct >= 90 ? "text-hit" : pct >= 75 ? "text-primary" : "text-foreground",
        className,
      )}
    >
      %{pct}
    </span>
  );
}