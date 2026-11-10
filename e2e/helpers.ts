// Testlerde kullanılan sabitler ve yardımcılar.
// Veriler canlı olduğu için testler belirli skor/oyuncu değil, sayfa yapısını ve akışları kontrol eder.
import type { Page } from "@playwright/test";

// Maçı ve önerisi olan bilinen bir gün (gerekirse: E2E_DATE=2026-10-18 npm run test:e2e)
export const DAY = process.env.E2E_DATE ?? "2026-10-15";
// İstatistikleri çoktan senkronlanmış bitmiş maçların olduğu gün (dünün maçlarının istatistiği ertesi gün 12:00'de gelir)
export const STATS_DAY = process.env.E2E_STATS_DATE ?? "2026-10-11";
// Takip edilen liglerde maç olmayan uzak bir gün
export const EMPTY_DAY = "2031-01-01";

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;
