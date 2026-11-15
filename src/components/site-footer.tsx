// Tüm sayfaların altındaki footer: üç eşit sütun (hakkında · sayfalar · nasıl çalışır) ve bilgilendirme notu.
// Sayfa kısa olsa da en altta durması için layout'ta gövde flex-col + içerik flex-1 olmalı.
import Link from "next/link";
import { Logo, StatsMark } from "@/components/logo";

const LINKS = [
  { href: "/", label: "Maçlar" },
  { href: "/trends", label: "Trendler" },
  { href: "/kings", label: "Krallık" },
  { href: "/compare", label: "Karşılaştır" },
  { href: "/search", label: "Ara" },
];

const HOW = [
  "Maç sonuçları ve istatistikler her gün, kadrolar maçtan önce birkaç saatte bir güncellenir.",
  "Yüzdeler takımın ve oyuncunun son maçlarına dayanır; maç sayısı, saha, turnuva ve eşik sayfadan seçilebilir.",
  "Oyuncu ortalamaları ve oranları yalnızca ilk 11'de başladığı maçlardan hesaplanır.",
  "Seriler oyuncunun son maçından geriye doğru sayılır; 3 maç ve üzeri seriler gösterilir.",
  "Mevki kıyaslamaları ve krallıklar güncel sezona dayanır; ortalamalarda en az maç şartı aranır.",
];

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="poster mb-4 w-fit -rotate-1 rounded-full bg-[var(--yellow)] px-3 py-0.5 text-sm text-foreground">{children}</h2>;
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t-[3px] border-foreground bg-foreground text-white">
      <div className="mx-auto grid max-w-[92rem] gap-10 px-4 py-12 sm:grid-cols-3 sm:px-8">
        <div>
          <Link href="/" aria-label="Gokostats ana sayfa" className="mb-6 inline-block">
            <Logo />
          </Link>
          <ColumnTitle>Hakkında</ColumnTitle>
          <p className="leading-relaxed text-white/70">
            Gokostats, takımların ve oyuncuların son maçlarındaki istatistikleri bir araya getiren bir futbol istatistik sitesidir.
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
          <ul className="space-y-2.5 text-sm text-white/80">
            {HOW.map((h) => (
              <li key={h} className="flex gap-2.5">
                <StatsMark className="mt-0.5 size-4" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <p className="mx-auto max-w-[92rem] px-4 py-4 text-center text-xs leading-relaxed text-white/60">
          Buradaki istatistikler geçmiş maçlara dayanır ve yalnızca bilgi amaçlıdır; hiçbir içerik bahis tavsiyesi değildir. Gokostats,
          futbola duyduğum ilgiyle geliştirdiğim kişisel bir projedir.
        </p>
      </div>
    </footer>
  );
}
