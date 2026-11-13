// Oranın yüzdesi, güce göre vurgulu: %90+ "ateşli" (büyür, pembe gölge, hafifçe titrer), %75-89 mor, altı siyah.
import { cn } from "@/lib/utils";

export function RatePercent({ rate, className }: { rate: number | null; className?: string }) {
  if (rate === null) return <span className={cn("text-muted-foreground", className)}>-</span>;
  const pct = Math.round(rate * 100);
  return (
    <span
      className={cn(
        "inline-block font-semibold tabular-nums",
        pct >= 90 ? "rate-fire" : pct >= 75 ? "rate-hot" : "text-foreground",
        className,
      )}
    >
      %{pct}
    </span>
  );
}
