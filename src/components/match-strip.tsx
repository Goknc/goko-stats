// Maç şeridi: form şeridinin geniş hali. Her kutucukta rakibin logosu ve takımın gözünden skor;
// trend gerçekleştiyse nane yeşili, gerçekleşmediyse pembe, veri yoksa gri. SOLDAN SAĞA YENİDEN ESKİYE: en soldaki en son maç.
// Kutucuklar esner (10-15-20 maç alana yayılır); sığmazsa yana kayar ve kaydırma soldan, en yeni maçtan başlar.
// StripGroup içindeyse aynı gruptaki şeritler birlikte kayar.
import Link from "next/link";
import { TeamLogo } from "@/components/entity-image";
import type { EvidenceRow } from "@/lib/analysis";
import { cn } from "@/lib/utils";

// slots: şeridin ayıracağı kutucuk sayısı (alt alta iki şerit hizalı kalsın diye); eksikler boş yer tutar
export function MatchStrip({ evidence, slots = 0 }: { evidence: EvidenceRow[]; slots?: number }) {
  const hits = evidence.filter((e) => e.outcome === true).length;
  const total = evidence.filter((e) => e.outcome !== null).length;

  return (
    <div
      data-strip
      className="pop-scroll flex gap-1 overflow-x-auto pb-2 pl-0.5 pr-1.5 pt-2"
      role="img"
      aria-label={`${total} maçın ${hits} tanesinde gerçekleşti`}
    >
      {/* evidence en yeniden eskiye gelir */}
      {evidence.map((e, i) => (
        <Link
          key={e.matchId}
          href={`/matches/${e.matchId}`}
          title={e.label}
          className={cn(
            // K-pop: mini photocard. Üstüne gelince eğilir.
            "relative flex min-w-[38px] max-w-14 flex-1 basis-0 flex-col items-center gap-0.5 rounded-xl border-2 border-foreground px-0.5 pb-1 pt-1.5 transition-transform hover:-translate-y-1 hover:-rotate-3",
            e.outcome === null ? "bg-unknown" : e.outcome ? "bg-[#b9f5df]" : "bg-[#ffc2dc]",
          )}
        >
          {e.opponentId !== undefined ? (
            <TeamLogo id={e.opponentId} name={e.opponentName ?? ""} size={24} />
          ) : (
            <span className="size-6" />
          )}
          <span className="poster text-sm leading-none tabular-nums">{e.score ?? "–"}</span>
          {/* En yeni maç işareti */}
          {i === 0 && <span className="absolute -right-1 -top-1.5 size-3 rounded-full border-2 border-foreground bg-[var(--yellow)]" />}
        </Link>
      ))}
      {Array.from({ length: Math.max(0, slots - evidence.length) }, (_, i) => (
        <span key={`bos-${i}`} className="min-w-[38px] max-w-14 flex-1 basis-0 border-2 border-transparent" aria-hidden="true" />
      ))}
    </div>
  );
}
