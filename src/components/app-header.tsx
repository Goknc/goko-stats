"use client";
// Tüm sayfaların üstündeki sabit menü: logo, sekmeler, arama kutusu, tarih seçici (takvimli).
// Mobil ve tablet (<1024px): logo + tarih + ☰ düğmesi; düğme arama kutusunu ve sekmeleri alt alta açar. Geniş ekran: tek satır.
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { todayTR } from "@/lib/dates";
import { DatePicker } from "@/components/date-picker";
import { SearchBox } from "@/components/search-box";
import { cn } from "@/lib/utils";

// K-pop: siyah sahne çubuğu, poster harfli logo, hap sekmeler (seçili sarı ve eğik), altında renkli kayan şerit
const TICKER = ["Bugünün sahnesi", "Hot trendler", "Krallık listesi", "Son 20 maç", "Karşılaştır", "Form tablosu", "Maç analizi", "Gokostats"];

const NAV = [
  { href: "/", label: "Maçlar" },
  { href: "/trends", label: "Trendler" },
  { href: "/kings", label: "Krallık" },
  { href: "/compare", label: "Karşılaştır" },
];

// Tarihe bağlı sayfalar (tarih seçici bunlarda görünür, sekme bağlantıları seçili günü taşır)
const DATED = ["/", "/trends"];

export function AppHeader() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const date = params.get("date") ?? todayTR();
  const onMatchPage = pathname.startsWith("/matches/");
  // Maç detayında tarih seçici, maçın günüyle (?date=) gelindiyse görünür; seçim maç listesine götürür
  const showDate = onMatchPage ? params.has("date") : DATED.includes(pathname);
  // Gün değişince sayfanın diğer seçimleri (ör. maç listesinde saat sıralaması) korunur
  const go = (d: string) => {
    if (onMatchPage) return router.push(`/?date=${d}`);
    const next = new URLSearchParams(params.toString());
    next.set("date", d);
    router.push(`${pathname}?${next.toString()}`);
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" || onMatchPage : pathname.startsWith(href));
  const hrefOf = (href: string) => (DATED.includes(href) && params.has("date") ? `${href}?date=${date}` : href);

  return (
    <header className="sticky top-0 z-20 bg-foreground text-white">
      <div className="mx-auto flex max-w-[92rem] items-center gap-x-2 px-3 py-2.5 sm:gap-x-6 sm:px-8">
        <Link href={hrefOf("/")} className="group flex items-baseline gap-1">
          <span className="poster text-2xl leading-none tracking-wide sm:text-4xl">
            Goko<span className="text-[var(--pink)]">stats</span>
          </span>
          <span className="wiggle hidden text-xl text-[var(--yellow)] sm:inline">♥</span>
        </Link>

        {/* Masaüstü sekmeleri */}
        <nav className="hidden min-w-0 gap-2.5 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={hrefOf(item.href)}
              className={cn(
                "poster shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-1 text-base transition-all",
                isActive(item.href)
                  ? "-rotate-2 border-[var(--yellow)] bg-[var(--yellow)] text-foreground shadow-[3px_3px_0_var(--pink)]"
                  : "border-white/40 text-white hover:-rotate-1 hover:border-white hover:bg-white hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <SearchBox className="mr-2 hidden w-56 lg:block xl:w-64" />
          {showDate && <DatePicker date={date} onChange={go} />}

          {/* Mobil menü düğmesi */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={menuOpen}
            className="ml-1 shrink-0 rounded-full border-2 border-white/50 p-1.5 text-white hover:bg-white/10 lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobil menü: sekmeler alt alta */}
      {menuOpen && (
        <nav className="space-y-2 border-t border-white/20 px-3 py-3 lg:hidden">
          <SearchBox className="mx-1 mb-2" onNavigate={() => setMenuOpen(false)} />
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={hrefOf(item.href)}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "poster flex items-center rounded-2xl border-2 px-4 py-2 text-3xl transition-colors",
                isActive(item.href)
                  ? "border-[var(--yellow)] bg-[var(--yellow)] text-foreground"
                  : "border-white/30 text-white hover:bg-white hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      {/* Kayan şerit */}
      <div className="stage-gradient overflow-hidden border-y-2 border-foreground py-1 text-white" aria-hidden="true">
        <div className="marquee-track flex w-max">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0">
              {TICKER.map((t, i) => (
                <span key={t} className="poster flex items-center gap-4 px-4 text-sm">
                  {t}
                  <span className="text-[var(--yellow)]">{i % 2 ? "♥" : "★"}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
