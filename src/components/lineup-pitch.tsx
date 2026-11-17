// Maç detayı: iki takımın ilk 11'i sahada mevki mevki, altında yedekler ve maç öncesi eksikler.
// Başlıktaki etiket kadronun kaynağını söyler: kesin ilk 11, tahmini ilk 11 ya da son maçın ilk 11'i.
// Her oyuncunun altında seçilen istatistikte son 5/10 maçı kutucuk kutucuk (en soldaki en son maç):
// eşiğe ulaştıysa yeşil, ulaşamadıysa kırmızı, veri yoksa gri. İstatistik ve eşik takım başına seçilir.
"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { LineupPlayer, LineupSource, TeamLineup } from "@/lib/lineup";
import type { BoardPlayer } from "@/lib/player-board";
import { pitchRows } from "@/lib/engine/lineup-pick";
import { BOARD_STATS, boardRow, type BoardFilter, type BoardRow, type BoardStat } from "@/lib/engine/player-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<Exclude<LineupSource, "NONE">, { text: string; className: string }> = {
  CONFIRMED: { text: "Kesin ilk 11", className: "bg-[#b9f5df]" },
  PREDICTED: { text: "Tahmini ilk 11", className: "bg-[var(--yellow)]" },
  PREVIOUS: { text: "Son maçın ilk 11'i", className: "bg-[#cfe0ff]" },
  ESTIMATED: { text: "Tahmini ilk 11", className: "bg-[var(--yellow)]" },
  SQUAD: { text: "Tahmini ilk 11", className: "bg-[var(--yellow)]" },
};

function sourceNote(l: TeamLineup): string | null {
  if (l.source === "PREDICTED") return "Maç öncesi tahmini kadro; kadro açıklanınca kesin ilk 11 ile güncellenir.";
  if (l.source === "PREVIOUS") return `Kadro henüz açıklanmadı; takımın bir önceki maçındaki ilk 11 gösteriliyor: ${l.previousMatch}.`;
  if (l.source === "ESTIMATED") return `Kadro henüz açıklanmadı; takımın son ${l.basedOn} maçında en sık ilk 11 başlayan oyunculardan oluşturuldu.`;
  if (l.source === "SQUAD") return "Bu takımın maç verisi olmadığı için kadro listesinden oluşturuldu.";
  return null;
}

const POSITIONS: Record<string, string> = { G: "KL", D: "DF", M: "OS", F: "FV" };
const formatDate = (t: number) => new Date(t).toLocaleDateString("tr-TR", { timeZone: TZ, day: "numeric", month: "short", year: "2-digit" });

// "Kylian Mbappé" → "Mbappé", "Virgil van Dijk" → "van Dijk"
function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length <= 1) return name;
  const particles = new Set(["van", "von", "de", "da", "di", "del", "der", "den", "dos", "le", "la", "el", "al", "bin", "ter", "ten"]);
  let start = words.length - 1;
  while (start > 1 && particles.has(words[start - 1].toLocaleLowerCase("tr"))) start--;
  return words.slice(start).join(" ");
}

const cellColor = (hit: boolean | null) =>
  hit === null ? "bg-secondary text-muted-foreground" : hit ? "bg-[var(--hit-block)] text-white" : "bg-[var(--miss-block)] text-white";

// Oyuncunun son maçları: 5'erli satırlar, en soldaki en son maç
function Squares({ row, size }: { row: BoardRow; size: number }) {
  if (!row.cells.length) return <span className="mt-1 text-[10px] font-bold text-foreground/60">veri yok</span>;
  return (
    <span className="mt-1 grid grid-cols-5 gap-0.5 rounded-md border-[1.5px] border-foreground bg-white p-0.5">
      {row.cells.map((c) => (
        <span
          key={c.game.matchId}
          title={`${formatDate(c.game.date)} · ${c.game.opponentName} ${c.game.score} · ${c.game.minutes} dk${c.game.started ? "" : " (yedekten)"}`}
          className={cn("flex size-[13px] items-center justify-center rounded-[3px] text-[8px] font-black leading-none tabular-nums sm:size-4 sm:text-[10px]", cellColor(c.hit))}
        >
          {c.value ?? "–"}
        </span>
      ))}
      {/* Seçilen sayıdan az maçı varsa boş yerler */}
      {Array.from({ length: Math.max(0, size - row.cells.length) }, (_, i) => (
        <span key={`empty-${i}`} aria-hidden="true" className="size-[13px] rounded-[3px] border border-dashed border-foreground/25 sm:size-4" />
      ))}
    </span>
  );
}

