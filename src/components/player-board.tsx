// Maç detayı, oyuncu eşik tablosu: iki kadronun oyuncuları alt alta, seçilen istatistikte son N maçı kutucuk kutucuk.
// Kutucukta o maçtaki değer; eşiği geçtiyse yeşil, geçemediyse kırmızı, veri yoksa gri. En soldaki kutucuk en son maçtır.
// İstatistik, maç sayısı, eşik ve filtreler sayfa yenilenmeden değişir (hesap engine/player-board).
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { BOARD_SIZES, BOARD_STATS, boardRow, type BoardFilter, type BoardStat } from "@/lib/engine/player-board";
import type { BoardPlayer } from "@/lib/player-board";
import { PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";

const POSITIONS: Record<string, string> = { G: "KL", D: "DF", M: "OS", F: "FV" };
const formatDate = (t: number) => new Date(t).toLocaleDateString("tr-TR", { timeZone: TZ, day: "numeric", month: "short", year: "2-digit" });

function Pills<T extends string | number>({
  options, value, onChange, label,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-fit flex-wrap rounded-full border-2 border-foreground bg-white p-1 text-sm shadow-[3px_3px_0_var(--ink)]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1 font-bold transition-colors",
            value === o.key ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 rounded-full border-2 border-foreground bg-white px-3 py-1 text-sm font-bold shadow-[3px_3px_0_var(--ink)] has-[:checked]:bg-[var(--yellow)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--ink)]" />
      {children}
    </label>
  );
}

interface PlayerBoardProps {
  home: { id: number; name: string };
  away: { id: number; name: string };
  players: BoardPlayer[];
  national: boolean; // milli maç: "yalnızca milli takım" seçimi açık başlar
}

