import { describe, expect, it } from "vitest";
import { ageOn, availabilityLabel, careerTotals, formatEur, seasonYear, transferLabel } from "./player-bio";

describe("oyuncu profili", () => {
  it("yaş doğum gününe göre", () => {
    const birth = new Date("2000-02-16T00:00:00Z");
    expect(ageOn(birth, new Date("2026-02-15T12:00:00Z"))).toBe(25);
    expect(ageOn(birth, new Date("2026-02-16T12:00:00Z"))).toBe(26);
  });

  it("para biçimi", () => {
    expect(formatEur(32_000_000)).toBe("32 mn €");
    expect(formatEur(1_500_000)).toBe("1,5 mn €");
    expect(formatEur(850_000)).toBe("850 bin €");
    expect(formatEur(null)).toBeNull();
  });

  it("sezon yılı", () => {
    expect(seasonYear("Premier League 25/26")).toBe(2026);
    expect(seasonYear("MLS 2024")).toBe(2024);
    expect(seasonYear("Ligue 1 2023/2024")).toBe(2024);
    expect(seasonYear("World Cup 2022, CONCACAF Qualification")).toBe(2022);
    expect(seasonYear(null)).toBe(0);
  });

  it("transfer türü ve uygunluk", () => {
    expect(transferLabel(1, "-")).toBe("Kiralık");
    expect(transferLabel(3, "8M €")).toBe("8M €");
    expect(transferLabel(3, "-")).toBe("Bonservis");
    expect(availabilityLabel("available")).toBeNull();
    expect(availabilityLabel("injured")).toBe("Sakat");
  });

  it("kariyer toplamı milli takımı hariç tutabilir", () => {
    const rows = [
      { teamId: 1, matches: 10, minutes: 900, goals: 3, assists: 1 },
      { teamId: 99, matches: 5, minutes: 400, goals: 1, assists: 0 },
    ];
    expect(careerTotals(rows, (r) => r.teamId === 99)).toEqual({ matches: 10, minutes: 900, goals: 3, assists: 1 });
  });
});

describe("sakatlık adı", () => {
  it("bilinenler Türkçe, Unknown gizli", async () => {
    const { injuryName } = await import("./player-bio");
    expect(injuryName("red_card_suspension")).toBe("Kırmızı kart cezası");
    expect(injuryName("Meniscus Injury")).toBe("Menisküs sakatlığı");
    expect(injuryName("Unknown")).toBeNull();
    expect(injuryName("Something Rare")).toBe("Something Rare");
  });
});
