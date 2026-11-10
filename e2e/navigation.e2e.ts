// Gezinme: menü, tarih seçici, sekme başlıkları, mobil menü, arama kutusu.
import { test, expect } from "@playwright/test";
import { DAY, isMobile } from "./helpers";

test.describe("Gezinme", () => {
  test("ana sayfa açılır, başlık ve tarih doğru", async ({ page }) => {
    await page.goto(`/?date=${DAY}`);
    await expect(page).toHaveTitle("Maçlar · Gokostats");
    await expect(page.getByRole("link", { name: "Gokostats" }).first()).toBeVisible();
    await expect(page.getByText(/\d+ maç/).first()).toBeVisible();
  });

  test("ileri / geri gün düğmeleri tarihi değiştirir", async ({ page }) => {
    await page.goto(`/?date=${DAY}`);
    await page.getByRole("button", { name: "Sonraki gün" }).click();
    await expect(page).not.toHaveURL(new RegExp(`date=${DAY}`));
    await page.getByRole("button", { name: "Önceki gün" }).click();
    await expect(page).toHaveURL(new RegExp(`date=${DAY}`));
  });

  test("takvim açılır ve Esc ile kapanır", async ({ page }) => {
    await page.goto(`/?date=${DAY}`);
    // Masaüstünde uzun ay adı ("15 Ekim"), mobilde kısa ("15 Eki")
    await page.getByRole("button", { name: /Eki|Bugün|Dün|Yarın/ }).click();
    const calendar = page.getByRole("grid");
    await expect(calendar).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(calendar).toBeHidden();
  });

  test("her sayfanın sekme başlığı kendi adını taşır", async ({ page }) => {
    const pages: [string, string][] = [
      [`/trends?date=${DAY}`, "Günün trendleri · Gokostats"],
      ["/kings", "Krallık · Gokostats"],
      ["/compare", "Karşılaştır · Gokostats"],
      ["/search", "Ara · Gokostats"],
    ];
    for (const [url, title] of pages) {
      await page.goto(url);
      await expect(page).toHaveTitle(title);
    }
  });

  test("menü bağlantıları doğru sayfaya gider", async ({ page }) => {
    await page.goto(`/?date=${DAY}`);
    if (isMobile(page)) await page.getByRole("button", { name: "Menüyü aç" }).click();
    // Masaüstü ve mobil menüde aynı bağlantı var; görünür olanı seç
    await page.locator("header").getByRole("link", { name: "Krallık", exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/kings/);
    await expect(page.getByRole("heading", { name: "Krallık", level: 1 })).toBeVisible();
  });

  test("mobil menü açılır, sekmeye basınca kapanır", async ({ page }) => {
    test.skip(!isMobile(page), "yalnızca mobil");
    await page.goto(`/?date=${DAY}`);
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    const link = page.locator("header").getByRole("link", { name: "Karşılaştır" }).filter({ visible: true });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/compare/);
    await expect(page.getByRole("button", { name: "Menüyü aç" })).toBeVisible();
  });

  test("arama kutusu öneri gösterir, Enter sonuç sayfasını açar", async ({ page }) => {
    await page.goto(`/?date=${DAY}`);
    if (isMobile(page)) await page.getByRole("button", { name: "Menüyü aç" }).click();
    const box = page.locator("header").getByRole("combobox").filter({ visible: true });
    await box.fill("united");
    await expect(page.getByRole("option").first()).toBeVisible();
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=united/);
    await expect(page.getByText("Takımlar", { exact: true })).toBeVisible();
  });

  test("sayfada yatay kaydırma yok", async ({ page }) => {
    for (const url of [`/?date=${DAY}`, `/trends?date=${DAY}`, "/kings", "/compare", "/search?q=united"]) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${url} yana taşıyor`).toBeLessThanOrEqual(1);
    }
  });
});
