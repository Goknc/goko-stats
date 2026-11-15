// src/lib/ticker.ts
// Üst menünün altındaki kayan şeridin içeriği: bugünün öne çıkan maçları ve güncel sezonun kralları.
// 10 dakika önbellekte durur; veritabanına ulaşılamazsa sabit başlıklar gösterilir.
import { prisma } from "./prisma";
import { cached } from "./ttl-cache";
import { listable } from "./match-filters";
import { dayRange, formatTime, todayTR } from "./dates";
import { leagueRank } from "./league-order";
import { allLeagueIds, kingBoard, type KingStatKey } from "./kings";

export interface TickerItem {
  text: string;
  href: string;
  tag?: string; // küçük etiket: "Bugün", "Kral"
}

export const TICKER_FALLBACK: TickerItem[] = [
  { text: "Günün maçları", href: "/" },
  { text: "Trendler", href: "/trends" },
  { text: "Krallık", href: "/kings" },
  { text: "Takım karşılaştırma", href: "/compare" },
];

const MATCH_COUNT = 6;
const KINGS: { key: KingStatKey; label: string }[] = [
  { key: "goals", label: "Gol kralı" },
  { key: "assists", label: "Asist kralı" },
  { key: "shotsOnTarget", label: "İsabetli şut kralı" },
  { key: "keyPasses", label: "Kilit pas kralı" },
  { key: "tackles", label: "Top kapma kralı" },
  { key: "saves", label: "Kurtarış kralı" },
];

async function build(date: string): Promise<TickerItem[]> {
  const { start, end } = dayRange(date);
  const [matches, ids] = await Promise.all([
    prisma.match.findMany({
      where: { eventDate: { gte: start, lt: end }, league: { isTracked: true }, ...listable },
      select: {
        id: true, eventDate: true, status: true, homeScore: true, awayScore: true,
        league: { select: { name: true } },
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    }),
    allLeagueIds(),
  ]);

  // Günün öne çıkan maçları: en popüler turnuvalardan, saat sırasıyla
  const top = matches
    .sort((a, b) => leagueRank(a.league.name) - leagueRank(b.league.name) || a.eventDate.getTime() - b.eventDate.getTime())
    .slice(0, MATCH_COUNT)
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
  const matchItems: TickerItem[] = top.map((m) => ({
    tag: m.status === "finished" ? "Bitti" : formatTime(m.eventDate),
    text: m.status === "finished" ? `${m.homeTeam.name} ${m.homeScore}-${m.awayScore} ${m.awayTeam.name}` : `${m.homeTeam.name} – ${m.awayTeam.name}`,
    href: `/matches/${m.id}?date=${date}`,
  }));

  const boards = await Promise.all(KINGS.map((k) => kingBoard(k.key, "total", null, ids)));
  const kingItems: TickerItem[] = boards.flatMap((b, i) => {
    const first = b.rows[0];
    return first ? [{ tag: KINGS[i].label, text: `${first.playerName} · ${first.total}`, href: `/kings?stat=${b.statKey}` }] : [];
  });

  // Maçlar ve krallar sırayla karışsın
  const mixed: TickerItem[] = [];
  if (matches.length) mixed.push({ tag: "Bugün", text: `${matches.length} maç`, href: `/?date=${date}` });
  for (let i = 0; i < Math.max(matchItems.length, kingItems.length); i++) {
    if (matchItems[i]) mixed.push(matchItems[i]);
    if (kingItems[i]) mixed.push(kingItems[i]);
  }
  mixed.push({ text: "Günün trendleri", href: `/trends?date=${date}` });
  return mixed.length > 2 ? mixed : TICKER_FALLBACK;
}

export async function tickerItems(): Promise<TickerItem[]> {
  const date = todayTR();
  try {
    return await cached(`ticker:${date}`, 10 * 60 * 1000, () => build(date));
  } catch {
    return TICKER_FALLBACK;
  }
}
