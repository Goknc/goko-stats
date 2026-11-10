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
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{children}</h2>;
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="mb-2 font-display text-xl font-bold italic tracking-tight">Gokostats</div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Takım ve oyuncuların son maçlarındaki istatistiklerine dayanan futbol istatistik platformu.
          </p>
        </div>

        <div>
          <ColumnTitle>Sayfalar</ColumnTitle>
          <ul className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-foreground/80 transition-colors hover:text-primary">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <ColumnTitle>Nasıl çalışır</ColumnTitle>
          <ul className="space-y-2 text-sm text-foreground/80">
            {HOW.map((h) => (
              <li key={h} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <p className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-muted-foreground/80">
          İstatistikler geçmiş maçlara dayanır ve yalnızca bilgi amaçlıdır.
        </p>
      </div>
    </footer>
  );
}
