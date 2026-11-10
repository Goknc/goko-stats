// src/lib/engine/starter.test.ts
import { describe, it, expect } from "vitest";
import { inferStarter } from "./starter";

describe("İlk 11 tespiti (Spike B9)", () => {
  it("Kadro biliniyorsa kadroya bakılır, dakikaya bakılmaz", () => {
    expect(inferStarter({ lineupKnown: true, listedAsStarter: true, minutesPlayed: 45 })).toBe(true);
    expect(inferStarter({ lineupKnown: true, listedAsStarter: false, minutesPlayed: 70 })).toBe(false);
  });

  it("Kadro bilinmiyorsa 60+ dakika ilk 11 sayılır", () => {
    expect(inferStarter({ lineupKnown: false, listedAsStarter: false, minutesPlayed: 72 })).toBe(true);
    expect(inferStarter({ lineupKnown: false, listedAsStarter: false, minutesPlayed: 60 })).toBe(true);
  });

  it("Kadro bilinmiyorsa 60 dakikanın altı ilk 11 sayılmaz", () => {
    expect(inferStarter({ lineupKnown: false, listedAsStarter: false, minutesPlayed: 59 })).toBe(false);
    expect(inferStarter({ lineupKnown: false, listedAsStarter: false, minutesPlayed: 26 })).toBe(false);
  });
});