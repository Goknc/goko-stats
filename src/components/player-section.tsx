// Maç detayı, bir takımın oyuncuları (US-04): maçın ilk 11'indeki herkes alt alta kart olarak.
// Sıra motorda (engine/player-groups > orderPlayers): öne çıkanı olanlar üstte, kalanlar en çok tutan trendlerine göre.
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
  lineup: { text: string; className: string };
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

  // Gösterilmeyenler: hiç sayılan maçı olmayan (veri yok, ya da hep yedekten girmiş) ve oranlar açıkken oranı olan
  // tek trendi bile olmayan oyuncular
  const hasData = (playerId: number) => (players[playerId]?.games.length ?? 0) > 0;
  const visible = [...byPlayer.values()].filter((p) => hasData(p.playerId) && p.trends.length > 0);
  const hiddenCount = byPlayer.size - visible.length;
  const ordered = orderPlayers(visible);
  const pickTotal = ordered.reduce((n, p) => n + p.picks.length, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TeamLogo id={teamId} name={teamName} size={28} />
            {teamName}
          </CardTitle>
          <span
            title="Oyuncu listesinin dayandığı ilk 11"
            className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", lineup.className)}
          >
            Kadro: {lineup.text}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {ordered.length} oyuncu · {pickTotal} öne çıkan
          {hiddenCount > 0 && (
            <span title="Sayılan ilk 11 maçı olmayan ya da oranı açılmış trendi olmayan oyuncular" className="text-muted-foreground/70">
              {" "}
              · {hiddenCount} gizli
            </span>
          )}
        </span>
      </CardHeader>

      <CardContent className="space-y-3">
        {ordered.length === 0 && <p className="text-muted-foreground">Kadro bilgisi yok.</p>}
        {ordered.map(({ player, picks, focus, featured, lowSample }) => {
          // Oranlar açıksa kartta yalnızca oranı olan trendler (seçici, hızlı geçiş, açılış trendi)
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
              badge={picks.length ? `${picks.length} öne çıkan` : lowSample ? "az veri" : undefined}
              className={picks.length ? "border-primary/50" : undefined}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
