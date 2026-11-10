// Krallık: son maçlardaki değerler, sütun + altında sayı (çubuktan tahmin etmek gerekmesin).
// Sıra gelen dizideki gibi. 0 olan maç ince çizgi + "0", veri yoksa "–".
// hitAt verilirse çizgiyi tutan maçlar yeşil, tutmayanlar soluk (krallık: 2+ isabetli şut gibi).
import { cn } from "@/lib/utils";

export function ValueColumns({ values, className, hitAt }: { values: (number | null)[]; className?: string; hitAt?: number }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));

  return (
    <div className={cn("flex items-end gap-1", className)}>
      {values.map((v, i) => (
        <div key={i} className="flex w-5 flex-col items-center gap-0.5">
          <div className="flex h-8 w-full items-end">
            <div
              className={cn(
                "w-full rounded-sm",
                !v ? "bg-muted-foreground/30" : hitAt === undefined ? "bg-primary" : v >= hitAt ? "bg-hit-block" : "bg-muted-foreground/40",
              )}
              style={{ height: v ? `${(v / max) * 100}%` : "2px" }}
            />
          </div>
          <span
            className={cn(
              "mt-0.5 text-[11px] font-semibold leading-none tabular-nums",
              v ? "text-foreground" : "text-muted-foreground/60",
            )}
          >
            {v ?? "–"}
          </span>
        </div>
      ))}
    </div>
  );
}
