// Maç kutucukları: her ilk 11 maçında yaptığı sayı, rakip ve oynadığı dakika.
// Eşik yok, renk yok: yalnızca sayılar (0 soluk). Soldan sağa eskiden yeniye, 10'lu satırlar; en son maç en sonda.
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

export function GameChips({ items }: { items: GameChip[] }) {
  // items en yeniden eskiye gelir
  const ordered = [...items].reverse();
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {ordered.map((c) => (
        <Link
          key={c.matchId}
          href={`/matches/${c.matchId}`}
          title={`${c.label} · ${c.minutes}'`}
          className="flex flex-col items-center gap-1 rounded-lg bg-secondary/50 px-1 py-2 transition-colors hover:bg-secondary"
        >
          <span className={cn("text-xl font-extrabold leading-none tabular-nums", c.value === 0 && "text-muted-foreground/50")}>
            {c.value}
          </span>
          <TeamLogo id={c.opponentId} name={c.opponentName} size={18} />
          <span className="text-[11px] leading-none tabular-nums text-muted-foreground">{c.minutes}&apos;</span>
        </Link>
      ))}
    </div>
  );
}
