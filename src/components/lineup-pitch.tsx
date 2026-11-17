// Maç detayı: iki takımın ilk 11'i sahada mevki mevki, altında yedekler ve maç öncesi eksikler.
// Başlıktaki etiket kadronun kaynağını söyler: kesin ilk 11, tahmini ilk 11 ya da son maçın ilk 11'i.
import Link from "next/link";
import type { LineupPlayer, LineupSource, TeamLineup } from "@/lib/lineup";
import { pitchRows } from "@/lib/engine/lineup-pick";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

export const SOURCE_LABEL: Record<Exclude<LineupSource, "NONE">, { text: string; className: string }> = {
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

// "Kylian Mbappé" → "Mbappé", "Virgil van Dijk" → "van Dijk"
function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length <= 1) return name;
  const particles = new Set(["van", "von", "de", "da", "di", "del", "der", "den", "dos", "le", "la", "el", "al", "bin", "ter", "ten"]);
  let start = words.length - 1;
  while (start > 1 && particles.has(words[start - 1].toLocaleLowerCase("tr"))) start--;
  return words.slice(start).join(" ");
}

function PitchPlayer({ p }: { p: LineupPlayer }) {
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
    </Link>
  );
}

function TeamPitch({ team, lineup }: { team: { id: number; name: string }; lineup: TeamLineup }) {
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
      {/* Saha: hücum üstte, kaleci altta */}
      <div className="relative overflow-hidden rounded-2xl border-[2.5px] border-foreground bg-[#7ddcb4] shadow-[5px_5px_0_var(--ink)]">
        {/* Çim şeritleri ve çizgiler */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgb(255_255_255/0.14)_0_12.5%,transparent_12.5%_25%)]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 border-t-[3px] border-white/80" aria-hidden="true" />
        <div className="absolute left-1/2 top-0 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/80" aria-hidden="true" />
        <div className="absolute bottom-0 left-1/2 h-20 w-[58%] -translate-x-1/2 border-[3px] border-b-0 border-white/80" aria-hidden="true" />
        <div className="absolute bottom-0 left-1/2 h-9 w-[28%] -translate-x-1/2 border-[3px] border-b-0 border-white/80" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 px-1 pb-4 pt-5 sm:gap-5 sm:px-3">
          {[rows.attack, rows.midfield, rows.defence, rows.keeper].map(
            (row, i) =>
              row.length > 0 && (
                <div key={i} className="flex items-start justify-evenly gap-1">
                  {row.map((p) => (
                    <PitchPlayer key={p.id} p={p} />
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
            {lineup.bench.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/players/${p.id}`}
                  title={p.injury ?? undefined}
                  className="flex items-center gap-1.5 rounded-full border-2 border-foreground bg-white py-0.5 pl-0.5 pr-2.5 text-sm font-semibold transition-colors hover:bg-[var(--yellow)]"
                >
                  <PlayerPhoto id={p.id} name={p.name} size={26} />
                  {shortName(p.name)}
                  {p.position && POSITIONS[p.position] && <span className="text-[10px] font-bold text-muted-foreground">{POSITIONS[p.position]}</span>}
                </Link>
              </li>
            ))}
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

interface LineupPitchProps {
  home: { id: number; name: string };
  away: { id: number; name: string };
  squads: { home: TeamLineup; away: TeamLineup };
}

export function LineupPitch({ home, away, squads }: LineupPitchProps) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Kadrolar</CardTitle>
        <p className="text-muted-foreground">İlk 11 sahada mevkisine göre dizili; oyuncuya tıklayınca sayfası açılır.</p>
      </CardHeader>
      <CardContent>
        <div className="grid items-start gap-8 xl:grid-cols-2">
          <TeamPitch team={home} lineup={squads.home} />
          <TeamPitch team={away} lineup={squads.away} />
        </div>
      </CardContent>
    </Card>
  );
}
