// Form şeridi: son maçlarda gerçekleşti (yeşil ✓) / gerçekleşmedi (pembe ✗) / veri yok (gri) kutucukları.
// Soldan sağa eskiden yeniye okunur; en sağdaki en son maç.
import { cn } from "@/lib/utils";

interface FormStripProps {
  outcomes: (boolean | null)[]; // en yeniden eskiye (maç kaydı sırası)
  labels?: string[]; // kutucuğun üzerine gelince görünen maç bilgisi
  size?: "sm" | "md" | "lg" | "auto"; // auto: küçük ekranda sm, geniş ekranda md
}

function Mark({ hit }: { hit: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className="size-[68%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {hit ? <path d="M2.5 6.3 5 8.7 9.5 3.6" /> : <path d="M3.3 3.3 8.7 8.7M8.7 3.3 3.3 8.7" />}
    </svg>
  );
}

const SIZES = { sm: "size-4 rounded-md", md: "size-5 rounded-md", lg: "aspect-square min-w-0 max-w-6 flex-1 basis-0 rounded-md border-[1.5px] border-foreground", auto: "size-4 rounded-md xl:size-5" };

export function FormStrip({ outcomes, labels, size = "md" }: FormStripProps) {
  const items = outcomes.map((outcome, i) => ({ outcome, label: labels?.[i] })).reverse();
  const hits = outcomes.filter((o) => o === true).length;
  const total = outcomes.filter((o) => o !== null).length;

  return (
    <div className={cn("flex", size === "lg" ? "gap-[3px]" : "flex-wrap gap-0.75")} role="img" aria-label={`${total} maçın ${hits} tanesinde gerçekleşti`}>
      {items.map((item, i) => (
        <span
          key={i}
          title={item.label}
          className={cn(
            "flex items-center justify-center text-white",
            size !== "lg" && "shrink-0", // lg: hep tek satır, sığmazsa kutucuklar küçülür
            SIZES[size],
            item.outcome === null ? "bg-unknown" : item.outcome ? "bg-hit-block" : "bg-miss-block",
          )}
        >
          {item.outcome !== null && <Mark hit={item.outcome} />}
        </span>
      ))}
    </div>
  );
}
