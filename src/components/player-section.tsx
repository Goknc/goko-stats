// Maç detayı, bir takımın oyuncuları: maçın ilk 11'indeki (kesin ya da tahmini) herkes alt alta kart olarak.
// Sıra motorda (engine/player-groups > orderPlayers): öne çıkanı olanlar üstte, kalanlar en yüksek oranlı trendlerine göre.
// Her kart açıldığı trendi gösterir; seçiciyle oyuncunun diğer trendlerine geçilir.
import type { PlayerInfo, PlayerTrendResult } from "@/lib/analysis";
import { orderPlayers, type GroupPlayer } from "@/lib/engine/player-groups";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerCard, type CardTrend } from "@/components/player-card";
import { TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

interface PlayerSectionProps {
  teamId: number;
  teamName: string;
  lineup: { text: string; className: string } | null; // kadro kaynağı; kadro yoksa null
  trends: PlayerTrendResult[]; // yalnızca bu takımın oyuncuları
  players: Record<number, PlayerInfo>; // maç maç veri (analiz)
}

export function PlayerSection({ teamId, teamName, lineup, trends, players }: PlayerSectionProps) {
  const byPlayer = new Map<number, GroupPlayer>();
  const rawByPlayer = new Map<number, PlayerTrendResult[]>();
  for (const m of trends) {
    if (!byPlayer.has(m.playerId)) byPlayer.set(m.playerId, { playerId: m.playerId, name: m.playerName, trends: [] });
    if (!rawByPlayer.has(m.playerId)) rawByPlayer.set(m.playerId, []);
    rawByPlayer.get(m.playerId)!.push(m);
    byPlayer.get(m.playerId)!.trends.push({
      code: m.code, name: m.name, statKey: m.statKey, line: m.line, threshold: m.threshold,
      rate: m.summary.rate, hits: m.summary.hits, total: m.summary.total,
      lowSample: m.summary.lowSample, recommended: m.recommended,
    });
  }

  // Sayılan maçı olmayan oyuncunun (veri yok ya da hep yedekten girmiş) kartı boş kalacağı için gösterilmez
  const hasData = (playerId: number) => (players[playerId]?.games.length ?? 0) > 0;
  const ordered = orderPlayers([...byPlayer.values()].filter((p) => hasData(p.playerId) && p.trends.length > 0));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <TeamLogo id={teamId} name={teamName} size={28} />
          {teamName}
        </CardTitle>
        {lineup && (
          <span
            title="Oyuncu listesinin dayandığı ilk 11"
            className={cn("rounded-full border-2 border-foreground px-2.5 py-0.5 text-xs font-bold", lineup.className)}
          >
            {lineup.text}
          </span>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {ordered.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-foreground/40 bg-secondary/60 px-4 py-8 text-center font-medium text-muted-foreground">
            {lineup
              ? "Bu kadrodaki oyuncuların geçmiş maç verisi henüz yok."
              : "Bu maç için henüz oyuncu verisi yok."}
          </p>
        )}
        {ordered.map(({ player, picks, focus, featured, lowSample }) => {
          const raw = rawByPlayer.get(player.playerId) ?? [];
          const cardTrends: CardTrend[] = raw.map((m) => ({
            code: m.code, name: m.name, statKey: m.statKey, line: m.line, threshold: m.threshold,
            rate: m.summary.rate, hits: m.summary.hits, total: m.summary.total, lowSample: m.summary.lowSample,
          }));
          const info = players[player.playerId];
          return (
            <PlayerCard
              key={player.playerId}
              playerId={player.playerId}
              name={player.name}
              position={info?.position ?? null}
              injury={info?.injury ?? null}
              teamId={teamId}
              teamName={teamName}
              games={info?.games ?? []}
              trends={cardTrends}
              defaultCode={focus?.code ?? raw[0]?.code ?? ""}
              featured={featured.map((m) => m.code)}
              badge={picks.length ? `${picks.length} öne çıkan` : lowSample ? "Az veri" : undefined}
              highlight={picks.length > 0}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
