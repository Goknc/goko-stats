// Oyuncu sayfası: kariyer (takım takım toplamlar) ve transfer geçmişi (zaman çizelgesi).
import { ArrowRight } from "lucide-react";
import type { CareerRow, TransferRow } from "@/lib/player-page";
import { careerStints, formatEur, transferFee, type CareerStint } from "@/lib/engine/player-bio";
import { trTeam } from "@/lib/team-names";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

const num = (n: number) => n.toLocaleString("tr-TR");
const rating = (n: number | null) => (n === null ? "–" : n.toFixed(2).replace(".", ","));

function StintStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-xl border-2 border-foreground px-2 py-1.5 text-center", strong ? "bg-[var(--yellow)]" : "bg-white")}>
      <div className="poster text-2xl leading-none tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] font-bold text-muted-foreground">{label}</div>
    </div>
  );
}

function Stint({ s }: { s: CareerStint<CareerRow> }) {
  const years = s.fromYear === s.toYear ? String(s.toYear || "") : `${s.fromYear}–${s.toYear}`;
  return (
    <li className="rounded-2xl border-2 border-foreground bg-secondary/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="photocard size-14">
          <TeamLogo id={s.teamId} name={s.teamName} size={38} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="poster truncate text-2xl leading-none">{s.teamName}</span>
            {s.national && <span className="rounded-full border-2 border-foreground bg-[var(--lilac)] px-2 text-xs font-bold">Milli takım</span>}
          </div>
          <div className="mt-1 text-sm font-semibold text-muted-foreground">
            {s.seasons} sezon{years && ` · ${years}`}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <StintStat label="Maç" value={num(s.matches)} />
        <StintStat label="Gol" value={num(s.goals)} strong={s.goals > 0} />
        <StintStat label="Asist" value={num(s.assists)} strong={s.assists > 0} />
        <StintStat label="Dakika" value={num(s.minutes)} />
        <StintStat label="Ort. puan" value={rating(s.avgRating)} />
      </div>
      {s.rows.length > 1 && (
        <details className="group mt-2">
          <summary className="cursor-pointer text-sm font-bold text-muted-foreground hover:text-foreground">
            <span className="group-open:hidden">Sezon sezon göster ({s.rows.length})</span>
            <span className="hidden group-open:inline">Gizle</span>
          </summary>
          <div className="pop-scroll mt-2 overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-bold">Sezon</th>
                  <th className="py-1.5 pr-3 text-right font-bold">Maç</th>
                  <th className="py-1.5 pr-3 text-right font-bold">Dakika</th>
                  <th className="py-1.5 pr-3 text-right font-bold">Gol</th>
                  <th className="py-1.5 pr-3 text-right font-bold">Asist</th>
                  <th className="py-1.5 text-right font-bold">Puan</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={`${r.seasonId}-${r.teamId}`} className="border-t border-foreground/15">
                    <td className="max-w-64 truncate py-1.5 pr-3" title={r.seasonName ?? undefined}>
                      {r.seasonName ?? r.leagueName ?? "–"}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.matches}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{num(r.minutes)}</td>
                    <td className={cn("py-1.5 pr-3 text-right tabular-nums", r.goals ? "font-bold" : "text-muted-foreground/50")}>{r.goals}</td>
                    <td className={cn("py-1.5 pr-3 text-right tabular-nums", r.assists ? "font-bold" : "text-muted-foreground/50")}>{r.assists}</td>
                    <td className="py-1.5 text-right tabular-nums">{rating(r.avgRating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </li>
  );
}

export function CareerCard({ rows, nationalTeamId, className }: { rows: CareerRow[]; nationalTeamId: number | null; className?: string }) {
  const stints = careerStints(
    rows.map((r) => ({ ...r, teamName: trTeam(r.teamName) })),
    nationalTeamId,
  );
  const clubs = stints.filter((s) => !s.national);
  const sum = (key: "matches" | "goals" | "assists") => clubs.reduce((n, s) => n + s[key], 0);
  return (
    <Card className={className}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Kariyer</CardTitle>
        <p className="text-sm text-muted-foreground">
          Oynadığı her takımdaki toplamları. Kulüp kariyeri: {num(sum("matches"))} maç, {num(sum("goals"))} gol, {num(sum("assists"))} asist.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="pop-scroll max-h-[38rem] space-y-3 overflow-y-auto pr-2">
          {stints.map((s) => (
            <Stint key={s.teamId} s={s} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function TransfersCard({ transfers }: { transfers: TransferRow[] }) {
  const total = transfers.reduce((n, t) => n + (t.transferType === 3 || t.transferType === null ? (t.feeEur ?? 0) : 0), 0);
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Transferler</CardTitle>
        <p className="text-sm text-muted-foreground">
          {transfers.length} hareket{total > 0 && ` · toplam bonservis ${formatEur(total)}`}
        </p>
      </CardHeader>
      <CardContent>
        {/* Zaman çizelgesi: solda dikey çizgi, her transfer bir durak */}
        <ol className="pop-scroll relative max-h-[38rem] space-y-4 overflow-y-auto pb-1 pl-6 pr-2 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-0.5 before:bg-foreground/25">
          {transfers.map((t) => {
            const fee = transferFee(t.transferType, t.feeEur, t.feeDescription);
            return (
              <li key={t.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-6 top-1.5 size-4 rounded-full border-2 border-foreground",
                    fee.kind === "paid" ? "bg-[var(--yellow)]" : fee.kind === "loan" ? "bg-[var(--lilac)]" : "bg-white",
                  )}
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">
                    {t.date.toLocaleDateString("tr-TR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border-2 border-foreground px-2.5 py-0.5 text-xs font-bold",
                      fee.kind === "paid" ? "bg-[var(--yellow)] shadow-[2px_2px_0_var(--ink)]" : fee.kind === "loan" ? "bg-[var(--lilac)]" : "bg-white",
                    )}
                  >
                    {fee.text}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {t.fromTeamId !== null && <TeamLogo id={t.fromTeamId} name={t.fromTeamName ?? ""} size={22} />}
                    {trTeam(t.fromTeamName) ?? "–"}
                  </span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex items-center gap-1.5">
                    {t.toTeamId !== null && <TeamLogo id={t.toTeamId} name={t.toTeamName ?? ""} size={22} />}
                    {trTeam(t.toTeamName) ?? "–"}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
