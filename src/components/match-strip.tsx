// Maç şeridi: form şeridinin geniş hali. Her kutucukta rakibin logosu ve takımın gözünden skor;
// trend tuttuysa yeşil, tutmadıysa kırmızı, veri yoksa gri. Soldan sağa eskiden yeniye, en sağdaki en son maç.
// Sığmazsa yana kayar; flex-row-reverse sayesinde kaydırma en sağdan (en yeni maçtan) başlar, JS gerekmez.
import Link from "next/link";
import { TeamLogo } from "@/components/entity-image";
import type { EvidenceRow } from "@/lib/analysis";
import { cn } from "@/lib/utils";

export function MatchStrip({ evidence }: { evidence: EvidenceRow[] }) {
  const hits = evidence.filter((e) => e.outcome === true).length;
  const total = evidence.filter((e) => e.outcome !== null).length;

  return (
    <div
      className="flex flex-row-reverse gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]"
      role="img"
      aria-label={`${total} maçın ${hits} tanesinde gerçekleşti`}
    >
      {/* evidence en yeniden eskiye gelir; row-reverse ile en yeni en sağda */}
      {evidence.map((e) => (
        <Link
          key={e.matchId}
          href={`/matches/${e.matchId}`}
          title={e.label}
          className={cn(
            "flex w-10 shrink-0 flex-col items-center gap-0.5 rounded-md px-0.5 py-1 ring-1 ring-inset transition-opacity hover:opacity-80",
            e.outcome === null
              ? "bg-unknown/30 ring-unknown/50"
              : e.outcome
                ? "bg-hit-block/25 ring-hit-block/60"
                : "bg-miss-block/25 ring-miss-block/60",
          )}
        >
          {e.opponentId !== undefined ? (
            <TeamLogo id={e.opponentId} name={e.opponentName ?? ""} size={18} />
          ) : (
            <span className="size-4.5" />
          )}
          <span className="text-[11px] font-semibold leading-none tabular-nums">{e.score ?? "–"}</span>
        </Link>
      ))}
    </div>
  );
}
