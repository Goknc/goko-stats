// Form şeridi: son maçlarda gerçekleşti (yeşil ✓) / gerçekleşmedi (kırmızı ✗) / veri yok (gri) kutucukları.
// Soldan sağa eskiden yeniye okunur; en sağdaki en son maç.
import { cn } from "@/lib/utils";

interface FormStripProps {
  outcomes: (boolean | null)[]; // en yeniden eskiye (kanıt sırası)
  labels?: string[]; // kutucuğun üzerine gelince görünen maç bilgisi
  size?: "sm" | "md" | "auto"; // auto: küçük ekranda sm, geniş ekranda md
}

function Mark({ hit }: { hit: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className="size-[70%]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {hit ? <path d="M2.5 6.3 5 8.7 9.5 3.6" /> : <path d="M3.3 3.3 8.7 8.7M8.7 3.3 3.3 8.7" />}
    </svg>
  );
}

export function FormStrip({ outcomes, labels, size = "md" }: FormStripProps) {
  const items = outcomes.map((outcome, i) => ({ outcome, label: labels?.[i] })).reverse();
  const hits = outcomes.filter((o) => o === true).length;
  const total = outcomes.filter((o) => o !== null).length;

  return (
    <div className="flex gap-0.75" role="img" aria-label={`${total} maçın ${hits} tanesinde gerçekleşti`}>
      {items.map((item, i) => (
        <span
          key={i}
          title={item.label}
          className={cn(
            "flex items-center justify-center rounded-[3px] text-white",
            size === "sm" ? "size-3.5" : size === "auto" ? "size-3.5 xl:size-4" : "size-4",
            item.outcome === null ? "bg-unknown" : item.outcome ? "bg-hit-block" : "bg-miss-block",
          )}
        >
          {item.outcome !== null && <Mark hit={item.outcome} />}
        </span>
      ))}
    </div>
  );
}
