// Gösterim yardımcıları: Türkçe adlar, trend başlıkları, eşik seçimi, kariyer ve transfer özetleri.
import { describe, expect, it } from "vitest";
import { teamNamesMatching, trLeague, trTeam } from "./team-names";
import { sideCaption, trendTitle } from "./trend-labels";
import { analysisOptions, DEFAULT_SAMPLE, isDefaultSample, sampleFromParams, sampleParams } from "./app-settings";
import { careerStints, seasonStartYear, transferFee } from "./engine/player-bio";

describe("Türkçe adlar", () => {
  it("Milli takım adlarını çevirir, kulüp adlarına dokunmaz", () => {
    expect(trTeam("Latvia")).toBe("Letonya");
    expect(trTeam("Germany U21")).toBe("Almanya U21");
    expect(trTeam("Galatasaray")).toBe("Galatasaray");
    expect(trTeam(null)).toBeNull();
  });

  it("Uluslararası turnuva adlarını çevirir", () => {
    expect(trLeague("UEFA Nations League")).toBe("UEFA Uluslar Ligi");
    expect(trLeague("Premier League")).toBe("Premier League");
  });

  it("Türkçe yazılan aramayı veritabanındaki ada götürür", () => {
    expect(teamNamesMatching("leton")).toEqual(["Latvia"]);
    expect(teamNamesMatching("ALMAN")).toContain("Germany");
    expect(teamNamesMatching("a")).toEqual([]);
  });
});

describe("Trend başlıkları", () => {
  const win = { code: "H_WIN", name: "Ev sahibi kazandı", side: "HOME" as const, line: null };
  const awayGoals = { code: "A_O15", name: "Deplasman 2+ gol", side: "AWAY" as const, line: 2 };
  const total = { code: "O25", name: "3+ gol", side: null, line: null };

  it("Tek takıma bakan trendde takımın adını yazar", () => {
    expect(trendTitle(win, "Letonya", "Ermenistan")).toBe("Letonya kazandı");
    expect(trendTitle(awayGoals, "Letonya", "Ermenistan")).toBe("Ermenistan 2+ gol");
    expect(trendTitle(total, "Letonya", "Ermenistan")).toBe("3+ gol");
  });

  it("Rakibin satırı aynı olayı kendi açısından söyler", () => {
    expect(sideCaption(win, "home")).toBe("Kazandı");
    expect(sideCaption(win, "away")).toBe("Kaybetti");
    expect(sideCaption(awayGoals, "away")).toBe("2+ gol attı");
    expect(sideCaption(awayGoals, "home")).toBe("2+ gol yedi");
    expect(sideCaption(total, "home")).toBeNull();
  });
});

describe("Analiz ayarı", () => {
  it("Geçersiz ya da eksik seçim varsayılanı alır", () => {
    expect(sampleFromParams({})).toEqual(DEFAULT_SAMPLE);
    expect(sampleFromParams({ n: "999", team: "x", esik: "65" })).toEqual(DEFAULT_SAMPLE);
    expect(isDefaultSample(sampleFromParams({ esik: "70" }))).toBe(false);
  });

  it("Seçim adres çubuğuna ve analiz seçeneklerine çevrilir; varsayılanlar yazılmaz", () => {
    const s = sampleFromParams({ n: "10", esik: "70" });
    expect(sampleParams(s)).toEqual({ n: "10", esik: "70" });
    expect(analysisOptions(s)).toEqual({ maxMatches: 10, threshold: 0.7 });
    expect(sampleParams(DEFAULT_SAMPLE)).toEqual({});
    expect(analysisOptions(DEFAULT_SAMPLE)).toEqual({});
  });
});

describe("Kariyer ve transfer", () => {
  const row = (teamId: number, teamName: string, seasonName: string, matches: number, goals: number, avgRating: number | null) => ({
    teamId, teamName, seasonName, matches, minutes: matches * 90, goals, assists: 0, avgRating,
  });

  it("Sezon başlangıç yılını bulur", () => {
    expect(seasonStartYear("Premier League 25/26")).toBe(2025);
    expect(seasonStartYear("MLS 2024")).toBe(2024);
    expect(seasonStartYear(null)).toBe(0);
  });

  it("Sezon satırlarını takım takım toplar; en son oynadığı takım önce", () => {
    const stints = careerStints(
      [row(1, "A", "Lig 21/22", 30, 10, 7), row(1, "A", "Kupa 21/22", 5, 2, null), row(1, "A", "Lig 22/23", 10, 3, 8), row(2, "B", "Lig 23/24", 20, 5, 6.5), row(9, "Milli", "Turnuva 2022", 4, 1, 7)],
      9,
    );
    expect(stints.map((s) => s.teamId)).toEqual([2, 1, 9]);
    const a = stints[1];
    expect(a).toMatchObject({ seasons: 2, fromYear: 2021, toYear: 2023, matches: 45, goals: 15, national: false });
    expect(a.avgRating).toBeCloseTo((7 * 30 + 8 * 10) / 40);
    expect(stints[2].national).toBe(true);
  });

  it("Transfer bedelini türüne göre yazar", () => {
    expect(transferFee(3, 5_200_000, "5.2M €")).toEqual({ text: "5,2 mn €", kind: "paid" });
    expect(transferFee(3, 0, "Free")).toEqual({ text: "Bedelsiz", kind: "free" });
    expect(transferFee(3, 0, "-")).toEqual({ text: "Bedel açıklanmadı", kind: "free" });
    expect(transferFee(1, 0, "-")).toEqual({ text: "Kiralık", kind: "loan" });
    expect(transferFee(2, null, null)).toEqual({ text: "Kiralıktan dönüş", kind: "loan" });
  });
});
