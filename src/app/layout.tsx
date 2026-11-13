import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
// Font (Outfit) projenin içinden (npm paketi): build sırasında Google Fonts'a bağlanmaya gerek kalmaz
import "@fontsource-variable/outfit";
import "@fontsource/anton";
import "@fontsource-variable/caveat";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Gokostats", template: "%s · Gokostats" },
  description: "Futbol istatistikleri: takım ve oyuncu trendleri, form tabloları, karşılaştırma ve maç analizi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Suspense fallback={null}>
          <AppHeader />
        </Suspense>
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