export function PlayerBoard({ home, away, players, national }: PlayerBoardProps) {
  const [stat, setStat] = useState<BoardStat>("shotsTotal");
  const [line, setLine] = useState(1);
  const [size, setSize] = useState<number>(10);
  const [venue, setVenue] = useState<BoardFilter["venue"]>("all");
  const [nationalOnly, setNationalOnly] = useState(national);
  const [startsOnly, setStartsOnly] = useState(false);
  const [side, setSide] = useState<"both" | "home" | "away">("both");
  const [withBench, setWithBench] = useState(false);

  const pickStat = (key: BoardStat) => {
    setStat(key);
    setLine(BOARD_STATS.find((s) => s.key === key)!.line);
  };

  const rows = useMemo(() => {
    const filter: BoardFilter = { stat, line, size, venue, nationalOnly, startsOnly };
    return players
      .filter((p) => (side === "both" || p.side === side) && (withBench || p.starter))
      .map((p) => ({ player: p, row: boardRow(p.games, filter) }))
      .sort(
        (a, b) =>
          (b.row.rate ?? -1) - (a.row.rate ?? -1) || b.row.total - a.row.total || a.player.name.localeCompare(b.player.name, "tr"),
      );
  }, [players, stat, line, size, venue, nationalOnly, startsOnly, side, withBench]);

  const statLabel = BOARD_STATS.find((s) => s.key === stat)!.label;
  const teamOf = (p: BoardPlayer) => (p.side === "home" ? home : away);

  return (
    <div className="space-y-5">
      {/* İstatistik */}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="İstatistik">
        {BOARD_STATS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={stat === s.key}
            onClick={() => pickStat(s.key)}
            className={cn(
              "rounded-full border-2 border-foreground px-3 py-0.5 text-sm font-bold transition-transform hover:-translate-y-0.5",
              stat === s.key ? "bg-foreground text-white" : "bg-white",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Maç sayısı, eşik, saha, takım ve seçimler */}
      <div className="flex flex-wrap items-center gap-3">
        <Pills label="Maç sayısı" options={BOARD_SIZES.map((n) => ({ key: n, label: `Son ${n}` }))} value={size} onChange={setSize} />
        <div className="flex items-center rounded-full border-2 border-foreground bg-white p-1 shadow-[3px_3px_0_var(--ink)]" aria-label="Eşik">
          <button type="button" onClick={() => setLine((l) => Math.max(1, l - 1))} aria-label="Eşiği azalt" className="rounded-full p-1 hover:bg-secondary">
            <Minus className="size-4" />
          </button>
          <span className="poster min-w-14 text-center text-lg tabular-nums">{line}+</span>
          <button type="button" onClick={() => setLine((l) => l + 1)} aria-label="Eşiği artır" className="rounded-full p-1 hover:bg-secondary">
            <Plus className="size-4" />
          </button>
        </div>
        <Pills
          label="Saha"
          options={[{ key: "all", label: "Tümü" }, { key: "home", label: "Evinde" }, { key: "away", label: "Deplasmanda" }] as const}
          value={venue}
          onChange={setVenue}
        />
        <Pills
          label="Takım"
          options={[{ key: "both", label: "İki takım" }, { key: "home", label: home.name }, { key: "away", label: away.name }] as const}
          value={side}
          onChange={setSide}
        />
        <Check checked={nationalOnly} onChange={setNationalOnly}>Yalnızca milli takım</Check>
        <Check checked={startsOnly} onChange={setStartsOnly}>Yalnızca ilk 11</Check>
        <Check checked={withBench} onChange={setWithBench}>Yedekler de</Check>
      </div>

      <p className="text-sm text-muted-foreground">
        Kutucukta oyuncunun o maçtaki {statLabel.toLocaleLowerCase("tr")} sayısı: {line}+ ise yeşil, değilse kırmızı. En soldaki en son maç;
        {nationalOnly ? " yalnızca milli takım maçları" : " kulüp ve milli takım maçları birlikte"}, süre aldığı maçlar sayılır. Gri kutucukta o maç için veri yok.
      </p>

      {/* Tablo: dar ekranda kutucuklar yana kayar */}
      <div className="overflow-x-auto rounded-2xl border-2 border-foreground bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-foreground bg-secondary/70 text-left">
              <th className="sticky left-0 z-10 bg-secondary px-3 py-2 font-bold">Oyuncu</th>
              <th className="px-2 py-2 font-bold">Son {size} maç</th>
              <th className="px-3 py-2 text-right font-bold">Tutan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player: p, row }) => (
              <tr key={p.id} className="border-b border-foreground/15 last:border-0">
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  <Link href={`/players/${p.id}`} className="flex min-w-40 items-center gap-2 hover:text-primary">
                    <span className="relative shrink-0">
                      <PlayerPhoto id={p.id} name={p.name} size={34} />
                      <span className="absolute -bottom-1 -right-1">
                        <TeamLogo id={teamOf(p).id} name={teamOf(p).name} size={16} />
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-44 truncate font-bold">{p.name}</span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {p.jerseyNumber !== null && `#${p.jerseyNumber} · `}
                        {(p.position && POSITIONS[p.position]) ?? "–"}
                        {!p.starter && " · yedek"}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-2">
                  <div className="flex gap-1">
                    {row.cells.map((c) => (
                      <span
                        key={c.game.matchId}
                        title={`${formatDate(c.game.date)} · ${c.game.isHome ? "ev" : "dep"} · ${c.game.opponentName} ${c.game.score} · ${c.game.minutes} dk${c.game.started ? "" : " (yedekten)"}${c.game.national ? " · milli" : ""}`}
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-foreground font-black tabular-nums",
                          c.hit === null ? "bg-secondary text-muted-foreground" : c.hit ? "bg-[var(--hit-block)] text-white" : "bg-[var(--miss-block)] text-white",
                          !c.game.started && "border-dashed",
                        )}
                      >
                        {c.value ?? "–"}
                      </span>
                    ))}
                    {Array.from({ length: Math.max(0, size - row.cells.length) }, (_, i) => (
                      <span key={`empty-${i}`} aria-hidden="true" className="size-8 shrink-0 rounded-lg border-2 border-dashed border-foreground/25" />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  {row.total === 0 ? (
                    <span className="text-muted-foreground">Veri yok</span>
                  ) : (
                    <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <span className="tabular-nums text-muted-foreground">
                        {row.hits}/{row.total}
                      </span>
                      <span
                        className={cn(
                          "poster rounded-lg border-2 border-foreground px-1.5 text-base tabular-nums",
                          row.rate! >= 0.7 ? "bg-[var(--hit-block)] text-white" : row.rate! >= 0.4 ? "bg-[var(--yellow)]" : "bg-white",
                        )}
                      >
                        %{Math.round(row.rate! * 100)}
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  Bu seçimde gösterilecek oyuncu yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Kesik çizgili kutucuk: oyuncu o maça yedekten girdi.</p>
    </div>
  );
}
