// Maç detayındaki oyuncuların sırası ve kartlarının açılacağı trend (bkz. orderPlayers).

export interface GroupTrend {
  code: string;
  name: string;
  statKey: string;
  line: number;
  threshold: number;
  rate: number | null; // 0-1
  hits: number;
  total: number;
  lowSample: boolean;
  recommended: boolean;
}

export interface GroupPlayer {
  playerId: number;
  name: string;
  trends: GroupTrend[];
}

const usable = (m: GroupTrend) => !m.lowSample && m.rate !== null;

// Her istatistikten tek trend: oranı en yüksek olan (eşitse yüksek çizgi). Sonuç orana göre azalan.
export function bestPerStat(trends: GroupTrend[]): GroupTrend[] {
  const best = new Map<string, GroupTrend>();
  for (const m of trends) {
    const cur = best.get(m.statKey);
    const better =
      !cur || (m.rate ?? 0) > (cur.rate ?? 0) || ((m.rate ?? 0) === (cur.rate ?? 0) && m.line > cur.line);
    if (better) best.set(m.statKey, m);
  }
  return [...best.values()].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}

// ---------- Maç detayı: tüm ilk 11 alt alta ----------
// Öne çıkanı olanlar en üstte (kart o trendyla açılır), kalanlar en yüksek isabetli trendlerine göre;
// az verili oyuncular en sonda. featured: kartta hızlı geçiş düğmeleri.
export interface OrderedPlayer {
  player: GroupPlayer;
  picks: GroupTrend[]; // öne çıkan trendleri (orana göre azalan)
  focus: GroupTrend | null; // kartın açıldığı trend
  featured: GroupTrend[];
  lowSample: boolean;
}

export const MAX_FEATURED = 3;

export function orderPlayers(players: GroupPlayer[]): OrderedPlayer[] {
  const ordered = players.map((player): OrderedPlayer => {
    const picks = player.trends.filter((m) => m.recommended).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
    const best = bestPerStat(player.trends.filter(usable));
    return {
      player,
      picks,
      focus: picks[0] ?? best[0] ?? null,
      featured: picks.length ? picks : best.slice(0, MAX_FEATURED),
      lowSample: best.length === 0,
    };
  });
  const rank = (p: OrderedPlayer) => (p.picks.length ? 0 : p.lowSample ? 2 : 1);
  return ordered.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.picks.length - a.picks.length ||
      (b.focus?.rate ?? 0) - (a.focus?.rate ?? 0) ||
      a.player.name.localeCompare(b.player.name, "tr"),
  );
}
