// Maç maç döküm tablosu: satırlar maçlar, sütunlar trendler. Bütün trendler aynı örnekten geldiği için satır sırası ortak.
// (Maç detayı sayfasından buraya taşındı; takım ve oyuncu bölümleri birlikte kullanıyor.)
// Maç sütunu yalnızca "Ev 4-1 Deplasman" gösterir, tek satırda; ayrıntılı etiket fareyle üzerine gelince görünür.
// Tarih + maç sütunları yatay kaydırmada sabit kalır.
import type { EvidenceRow } from "@/lib/analysis";
import { TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";

const formatShortDate = (d: Date) => d.toLocaleDateString("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" });

// "Ev 4-1 Dep (İY 1-1) · 8 korner" / "Ev 4-1 Dep · 1G 0A ..." → { home, score, away }
function parseMatch(label: string) {
  const base = label.split(" (İY")[0].split(" · ")[0];
  const m = base.match(/^(.*) (\d+-\d+) (.*)$/);
  return m ? { home: m[1], score: m[2], away: m[3] } : { home: base, score: null, away: "" };
}

function Mark({ outcome }: { outcome: boolean | null }) {
  if (outcome === null) return <span title="Bu maçta veri yok" className="text-muted-foreground/60">–</span>;
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md text-xs font-black text-white",
        outcome ? "bg-hit-block" : "bg-miss-block",
      )}
    >
      {outcome ? "✓" : "✗"}
    </span>
  );
}

export function EvidenceTable({ columns }: { columns: { name: string; evidence: EvidenceRow[] }[] }) {
  const rows = columns[0]?.evidence ?? [];
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Bu seçimde maç yok.</p>;
  const sticky = "sticky left-0 z-10 bg-card";

  return (
    <div className="pop-scroll overflow-x-auto rounded-xl border-2 border-foreground bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-secondary text-foreground">
            <th className={cn(sticky, "bg-secondary px-3 py-2 text-left font-bold")}>Maç</th>
            {columns.map((c) => (
              <th key={c.name} className="whitespace-nowrap px-2 py-2 text-center text-xs font-bold">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const { home, score, away } = parseMatch(row.label);
            return (
              <tr key={row.matchId} className="group border-t border-border">
                <td className={cn(sticky, "whitespace-nowrap px-3 py-2 group-hover:bg-secondary")} title={row.label}>
                  <span className="mr-3 text-xs tabular-nums text-muted-foreground">{formatShortDate(row.eventDate)}</span>
                  <span>{home}</span>
                  {score && <span className="mx-1.5 font-bold tabular-nums">{score}</span>}
                  <span>{away}</span>
                </td>
                {columns.map((c) => (
                  <td key={c.name} className="px-2 py-2 text-center group-hover:bg-secondary/50">
                    <Mark outcome={c.evidence[i]?.outcome ?? null} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