function PitchPlayer({ p, row, size }: { p: LineupPlayer; row: BoardRow | null; size: number }) {
  return (
    <Link href={`/players/${p.id}`} title={p.injury ? `${p.name} · ${p.injury}` : p.name} className="group flex w-[4.6rem] flex-col items-center sm:w-24">
      <span className="relative">
        <span className="photocard overflow-hidden border-2 shadow-[2px_2px_0_var(--ink)] transition-transform group-hover:-translate-y-1 group-hover:-rotate-6">
          <PlayerPhoto id={p.id} name={p.name} size={52} className="size-11 sm:size-[52px]" />
        </span>
        {p.jerseyNumber !== null && (
          <span className="poster absolute -bottom-1 -left-2 flex h-5 min-w-5 items-center justify-center rounded-full border-[1.5px] border-foreground bg-[var(--yellow)] px-1 text-xs leading-none">
            {p.jerseyNumber}
          </span>
        )}
        {p.injury && (
          <span className="absolute -right-1.5 -top-1 flex size-4 items-center justify-center rounded-full border-[1.5px] border-foreground bg-[var(--miss-block)] text-[10px] font-black leading-none text-white">
            !
          </span>
        )}
      </span>
      <span className="mt-1 max-w-full truncate rounded-full border-[1.5px] border-foreground bg-white px-1.5 text-[11px] font-bold leading-snug sm:text-xs">
        {shortName(p.name)}
      </span>
      {row && <Squares row={row} size={size} />}
    </Link>
  );
}

interface Shared {
  size: number;
  startsOnly: boolean;
  nationalOnly: boolean;
}

