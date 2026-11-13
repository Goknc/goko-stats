// Maç kutucukları: her ilk 11 maçında yaptığı sayı, rakip ve oynadığı dakika.
// line verilirse kutucuk o çizgiyi geçtiyse nane yeşili, geçmediyse pembe (trend şeridiyle aynı dil); verilmezse renksiz.
// Soldan sağa eskiden yeniye, 10'lu satırlar; en son maç en sonda.
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
  // items en yeniden eskiye gelir
  const ordered = [...items].reverse();
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {ordered.map((c) => (
        <Link
          key={c.matchId}
          href={`/matches/${c.matchId}`}
          title={`${c.label} · ${c.minutes}'`}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl border-2 border-foreground px-1 py-2 transition-transform hover:-translate-y-1 hover:-rotate-3",
            line === undefined ? "bg-white" : c.value >= line ? "bg-[#b9f5df]" : "bg-[#ffc2dc]",
          )}
        >
          <span className={cn("poster text-2xl leading-none tabular-nums", c.value === 0 && "opacity-40")}>
            {c.value}
          </span>
          <TeamLogo id={c.opponentId} name={c.opponentName} size={24} />
          <span className="text-[11px] font-semibold leading-none tabular-nums opacity-60">{c.minutes}&apos;</span>
        </Link>
      ))}
    </div>
  );
}
