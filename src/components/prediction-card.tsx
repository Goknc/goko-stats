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
  const sameTier = p.tiers.home && p.tiers.home === p.tiers.away;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Skor tahmini</CardTitle>
        {p.source === "trained" ? (
          <p className="text-sm text-muted-foreground">
            Bu skorlar, yaklaşık 25 bin geçmiş maçla eğitilmiş bir istatistik modelinin tahminidir; bahis tavsiyesi değildir. Model iki
            takımın güç farkına (Elo), benzer güçteki rakiplere karşı attıkları ve yedikleri gollere, son dönemdeki gol ve şut
            ortalamalarına, iç saha ve deplasman formuna, dinlenme sürelerine ve aralarındaki maçlara bakar. Futbolda tek bir skoru
            bilmek zordur; sonuç ve gol olasılıkları daha anlamlı bir fikir verir.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Bu skorlar bir istatistik modelinin (Poisson) tahminidir; bahis tavsiyesi değildir. Model {homeName} takımının son{" "}
            {p.home.games}, {awayName} takımının son {p.away.games} maçındaki gollere rakip gücünü hesaba katarak bakar
            {p.h2h.games > 0 ? ` ve aralarındaki ${p.h2h.games} maçı da değerlendirir` : ""}.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {p.lowSample && (
          <p className="rounded-2xl border-2 border-foreground bg-secondary px-3 py-2 text-sm font-medium">
            Takımlardan birinin yeterli maçı olmadığı için tahmin büyük ölçüde lig ortalamasına dayanıyor.
          </p>
        )}

        {/* Olası skorlar: en olası olan büyük, diğerleri yanında */}
        <div>
          <div className="marker text-2xl leading-none text-[var(--purple)]">Olası skorlar</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-baseline gap-3">
              <span className="poster text-7xl leading-none tabular-nums text-foreground [text-shadow:4px_4px_0_var(--yellow)]">
                {pr.mostLikely.home}-{pr.mostLikely.away}
              </span>
              <span className="text-sm font-semibold text-muted-foreground">{pct(pr.mostLikely.p)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {pr.topScores.slice(1).map((s) => (
                <div key={`${s.home}-${s.away}`} className="rounded-2xl border-2 border-foreground bg-secondary px-4 py-1.5 text-center">
                  <div className="poster text-2xl tabular-nums">
                    {s.home}-{s.away}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">{pct(s.p)}</div>
                </div>
              ))}
            </div>
          </div>
          {actual && (
            <div className={hit ? "mt-2 text-sm font-bold text-hit" : "mt-2 text-sm font-medium text-muted-foreground"}>
              Maç {actual.home}-{actual.away} bitti
              {hit ? " ✓" : ""}
            </div>
          )}
        </div>

        {/* Sonuç olasılıkları */}
        <div className="space-y-1.5">
          <div className="poster flex h-11 overflow-hidden rounded-full border-[2.5px] border-foreground text-lg shadow-[4px_4px_0_var(--ink)]">
            <div className="flex items-center justify-center bg-home text-white" style={{ width: width(pr.homeWin) }}>
              {pr.homeWin >= 0.12 && pct(pr.homeWin)}
            </div>
            <div className="flex items-center justify-center border-x-2 border-foreground bg-[var(--yellow)]" style={{ width: width(pr.draw) }}>
              {pr.draw >= 0.12 && pct(pr.draw)}
            </div>
            <div className="flex items-center justify-center bg-away text-white" style={{ width: width(pr.awayWin) }}>
              {pr.awayWin >= 0.12 && pct(pr.awayWin)}
            </div>
          </div>
          <div className="grid grid-cols-3 pt-1 text-sm font-bold">
            <span className="truncate">{homeName}</span>
            <span className="text-center">Beraberlik</span>
            <span className="truncate text-right">{awayName}</span>
          </div>
        </div>

        {/* Gol olasılıkları */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Prob label="3+ gol" value={pr.over25} />
          <Prob label="En fazla 2 gol" value={1 - pr.over25} />
          <Prob label="İki takım da gol atar" value={pr.btts} />
          <Prob label="En az biri gol atamaz" value={1 - pr.btts} />
        </div>

        {/* Benzer rakiplere karşı */}
        {p.tiers.home && p.tiers.away && (
          <div className="space-y-2">
            <h3 className="poster text-xl text-foreground">Benzer rakiplere karşı</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <TierLine team={homeName} rec={p.tiers.homeVsAwayTier} opponent={awayName} />
              <TierLine team={awayName} rec={p.tiers.awayVsHomeTier} opponent={homeName} />
            </div>
            <p className="text-xs text-muted-foreground">
              Turnuvadaki takımlar güçlerine göre üst, orta ve alt olmak üzere üç gruba ayrılır.{" "}
              {sameTier
                ? `${homeName} ve ${awayName} ${TIER_LABEL[p.tiers.home]} grupta yer alıyor.`
                : `${homeName} ${TIER_LABEL[p.tiers.home]} grupta, ${awayName} ${TIER_LABEL[p.tiers.away]} grupta yer alıyor.`}{" "}
              Bu tablo yalnızca bilgi verir; model her maçta rakibin gücünü ayrıca hesaba katar.
            </p>
          </div>
        )}

        {/* Aralarındaki maçların etkisi (yalnızca Poisson modelinde; eğitilmiş model bunu kendi özelliği olarak kullanır) */}
        {p.source === "poisson" && p.h2h.games > 0 && (
          <p className="text-sm text-muted-foreground">
            Aralarındaki maçların etkisi: {homeName} için gol beklentisi {effect(p.h2h.home)}, {awayName} için {effect(p.h2h.away)}.
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
    <div className="rounded-2xl border-2 border-foreground bg-secondary px-3 py-2 text-sm">
      <div className="text-xs font-medium text-muted-foreground">
        {team}, {TIER_LABEL[rec.tier]} gruptaki rakiplere karşı ({opponent} gibi)
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
            Maç başına {(rec.scored / rec.games).toFixed(1).replace(".", ",")} gol attı, {(rec.conceded / rec.games).toFixed(1).replace(".", ",")} gol yedi
          </span>
        </div>
      )}
    </div>
  );
}

// Etiket tek satırda kalır (uzun olanlar için küçük punto), kutu ortalı
function Prob({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border-2 border-foreground bg-secondary px-1.5 py-2.5 text-center">
      <div className="whitespace-nowrap text-[0.7rem] font-bold leading-tight tracking-tight text-muted-foreground min-[420px]:text-xs">{label}</div>
      <div className="poster mt-0.5 text-4xl leading-tight tabular-nums">{pct(value)}</div>
    </div>
  );
}
