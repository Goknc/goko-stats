// playwright.config.ts
// Uçtan uca testler: gerçek veritabanıyla, production build'e karşı (3100 portunda).
// Production: sayfalar önceden derlenir; dev sunucusunun Windows'taki EPERM dosya kilidi sorunları olmaz.
// Çalıştırma: npm run test:e2e      → önce next build, sonra testler (sunucu: next start -p 3100)
//             npm run test:e2e:dev  → açık olan npm run dev'e karşı (hızlı deneme için)
import { defineConfig, devices } from "@playwright/test";

// npm run test:e2e:dev ile çalıştırılınca npm bu değişkeni kendisi verir (Windows'ta da çalışır)
const useDev = process.env.npm_lifecycle_event === "test:e2e:dev" || process.env.E2E_DEV === "1";
const PORT = useDev ? 3000 : 3100;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts", // .spec/.test değil: Vitest bu dosyaları almasın
  timeout: 60_000, // ilk açılışta analizler hesaplanıyor (önbellek boş)
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // aynı veritabanı ve önbellek; sıralı çalışsın
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "masaustu", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobil", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    // Build, test:e2e komutunda Playwright'tan önce yapılır; burada yalnızca hazır build başlatılır
    command: useDev ? "npm run dev" : `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: useDev, // production her seferinde güncel kodla yeniden derlensin
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