function TeamPitch({
  team, lineup, board, shared,
}: {
  team: { id: number; name: string };
  lineup: TeamLineup;
  board: Map<number, BoardPlayer>;
  shared: Shared;
}) {
  const [stat, setStat] = useState<BoardStat>("shotsTotal");
  const [line, setLine] = useState(1);
  const hasData = board.size > 0;
  const rowOf = (id: number): BoardRow | null => {
    const p = board.get(id);
    if (!p) return null;
    const filter: BoardFilter = { stat, line, size: shared.size, venue: "all", nationalOnly: shared.nationalOnly, startsOnly: shared.startsOnly };
    return boardRow(p.games, filter);
  };

  const header = (
    <div className="flex flex-wrap items-center gap-2.5">
      <TeamLogo id={team.id} name={team.name} size={32} />
      <Link href={`/teams/${team.id}`} className="poster text-2xl leading-none hover:underline">
        {team.name}
      </Link>
      {lineup.source !== "NONE" && (
        <span className={cn("rounded-full border-2 border-foreground px-2.5 py-0.5 text-xs font-bold", SOURCE_LABEL[lineup.source].className)}>
          {SOURCE_LABEL[lineup.source].text}
        </span>
      )}
    </div>
  );

  if (lineup.source === "NONE") {
    return (
      <div className="space-y-3">
        {header}
        <p className="rounded-2xl border-2 border-dashed border-foreground/40 bg-secondary/60 px-4 py-8 text-center font-medium text-muted-foreground">
          Bu maç için henüz kadro verisi yok.
        </p>
      </div>
    );
  }

  const rows = pitchRows(lineup.starters);
  const note = sourceNote(lineup);
  return (
    <div className="space-y-3">
      {header}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {lineup.replaced.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Tahmin düzeltildi:{" "}
          {lineup.replaced.map((r, i) => (
            <span key={r.out}>
              {i > 0 && ", "}
              <span className="line-through">{r.out}</span> ({r.reason.toLocaleLowerCase("tr")}) yerine <b className="text-foreground">{r.in}</b>
            </span>
          ))}
          .
        </p>
      )}

      {/* Bu takım için istatistik ve eşik */}
      {hasData && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`${team.name}: istatistik`}
            value={stat}
            onChange={(e) => {
              const key = e.target.value as BoardStat;
              setStat(key);
              setLine(BOARD_STATS.find((s) => s.key === key)!.line);
            }}
            className="rounded-full border-2 border-foreground bg-white px-3 py-1 text-sm font-bold shadow-[3px_3px_0_var(--ink)]"
          >
            {BOARD_STATS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="flex items-center rounded-full border-2 border-foreground bg-white p-0.5 shadow-[3px_3px_0_var(--ink)]" aria-label="Eşik">
            <button type="button" onClick={() => setLine((l) => Math.max(1, l - 1))} aria-label="Eşiği azalt" className="rounded-full p-1 hover:bg-secondary">
              <Minus className="size-3.5" />
            </button>
            <span className="poster min-w-10 text-center tabular-nums">{line}+</span>
            <button type="button" onClick={() => setLine((l) => l + 1)} aria-label="Eşiği artır" className="rounded-full p-1 hover:bg-secondary">
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Saha: hücum üstte, kaleci altta */}
      <div className="relative overflow-hidden rounded-2xl border-[2.5px] border-foreground bg-[#7ddcb4] shadow-[5px_5px_0_var(--ink)]">
        {/* Çim şeritleri ve çizgiler */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgb(255_255_255/0.14)_0_12.5%,transparent_12.5%_25%)]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 border-t-[3px] border-white/80" aria-hidden="true" />
        <div className="absolute left-1/2 top-0 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/80" aria-hidden="true" />
        <div className="absolute bottom-0 left-1/2 h-20 w-[58%] -translate-x-1/2 border-[3px] border-b-0 border-white/80" aria-hidden="true" />
        <div className="absolute bottom-0 left-1/2 h-9 w-[28%] -translate-x-1/2 border-[3px] border-b-0 border-white/80" aria-hidden="true" />
        {/* Dar ekranda 5 kişilik hat sığmazsa saha kendi içinde yana kayar */}
        <div className="relative flex flex-col gap-4 overflow-x-auto px-1 pb-4 pt-5 sm:gap-5 sm:px-3">
          {[rows.attack, rows.midfield, rows.defence, rows.keeper].map(
            (row, i) =>
              row.length > 0 && (
                <div key={i} className="flex min-w-max items-start justify-evenly gap-1">
                  {row.map((p) => (
                    <PitchPlayer key={p.id} p={p} row={rowOf(p.id)} size={shared.size} />
                  ))}
                </div>
              ),
          )}
        </div>
      </div>

      {lineup.bench.length > 0 && (
        <div>
          <h4 className="poster mb-2 text-base">Yedekler</h4>
          <ul className="flex flex-wrap gap-1.5">
            {lineup.bench.map((p) => {
              const r = rowOf(p.id);
              return (
                <li key={p.id}>
                  <Link
                    href={`/players/${p.id}`}
                    title={p.injury ?? undefined}
                    className="flex items-center gap-1.5 rounded-full border-2 border-foreground bg-white py-0.5 pl-0.5 pr-2.5 text-sm font-semibold transition-colors hover:bg-[var(--yellow)]"
                  >
                    <PlayerPhoto id={p.id} name={p.name} size={26} />
                    {shortName(p.name)}
                    {p.position && POSITIONS[p.position] && <span className="text-[10px] font-bold text-muted-foreground">{POSITIONS[p.position]}</span>}
                    {r && r.total > 0 && (
                      <span title={`Son ${r.cells.length} maçta eşiğe ulaştığı maç`} className="rounded-full bg-secondary px-1.5 text-[11px] font-bold tabular-nums">
                        {r.hits}/{r.total}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {lineup.missing.length > 0 && (
        <div>
          <h4 className="poster mb-2 text-base">Eksikler</h4>
          <ul className="flex flex-wrap gap-1.5">
            {lineup.missing.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/players/${p.id}`}
                  className="flex items-center gap-1.5 rounded-full border-2 border-foreground bg-[#ffd6d6] py-0.5 pl-0.5 pr-2.5 text-sm font-semibold transition-colors hover:bg-[var(--yellow)]"
                >
                  <PlayerPhoto id={p.id} name={p.name} size={26} />
                  {shortName(p.name)}
                  <span className="text-[11px] font-bold text-muted-foreground">{p.reason}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
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

interface LineupPitchProps {
  home: { id: number; name: string };
  away: { id: number; name: string };
  squads: { home: TeamLineup; away: TeamLineup };
  board: BoardPlayer[]; // oyuncuların son maçları (oyuncu verisi olmayan turnuvada boş)
  national: boolean; // milli maç: "yalnızca milli takım" seçimi görünür ve açık başlar
}

export function LineupPitch({ home, away, squads, board, national }: LineupPitchProps) {
  const [size, setSize] = useState(5);
  const [startsOnly, setStartsOnly] = useState(false);
  const [nationalOnly, setNationalOnly] = useState(national);
  const byId = new Map(board.map((p) => [p.id, p]));
  const shared: Shared = { size, startsOnly, nationalOnly };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-xl">Kadrolar</CardTitle>
        <p className="text-muted-foreground">
          İlk 11 sahada mevkisine göre dizili. Her takım için istatistik ve eşik seç; oyuncunun altındaki kutucuklar o istatistikte son
          maçlarını gösterir (en soldaki en son maç): eşiğe ulaştıysa yeşil, ulaşamadıysa kırmızı.
        </p>
        {board.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Maç sayısı" className="flex w-fit rounded-full border-2 border-foreground bg-white p-1 text-sm shadow-[3px_3px_0_var(--ink)]">
              {[5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={size === n}
                  onClick={() => setSize(n)}
                  className={cn("rounded-full px-3 py-0.5 font-bold", size === n ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground")}
                >
                  Son {n}
                </button>
              ))}
            </div>
            <Check checked={startsOnly} onChange={setStartsOnly}>Yalnızca ilk 11</Check>
            {national && <Check checked={nationalOnly} onChange={setNationalOnly}>Yalnızca milli takım</Check>}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
          <TeamPitch team={home} lineup={squads.home} board={byId} shared={shared} />
          <TeamPitch team={away} lineup={squads.away} board={byId} shared={shared} />
        </div>
      </CardContent>
    </Card>
  );
}
