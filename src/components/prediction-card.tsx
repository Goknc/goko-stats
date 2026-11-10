// Maç detayı: skor tahmini (eğitilmiş model, yetersiz veride Poisson). Ondalıklı beklenen gol gösterilmez; tam sayı skor ve yüzdeler.
import type { MatchPrediction } from "@/lib/prediction";
import type { Tier, TierRecord } from "@/lib/engine/ratings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const pct = (x: number) => `%${Math.round(x * 100)}`;
const width = (x: number) => `${x * 100}%`;

const TIER_LABEL: Record<Tier, string> = { top: "üst", mid: "orta", bottom: "alt" };

interface PredictionCardProps {
  p: MatchPrediction;
  homeName: string;
  awayName: string;
  actual?: { home: number; away: number } | null; // maç bittiyse gerçek skor
}

export function PredictionCard({ p, homeName, awayName, actual }: PredictionCardProps) {
  const { prediction: pr } = p;
  const hit = actual && actual.home === pr.mostLikely.home && actual.away === pr.mostLikely.away;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Skor tahmini</CardTitle>
        {p.source === "trained" ? (
          <p className="text-sm text-muted-foreground">
            Eğitilmiş model · geçmiş 25 bin maçtan öğrenildi: güç farkı (Elo), benzer güçteki rakiplere karşı gol, son dönem gol ve şut
            ortalamaları, sahaya göre form, dinlenme, aralarındaki maçlar. Tek skor tahmini doğası gereği %10–13 civarında kalır;
            asıl bilgi sonuç ve gol olasılıklarında.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Poisson modeli · rakip gücüne göre düzeltilmiş · {homeName} son {p.home.games}, {awayName} son {p.away.games} lig maçı
            (iç saha + deplasman){p.h2h.games > 0 ? ` · aralarındaki ${p.h2h.games} maç` : ""}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {p.lowSample && (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
            Az veri: takımlardan birinin yeterli maçı yok, tahmin büyük ölçüde lig ortalamasına dayanıyor.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          {/* En olası skor */}
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">En olası skor</div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-extrabold tabular-nums text-foreground">
                {pr.mostLikely.home}-{pr.mostLikely.away}
              </span>
              <span className="text-sm text-muted-foreground">{pct(pr.mostLikely.p)}</span>
            </div>
            {actual && (
              <div className={hit ? "text-sm font-semibold text-hit" : "text-sm text-muted-foreground"}>
                Gerçek skor {actual.home}-{actual.away}
                {hit ? " ✓" : ""}
              </div>
            )}
          </div>

          {/* Diğer olası skorlar */}
          <div className="flex gap-2">
            {pr.topScores.slice(1).map((s) => (
              <div key={`${s.home}-${s.away}`} className="rounded-lg bg-secondary/60 px-3 py-1.5 text-center">
                <div className="font-bold tabular-nums">
                  {s.home}-{s.away}
                </div>
                <div className="text-xs text-muted-foreground">{pct(s.p)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sonuç olasılıkları */}
        <div className="space-y-1.5">
          <div className="flex h-7 overflow-hidden rounded-md text-xs font-bold">
            <div className="flex items-center justify-center bg-home text-white" style={{ width: width(pr.homeWin) }}>
              {pr.homeWin >= 0.12 && pct(pr.homeWin)}
            </div>
            <div className="flex items-center justify-center bg-muted-foreground/40" style={{ width: width(pr.draw) }}>
              {pr.draw >= 0.12 && pct(pr.draw)}
            </div>
            <div className="flex items-center justify-center bg-away text-white" style={{ width: width(pr.awayWin) }}>
              {pr.awayWin >= 0.12 && pct(pr.awayWin)}
            </div>
          </div>
          <div className="grid grid-cols-3 text-xs text-muted-foreground">
            <span className="truncate">{homeName}</span>
            <span className="text-center">Beraberlik</span>
            <span className="truncate text-right">{awayName}</span>
          </div>
        </div>

        {/* Gol olasılıkları */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Prob label="3+ gol" value={pr.over25} />
          <Prob label="En fazla 2 gol" value={1 - pr.over25} />
          <Prob label="İki takım da gol atar" value={pr.btts} />
          <Prob label="En az biri gol atamaz" value={1 - pr.btts} />
        </div>

        {/* Benzer rakiplere karşı */}
        {p.tiers.home && p.tiers.away && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Benzer rakiplere karşı</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <TierLine team={homeName} rec={p.tiers.homeVsAwayTier} opponent={awayName} />
              <TierLine team={awayName} rec={p.tiers.awayVsHomeTier} opponent={homeName} />
            </div>
            <p className="text-xs text-muted-foreground">
              Takımlar güce göre üçe bölündü; {homeName} {TIER_LABEL[p.tiers.home]}, {awayName} {TIER_LABEL[p.tiers.away]} grupta.
              Bu karne bilgi amaçlı; model rakip gücünü her maçta ayrıca hesaba katıyor.
            </p>
          </div>
        )}

        {/* Aralarındaki maçların etkisi (yalnızca Poisson modelinde; eğitilmiş model bunu kendi özelliği olarak kullanır) */}
        {p.source === "poisson" && p.h2h.games > 0 && (
          <p className="text-sm text-muted-foreground">
            Aralarındaki maçların etkisi: {homeName} gol beklentisi {effect(p.h2h.home)}, {awayName} {effect(p.h2h.away)}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function effect(k: number): string {
  const d = Math.round((k - 1) * 100);
  return d === 0 ? "değişmedi" : d > 0 ? `%${d} arttı` : `%${-d} azaldı`;
}

function TierLine({ team, rec, opponent }: { team: string; rec: TierRecord; opponent: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
      <div className="text-xs text-muted-foreground">
        {team} · {TIER_LABEL[rec.tier]} gruptaki rakiplere ({opponent} gibi)
      </div>
      {rec.games === 0 ? (
        <div className="text-muted-foreground">Bu dönemde maç yok</div>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-3 font-semibold tabular-nums">
          <span>{rec.games} maç</span>
          <span>
            {rec.wins}G {rec.draws}B {rec.losses}M
          </span>
          <span className="text-muted-foreground">
            maç başı {(rec.scored / rec.games).toFixed(1)} attı, {(rec.conceded / rec.games).toFixed(1)} yedi
          </span>
        </div>
      )}
    </div>
  );
}

function Prob({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{pct(value)}</div>
    </div>
  );
}
