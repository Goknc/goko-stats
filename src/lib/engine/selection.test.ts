// src/lib/engine/selection.test.ts
import { describe, it, expect } from "vitest";
import { selectTeamSample, selectPlayerSample, type TeamHistoryMatch, type PlayerHistoryLine } from "./selection";

const d = (s: string) => new Date(s);
const CELTA = 49, RAKIP_A = 1, RAKIP_B = 2;
const windowStart = d("2025-07-01");
const leagueTarget = { eventDate: d("2026-10-18"), leagueId: 3, competitionType: "LEAGUE" as const };
const opts = { target: leagueTarget, windowStart };

let nextId = 1;
function match(date: string, home: number, away: number, extra: Partial<TeamHistoryMatch> = {}): TeamHistoryMatch {
  return {
    id: nextId++, eventDate: d(date), status: "finished", leagueId: 3, competitionType: "LEAGUE",
    homeTeamId: home, awayTeamId: away,
    homeScore: 1, awayScore: 1, homeScoreHt: 0, awayScoreHt: 0,
    ...extra,
  };
}

function line(date: string, isStarter: boolean, extra: Partial<PlayerHistoryLine> = {}): PlayerHistoryLine {
  return {
    matchId: nextId++, eventDate: d(date), status: "finished", leagueId: 3, competitionType: "LEAGUE",
    isStarter, goals: 0, assists: 0, shotsOnTarget: 0, shotsTotal: 0, tackles: 0, fouls: 0, yellowCards: 0,
    ...extra,
  };
}

describe("Takım maç seçimi", () => {
  it("Ev sahibi için yalnızca iç saha maçları seçilir", () => {
    const history = [match("2026-09-01", CELTA, RAKIP_A), match("2026-09-08", RAKIP_A, CELTA)];
    const sample = selectTeamSample(history, CELTA, "home", opts);
    expect(sample.items).toHaveLength(1);
    expect(sample.items[0].homeTeamId).toBe(CELTA);
  });

  it("Sıralama tarihe göre, yeniden eskiye (Spike B2)", () => {
    const a = match("2026-08-01", CELTA, RAKIP_A);
    const b = match("2026-09-20", CELTA, RAKIP_B);
    const c = match("2026-09-01", CELTA, RAKIP_A);
    const ids = selectTeamSample([a, b, c], CELTA, "home", opts).items.map((m) => m.id);
    expect(ids).toEqual([b.id, c.id, a.id]);
  });

  it("Yalnızca bitmiş maçlar sayılır (Spike B3, B7)", () => {
    const history = ["finished", "postponed", "canceled", "cancelled", "unresolved", "notstarted"].map((status) =>
      match("2026-09-01", CELTA, RAKIP_A, { status }),
    );
    expect(selectTeamSample(history, CELTA, "home", opts).items).toHaveLength(1);
  });

  it("Hedef maçla aynı gün ve sonrasındaki maçlar sayılmaz", () => {
    const history = [match("2026-10-18", CELTA, RAKIP_A), match("2026-10-25", CELTA, RAKIP_B), match("2026-10-01", CELTA, RAKIP_A)];
    expect(selectTeamSample(history, CELTA, "home", opts).items).toHaveLength(1);
  });

  it("Lig maçında yalnızca aynı lig sayılır: Avrupa ve önceki alt lig maçları hariç", () => {
    const history = [
      match("2026-09-01", CELTA, RAKIP_A),
      match("2026-09-10", CELTA, RAKIP_B, { leagueId: 8, competitionType: "EUROPE" }),
      match("2025-12-01", CELTA, RAKIP_A, { leagueId: 38 }), // geçen sezon Segunda (yükselen takım)
    ];
    expect(selectTeamSample(history, CELTA, "home", opts).items).toHaveLength(1);
  });

  it("Avrupa maçında CL, EL ve ECL birlikte sayılır, lig maçları sayılmaz", () => {
    const euroOpts = { target: { eventDate: d("2026-10-22"), leagueId: 8, competitionType: "EUROPE" as const }, windowStart };
    const history = [
      match("2026-09-16", CELTA, RAKIP_A, { leagueId: 8, competitionType: "EUROPE" }),
      match("2025-10-01", CELTA, RAKIP_B, { leagueId: 7, competitionType: "EUROPE" }),
      match("2025-08-20", CELTA, RAKIP_A, { leagueId: 83, competitionType: "EUROPE" }),
      match("2026-09-01", CELTA, RAKIP_B), // lig maçı
    ];
    expect(selectTeamSample(history, CELTA, "home", euroOpts).items).toHaveLength(3);
  });

  it("Zaman penceresinden eski maçlar sayılmaz", () => {
    const history = [match("2025-05-01", CELTA, RAKIP_A), match("2025-08-01", CELTA, RAKIP_B)];
    expect(selectTeamSample(history, CELTA, "home", opts).items).toHaveLength(1);
  });

  it("En fazla 10 maç seçilir ve bunlar en yeni 10 maçtır", () => {
    const history = Array.from({ length: 15 }, (_, i) =>
      match(`2026-0${(i % 9) + 1}-${String(10 + i).padStart(2, "0")}`, CELTA, RAKIP_A),
    );
    const sample = selectTeamSample(history, CELTA, "home", opts);
    expect(sample.items).toHaveLength(10);
    const oldestSelected = sample.items[9].eventDate.getTime();
    const notSelected = history.filter((m) => !sample.items.includes(m));
    expect(notSelected.every((m) => m.eventDate.getTime() <= oldestSelected)).toBe(true);
  });

  it("6 maçtan az örnek 'az örnek' olarak işaretlenir", () => {
    const five = Array.from({ length: 5 }, (_, i) => match(`2026-09-0${i + 1}`, CELTA, RAKIP_A));
    expect(selectTeamSample(five, CELTA, "home", opts).lowSample).toBe(true);
    const six = [...five, match("2026-09-06", CELTA, RAKIP_A)];
    expect(selectTeamSample(six, CELTA, "home", opts).lowSample).toBe(false);
  });

  it("maxMatches ile son 20 maç seçilebilir", () => {
    const history = Array.from({ length: 25 }, (_, i) => match(`2026-0${(i % 9) + 1}-${String(1 + i).padStart(2, "0")}`, CELTA, RAKIP_A));
    expect(selectTeamSample(history, CELTA, "home", { ...opts, maxMatches: 20 }).items).toHaveLength(20);
  });
});

