// Maç kutucukları: oyuncunun her ilk 11 maçında yaptığı sayı, rakip ve oynadığı dakika. Trend sayfasındaki maç şeridiyle
// aynı dil: SOLDAN SAĞA YENİDEN ESKİYE (en soldaki, sarı noktalı kutucuk en son maç); sığmazsa yana kayar.
// line verilirse kutucuk o sayıya ulaştıysa nane yeşili, ulaşamadıysa pembe; verilmezse renksiz.
import Link from "next/link";
import { TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

export interface GameChip {
  matchId: number;
  value: number;
  minutes: number;
  opponentId: number;
  opponentName: string;
  label: string; // üzerine gelince: tarih, saha, rakip, skor
}

export function GameChips({ items, line }: { items: GameChip[]; line?: number }) {
  const hits = line === undefined ? 0 : items.filter((c) => c.value >= line).length;
  return (
    <div
      className="pop-scroll flex gap-1 overflow-x-auto pb-2 pl-0.5 pr-1.5 pt-2"
      role="img"
      aria-label={line === undefined ? `${items.length} maç` : `${items.length} maçın ${hits} tanesinde gerçekleşti`}
    >
      {/* items en yeniden eskiye gelir */}
      {items.map((c, i) => (
        <Link
          key={c.matchId}
          href={`/matches/${c.matchId}`}
          title={`${c.label} · ${c.minutes}'`}
          className={cn(
            "relative flex min-w-[42px] max-w-16 flex-1 basis-0 flex-col items-center gap-1 rounded-xl border-2 border-foreground px-0.5 pb-1.5 pt-2 transition-transform hover:-translate-y-1 hover:-rotate-3",
            line === undefined ? "bg-white" : c.value >= line ? "bg-[#b9f5df]" : "bg-[#ffc2dc]",
          )}
        >
          <TeamLogo id={c.opponentId} name={c.opponentName} size={24} />
          <span className={cn("poster text-2xl leading-none tabular-nums", c.value === 0 && "opacity-40")}>{c.value}</span>
          <span className="text-[11px] font-semibold leading-none tabular-nums opacity-60">{c.minutes}&apos;</span>
          {i === 0 && <span className="absolute -right-1 -top-1.5 size-3 rounded-full border-2 border-foreground bg-[var(--yellow)]" />}
        </Link>
      ))}
    </div>
  );
}
