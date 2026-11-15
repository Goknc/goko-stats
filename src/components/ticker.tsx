// Kayan şerit: bugünün öne çıkan maçları ve güncel sezonun kralları. Sunucu bileşeni; içerik lib/ticker'dan.
// Kesintisiz döngü: aynı grup iki kez art arda basılır ve şerit tam bir grup boyu kayar. Grup ekrandan dar kalmasın diye
// öğeler yeterli sayıya ulaşana kadar tekrarlanır. Üstüne gelince durur.
import Link from "next/link";
import { tickerItems, TICKER_FALLBACK, type TickerItem } from "@/lib/ticker";

const MIN_ITEMS = 18; // bir grubun en geniş ekranı da doldurması için
const SECONDS_PER_ITEM = 4.5;

export function TickerStrip({ items }: { items: TickerItem[] }) {
  const repeat = Math.ceil(MIN_ITEMS / items.length);
  const group = Array.from({ length: repeat }, () => items).flat();

  return (
    <div className="marquee stage-gradient overflow-hidden border-y-2 border-foreground py-1 text-white">
      <div className="marquee-track flex w-max" style={{ animationDuration: `${group.length * SECONDS_PER_ITEM}s` }}>
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0" aria-hidden={k === 1}>
            {group.map((t, i) => (
              <Link
                key={i}
                href={t.href}
                tabIndex={k === 1 || i >= items.length ? -1 : undefined}
                className="poster flex items-center gap-2 whitespace-nowrap px-4 text-sm hover:text-[var(--yellow)]"
              >
                {t.tag && <span className="rounded-full bg-foreground px-2 py-px text-xs text-[var(--yellow)]">{t.tag}</span>}
                {t.text}
                <span className="pl-4 text-[var(--yellow)]" aria-hidden="true">
                  {i % 2 ? "✦" : "★"}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export async function Ticker() {
  return <TickerStrip items={await tickerItems()} />;
}

export function TickerFallback() {
  return <TickerStrip items={TICKER_FALLBACK} />;
}
