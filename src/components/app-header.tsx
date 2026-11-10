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
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-x-3 px-4 py-2 sm:gap-x-4">
        <Link href={hrefOf("/")} className="py-1 font-display text-xl font-bold italic tracking-tight sm:text-2xl">
          Gokostats
        </Link>

        {/* Masaüstü sekmeleri */}
        <nav className="hidden min-w-0 gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={hrefOf(item.href)}
              className={cn(
                "shrink-0 whitespace-nowrap px-2.5 py-2 font-display text-base font-semibold text-muted-foreground transition-colors hover:text-foreground",
                isActive(item.href) && "text-foreground shadow-[inset_0_-2px_0_var(--primary)]",
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
            className="ml-1 rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobil menü: sekmeler alt alta */}
      {menuOpen && (
        <nav className="border-t border-border px-2 py-2 lg:hidden">
          <SearchBox className="mx-1 mb-2" onNavigate={() => setMenuOpen(false)} />
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={hrefOf(item.href)}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center rounded-lg px-3 py-2.5 font-display text-base font-semibold transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-foreground shadow-[inset_3px_0_0_var(--primary)]"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
