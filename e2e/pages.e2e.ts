// Sayfa akışları: maç detayı, trend filtreleri, takım / oyuncu sayfası, karşılaştırma, boş gün, bulunamayan kayıt.
import { test, expect } from "@playwright/test";
import { DAY, EMPTY_DAY, STATS_DAY } from "./helpers";

test.describe("Maç listesi ve detay", () => {
  test("listeden bir maça girilir, detay bölümleri görünür", async ({ page }) => {
    await page.goto(`/?date=${DAY}`);
    const firstMatch = page.locator('main a[href^="/matches/"]').first();
    test.skip((await firstMatch.count()) === 0, `${DAY} için maç yok`);
    await firstMatch.click();

    await expect(page).toHaveURL(/\/matches\/\d+/);
    await expect(page).toHaveTitle(/ · Gokostats$/);
    await expect(page.getByText("Öne çıkan trendler")).toBeVisible();
    await expect(page.getByText("Takım istatistikleri")).toBeVisible();
    await expect(page.getByRole("link", { name: "← Maç listesi" })).toBeVisible();
  });

  test("biten maçta istatistik sekmeleri çalışır", async ({ page }) => {
    await page.goto(`/?date=${STATS_DAY}`);
    const match = page.locator('main a[href^="/matches/"]').first();
    test.skip((await match.count()) === 0, `${STATS_DAY} için maç yok`);
    await match.click();

    await expect(page.getByText("Maç istatistikleri")).toBeVisible();
    const h1 = page.getByRole("tab", { name: "1. Yarı" });
    await h1.click();
    await expect(h1).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Maç" })).toHaveAttribute("aria-selected", "false");
  });

  test("olmayan maç, takım ve oyuncu 404 verir", async ({ page }) => {
    for (const url of ["/matches/999999999", "/teams/999999999", "/players/999999999", "/teams/abc"]) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(404);
    }
  });

  test("maç olmayan günde boş mesaj çıkar", async ({ page }) => {
    await page.goto(`/?date=${EMPTY_DAY}`);
    await expect(page.getByText("Bu tarihte takip edilen liglerde maç yok.")).toBeVisible();
    await page.goto(`/trends?date=${EMPTY_DAY}`);
    await expect(page.getByText("Bu tarihte takip edilen liglerde maç yok.")).toBeVisible();
  });
});

test.describe("Trendler", () => {
  test("trend menüsünden seçim yapılır, URL ve kartlar değişir", async ({ page }) => {
    await page.goto(`/trends?date=${DAY}`);
    const trigger = page.getByRole("button", { name: /Trend/ });
    test.skip((await trigger.count()) === 0, `${DAY} için trend yok`);

    await trigger.click();
    const option = page.getByRole("dialog").getByRole("link").nth(1); // ilk gerçek trend ("Tümü"nden sonra)
    const name = (await option.locator("span").nth(1).textContent())?.trim() ?? "";
    await option.click();

    await expect(page).toHaveURL(/trend=/);
    await expect(page.getByRole("button", { name: /Trend/ })).toContainText(name);
  });

  test("sıralama Saat ve Maç seçilince URL güncellenir", async ({ page }) => {
    await page.goto(`/trends?date=${DAY}`);
    test.skip((await page.getByText("Sırala:").count()) === 0, `${DAY} için trend yok`);

    await page.getByRole("link", { name: "Saat", exact: true }).click();
    await expect(page).toHaveURL(/sort=saat/);
    await page.getByRole("link", { name: "Maç", exact: true }).click();
    await expect(page).toHaveURL(/sort=mac/);
  });
});

test.describe("Takım, oyuncu ve karşılaştırma", () => {
  test("maçtan takım sayfasına, oradan oyuncu sayfasına gidilir", async ({ page }) => {
    await page.goto(`/?date=${STATS_DAY}`);
    const match = page.locator('main a[href^="/matches/"]').first();
    test.skip((await match.count()) === 0, `${STATS_DAY} için maç yok`);
    await match.click();
    await page.locator('main header a[href^="/teams/"]').first().click();
    await expect(page).toHaveURL(/\/teams\/\d+/);
    await expect(page.getByRole("link", { name: "Takım istatistikleri" })).toBeVisible();

    const playersTab = page.getByRole("link", { name: "Oyuncu istatistikleri" });
    test.skip((await playersTab.count()) === 0, "bu ligde oyuncu verisi yok");
    await playersTab.click();
    await page.locator('main a[href^="/players/"]').first().click();
    await expect(page).toHaveURL(/\/players\/\d+/);
    await expect(page.getByText("Öne çıkan özellikler")).toBeVisible();
    await expect(page.getByText("Maç kaydı")).toBeVisible();
  });

  test("oyuncu sayfasında istatistik seçilince grafik değişir", async ({ page }) => {
    await page.goto("/search?q=fernandes");
    const player = page.locator('main a[href^="/players/"]').first();
    test.skip((await player.count()) === 0, "oyuncu bulunamadı");
    await player.click();
    await page.getByRole("link", { name: "Gol", exact: true }).click();
    await expect(page).toHaveURL(/stat=goals/);
  });

  test("maç sayfasından iki takım karşılaştırılır", async ({ page }) => {
    await page.goto(`/?date=${STATS_DAY}`);
    const match = page.locator('main a[href^="/matches/"]').first();
    test.skip((await match.count()) === 0, `${STATS_DAY} için maç yok`);
    await match.click();
    await page.getByRole("link", { name: /Takımları karşılaştır/ }).click();
    await expect(page).toHaveURL(/\/compare\?a=\d+&b=\d+/);
    await expect(page.getByText("Maç başı ortalamalar")).toBeVisible();
    await expect(page.getByText("Maç trendleri")).toBeVisible();
    await page.getByRole("link", { name: "Son 5" }).click();
    await expect(page).toHaveURL(/last=5/);
  });

  test("krallık kategorisi ve ligi menüden değiştirilir", async ({ page }) => {
    await page.goto("/kings");
    await expect(page.getByText(/Gol krallığı/)).toBeVisible();
    await expect(page.getByText("Tüm ligler · güncel sezon")).toBeVisible();
    await page.getByRole("button", { name: /Kategori/ }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Asist", exact: true }).click();
    await expect(page).toHaveURL(/stat=assists/);
    await expect(page.getByText(/Asist krallığı/)).toBeVisible();

    await page.getByRole("link", { name: "Maç başı" }).click();
    await expect(page).toHaveURL(/sort=perMatch/);
    await expect(page).toHaveURL(/stat=assists/);

    await page.getByRole("button", { name: /Lig/ }).click();
    const league = page.getByRole("dialog").getByRole("link").nth(1);
    test.skip((await league.count()) === 0, "oyuncu verisi olan lig yok");
    await league.click();
    await expect(page).toHaveURL(/league=\d+/);
    await expect(page).toHaveURL(/stat=assists/);
  });

  test("footer sayfa bağlantılarını ve açıklamayı gösterir", async ({ page }) => {
    await page.goto("/compare");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText("Nasıl çalışır")).toBeVisible();
    await expect(footer.getByRole("link", { name: "Krallık" })).toBeVisible();
  });
});
