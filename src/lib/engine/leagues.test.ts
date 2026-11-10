// src/lib/engine/leagues.test.ts
import { describe, it, expect } from "vitest";
import { canonicalLeagueId } from "./leagues";

describe("Lig eşleştirmesi", () => {
  it("Meksika Clausura, Apertura ile aynı lig sayılır", () => {
    expect(canonicalLeagueId(20)).toBe(19);
    expect(canonicalLeagueId(19)).toBe(19);
  });

  it("Diğer ligler değişmez", () => {
    expect(canonicalLeagueId(3)).toBe(3);
  });
});