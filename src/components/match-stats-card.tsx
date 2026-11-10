"use client";
// Maç detayı: biten maçın takım istatistikleri (Sofascore tarzı karşılaştırma çubukları).
// Veri: team_match_stats (FULL / H1 / H2). Üstteki sekmelerle Maç / 1. Yarı / 2. Yarı arasında geçilir.
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TeamStatLine {
  period: string; // FULL | H1 | H2
  teamId: number;
  corners: number | null;
  yellowCards: number | null;
  redCards: number | null;
  shotsTotal: number | null;
  shotsOnTarget: number | null;
  fouls: number | null;
  offsides: number | null;
}

type StatKey = "shotsTotal" | "shotsOnTarget" | "corners" | "fouls" | "offsides" | "yellowCards" | "redCards";

const ROWS: { key: StatKey; label: string }[] = [
  { key: "shotsTotal", label: "Şut" },
  { key: "shotsOnTarget", label: "İsabetli şut" },
  { key: "corners", label: "Korner" },
  { key: "fouls", label: "Faul" },
  { key: "offsides", label: "Ofsayt" },
  { key: "yellowCards", label: "Sarı kart" },
  { key: "redCards", label: "Kırmızı kart" },
];

interface MatchStatsCardProps {
  stats: TeamStatLine[];
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
}

const PERIODS = [
  { key: "FULL", label: "Maç" },
  { key: "H1", label: "1. Yarı" },
  { key: "H2", label: "2. Yarı" },
] as const;

export function MatchStatsCard({ stats, homeId, awayId, homeName, awayName }: MatchStatsCardProps) {
  const [period, setPeriod] = useState<string>("FULL");
  const row = (p: string, teamId: number) => stats.find((s) => s.period === p && s.teamId === teamId);
  if (!row("FULL", homeId) || !row("FULL", awayId)) return null;

  // Yarı verisi yoksa sekmeler gösterilmez
  const available = PERIODS.filter((p) => row(p.key, homeId) && row(p.key, awayId));
  const home = row(period, homeId)!;
  const away = row(period, awayId)!;

  // Kırmızı kart bilgisi yoksa (B5) 0 sayılır; diğer istatistiklerde null "veri yok"
  const value = (s: TeamStatLine, key: StatKey) => (key === "redCards" ? (s.redCards ?? 0) : (s[key] ?? null));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-xl">Maç istatistikleri</CardTitle>
        {available.length > 1 && (
          <div role="tablist" className="flex rounded-lg bg-secondary p-1">
            {available.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={period === p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  period === p.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-home-text">{homeName}</span>
          <span className="text-away-text">{awayName}</span>
        </div>
        {ROWS.map(({ key, label }) => (
          <StatBar key={key} label={label} home={value(home, key)} away={value(away, key)} />
        ))}
      </CardContent>
    </Card>
  );
}

// Ortada etiket, iki yanda değerler; altında iki takımın payını gösteren çubuk. Büyük olan vurgulanır.
function StatBar({ label, home, away }: { label: string; home: number | null; away: number | null }) {
  const known = home !== null && away !== null;
  const total = known ? home + away : 0;
  const homeShare = known && total > 0 ? (home / total) * 100 : 50;

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[3rem_1fr_3rem] items-baseline text-sm">
        <span className={cn("font-bold tabular-nums", known && home > away && "text-home-text")}>{home ?? "–"}</span>
        <span className="text-center text-muted-foreground">{label}</span>
        <span className={cn("text-right font-bold tabular-nums", known && away > home && "text-away-text")}>
          {away ?? "–"}
        </span>
      </div>
      <div className="flex h-1.5 gap-1" aria-hidden="true">
        <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-home" style={{ width: known && total > 0 ? `${homeShare}%` : "0%" }} />
        </div>
        <div className="flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-away" style={{ width: known && total > 0 ? `${100 - homeShare}%` : "0%" }} />
        </div>
      </div>
    </div>
  );
}