describe("Takım maç seçimi: genel form", () => {
  const allOpts = { ...opts, allVenues: true };

  it("İç ve dış saha maçları birlikte seçilir", () => {
    const history = [match("2026-09-01", CELTA, RAKIP_A), match("2026-09-08", RAKIP_B, CELTA)];
    expect(selectTeamSample(history, CELTA, "home", opts).items).toHaveLength(1);
    expect(selectTeamSample(history, CELTA, "home", allOpts).items).toHaveLength(2);
  });

  it("Deplasman maçı ev sahibi tarafına çevrilir (skor ve İY yer değiştirir)", () => {
    const away = match("2026-09-08", RAKIP_B, CELTA, { homeScore: 0, awayScore: 3, homeScoreHt: 0, awayScoreHt: 2 });
    const [m] = selectTeamSample([away], CELTA, "home", allOpts).items;
    expect(m).toMatchObject({ id: away.id, homeTeamId: CELTA, awayTeamId: RAKIP_B, homeScore: 3, awayScore: 0, homeScoreHt: 2, awayScoreHt: 0 });
  });

  it("Deplasman takımı için iç saha maçı deplasman tarafına çevrilir; zaten doğru taraftaki maç değişmez", () => {
    const home = match("2026-09-01", CELTA, RAKIP_A, { homeScore: 2, awayScore: 1 });
    const away = match("2026-09-08", RAKIP_B, CELTA, { homeScore: 0, awayScore: 1 });
    const items = selectTeamSample([home, away], CELTA, "away", allOpts).items;
    expect(items.find((m) => m.id === home.id)).toMatchObject({ awayTeamId: CELTA, homeScore: 1, awayScore: 2 });
    expect(items.find((m) => m.id === away.id)).toBe(away);
  });
});

describe("Oyuncu maç seçimi", () => {
  it("Yalnızca ilk 11'de başladığı maçlar sayılır", () => {
    const lines = [line("2026-09-01", true), line("2026-09-08", false), line("2026-09-15", true)];
    expect(selectPlayerSample(lines, opts).items).toHaveLength(2);
  });

  it("Ev/deplasman ayrımı yok; lig maçında başka ligdeki lig maçları da sayılır (transfer)", () => {
    const lines = [
      line("2026-09-01", true),
      line("2026-03-01", true, { leagueId: 4 }), // geçen sezon Serie A
      line("2026-09-16", true, { leagueId: 8, competitionType: "EUROPE" }), // Avrupa, sayılmaz
    ];
    expect(selectPlayerSample(lines, opts).items).toHaveLength(2);
  });
});