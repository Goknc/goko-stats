// Tüm sayfaların altındaki footer: üç eşit sütun (proje · sayfalar · nasıl çalışır) ve bilgilendirme notu.
// Sayfa kısa olsa da en altta durması için layout'ta gövde flex-col + içerik flex-1 olmalı.
import Link from "next/link";

const LINKS = [
  { href: "/", label: "Maçlar" },
  { href: "/trends", label: "Trendler" },
  { href: "/kings", label: "Krallık" },
  { href: "/compare", label: "Karşılaştır" },
  { href: "/search", label: "Ara" },
];

const HOW = [
  "Maç sonuçları ve istatistikler her gün, kadrolar maç öncesi birkaç saatte bir güncellenir",
  "Yüzdeler takımın ve oyuncunun son maçlarına dayanır; maç sayısı, saha ve turnuva sayfada seçilebilir",
  "Oyuncu ortalamaları ve oranları yalnızca ilk 11'de başladığı maçlardan hesaplanır",
  "Seriler oynadığı son maçlardan geriye sayılır; 3 maç ve üstü gösterilir",
  "Mevki kıyası ve krallıklar güncel sezona dayanır; ortalamalarda en az maç şartı vardır",
];

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="poster mb-4 w-fit -rotate-1 rounded-full bg-[var(--yellow)] px-3 py-0.5 text-sm text-foreground">{children}</h2>;
}

export function SiteFooter() {
  return (
    // K-pop: siyah sahne, ekranı kaplayan gradyan logo, el yazısı not
    <footer className="mt-20 overflow-hidden border-t-[3px] border-foreground bg-foreground text-white">
      <div className="mx-auto max-w-[92rem] px-4 pt-10 sm:px-8">
        <div className="relative w-fit">
          <div className="poster stage-gradient bg-clip-text text-[clamp(4rem,17vw,15rem)] leading-[0.9] text-transparent">Gokostats</div>
          <span className="marker absolute -right-2 -top-1 rotate-6 text-2xl text-[var(--yellow)] sm:text-4xl">stats 4ever ♥</span>
        </div>
      </div>
      <div className="mx-auto grid max-w-[92rem] gap-10 px-4 py-12 sm:grid-cols-3 sm:px-8">
        <div>
          <ColumnTitle>Hakkında</ColumnTitle>
          <p className="leading-relaxed text-white/70">
            Takım ve oyuncuların son maçlarındaki istatistiklerine dayanan futbol istatistik platformu.
          </p>
        </div>

        <div>
          <ColumnTitle>Sayfalar</ColumnTitle>
          <ul className="poster grid grid-cols-2 gap-y-1 text-2xl sm:grid-cols-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-white transition-colors hover:text-[var(--pink)]">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <ColumnTitle>Nasıl çalışır</ColumnTitle>
          <ul className="space-y-2 text-sm text-white/80">
            {HOW.map((h) => (
              <li key={h} className="flex gap-2">
                <span className="shrink-0 text-[var(--pink)]" aria-hidden="true">♥</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <p className="mx-auto max-w-[92rem] px-4 py-4 text-center text-xs text-white/60">
          İstatistikler geçmiş maçlara dayanır ve yalnızca bilgi amaçlıdır.
        </p>
      </div>
    </footer>
  );
}
