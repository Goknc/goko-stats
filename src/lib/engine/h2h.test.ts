import { describe, expect, it } from "vitest";
import { headToHead, h2hFilterFromParams, h2hFilterParams, streaksOf, type H2HMatch } from "./h2h";

const FB = 10;
const GS = 20;
let seq = 0;
// Tarih sırası: listede önce gelen daha YENİ maç (gün sayısı geriye gider)
function m(home: number, hs: number | null, as: number | null, daysAgo: number): H2HMatch {
  return {
    id: ++seq,
    eventDate: new Date(Date.UTC(2026, 9, 12) - daysAgo * 86_400_000),
    homeTeamId: home,
    awayTeamId: home === FB ? GS : FB,
    homeScore: hs,
    awayScore: as,
  };
}

describe("headToHead", () => {
  // Bugünkü maç: FB (ev) - GS. Bakış açısı FB.
  const matches = [
    m(GS, 0, 0, 30), //  GS 0-0 FB  → FB D, deplasman
    m(FB, 2, 1, 200), // FB 2-1 GS  → W, ev
    m(GS, 1, 3, 400), // GS 1-3 FB  → W, deplasman
    m(FB, 1, 1, 560), // FB 1-1 GS  → D, ev
    m(GS, 3, 0, 750), // GS 3-0 FB  → L
    m(FB, 2, 2, 900), // FB 2-2 GS  → D, ev
    m(FB, null, null, 10), // ertelenmiş / skorsuz: sayılmaz
  ];
  const h = headToHead(matches, FB);

  it("maçları en yeniden eskiye sıralar ve skorsuz maçı atar", () => {
    expect(h.games.map((g) => g.result)).toEqual(["D", "W", "W", "D", "L", "D"]);
  });

  it("A açısından genel ve iç saha karnesi", () => {
    expect(h.all).toEqual({ total: 6, wins: 2, draws: 3, losses: 1 });
    expect(h.venue).toEqual({ total: 3, wins: 1, draws: 2, losses: 0 });
  });

  it("gol toplamları, iki takım da gol ve 3+ gol sayıları", () => {
    expect(h.goalsFor).toBe(0 + 2 + 3 + 1 + 0 + 2);
    expect(h.goalsAgainst).toBe(0 + 1 + 1 + 1 + 3 + 2);
    expect(h.btts).toBe(4); // 2-1, 1-3, 1-1, 2-2
    expect(h.over25).toBe(4); // 2-1, 1-3, 3-0, 2-2
  });

  it("seriler: genelde 4 maçtır yenilmiyor, evinde 3 maçtır yenilmiyor (tamamı)", () => {
    expect(h.streaks).toContainEqual({ kind: "unbeaten", length: 4, scope: "all" });
    expect(h.streaks).toContainEqual({ kind: "unbeaten", length: 3, scope: "venue" });
  });

  it("en eski karşılaşma ve filtre öncesi maç sayısı", () => {
    expect(h.available).toBe(6);
    expect(h.oldest).toEqual(matches[5].eventDate);
  });

  it("saha filtresi: yalnızca A evinde / yalnızca B evinde", () => {
    const home = headToHead(matches, FB, { venue: "home", last: null });
    expect(home.games.every((g) => g.aWasHome)).toBe(true);
    expect(home.all).toEqual({ total: 3, wins: 1, draws: 2, losses: 0 });
    expect(home.streaks).toContainEqual({ kind: "unbeaten", length: 3, scope: "venue" });
    expect(home.streaks.some((s) => s.scope !== "venue")).toBe(false);

    const away = headToHead(matches, FB, { venue: "away", last: null });
    expect(away.all).toEqual({ total: 3, wins: 1, draws: 1, losses: 1 });
    expect(away.goalsFor).toBe(0 + 3 + 0);
  });

  it("son N maç: özet yalnızca en yeni N maçtan, available kesilmeden önceki sayı", () => {
    const last2 = headToHead(matches, FB, { venue: "all", last: 2 });
    expect(last2.games.map((g) => g.result)).toEqual(["D", "W"]);
    expect(last2.all.total).toBe(2);
    expect(last2.available).toBe(6);
    expect(last2.oldest).toEqual(matches[5].eventDate); // en eski tarih filtreden bağımsız
  });

  it("veri yoksa boş özet", () => {
    const e = headToHead([], FB);
    expect(e.all).toEqual({ total: 0, wins: 0, draws: 0, losses: 0 });
    expect(e.streaks).toEqual([]);
  });
});

describe("streaksOf", () => {
  const games = (rs: [number, number][]) =>
    headToHead(rs.map(([f, a], i) => m(FB, f, a, i * 10)), FB).games;

  it("galibiyet serisi yenilmezlikle aynıysa yalnızca galibiyet söylenir", () => {
    const s = streaksOf(games([[2, 0], [1, 0], [3, 1]]), "all").map((x) => x.kind);
    expect(s).toContain("wins");
    expect(s).not.toContain("unbeaten");
  });

  it("araya beraberlik girince galibiyet serisi kısalır, yenilmezlik uzun kalır", () => {
    const s = streaksOf(games([[2, 0], [1, 1], [3, 1], [2, 2]]), "all");
    expect(s).toContainEqual({ kind: "unbeaten", length: 4, scope: "all" });
    expect(s.find((x) => x.kind === "wins")).toBeUndefined();
  });

  it("GS deplasmanda FB'yi yenemiyor = FB evinde yenilmiyor; galibiyetsizlik ters yönden", () => {
    const s = streaksOf(games([[0, 1], [1, 1], [0, 2], [2, 3]]), "all");
    expect(s).toContainEqual({ kind: "winless", length: 4, scope: "all" });
    expect(s.find((x) => x.kind === "losses")).toBeUndefined(); // ilk kayıp serisi 1-1'de kırılır (1)
  });

  it("gol serileri: 3 maçtır iki takım da gol ve 3+ gol", () => {
    const s = streaksOf(games([[2, 1], [1, 2], [3, 3], [0, 0]]), "all").map((x) => x.kind);
    expect(s).toEqual(expect.arrayContaining(["over25", "btts"]));
    expect(s).not.toContain("under25");
  });

  it("2 maçlık seri raporlanmaz", () => {
    expect(streaksOf(games([[2, 0], [1, 0], [0, 1]]), "all").find((x) => x.kind === "wins")).toBeUndefined();
  });
});

describe("h2hFilterFromParams", () => {
  it("varsayılan: tüm sahalar, son 10", () => {
    expect(h2hFilterFromParams({})).toEqual({ venue: "all", last: 10 });
  });
  it("geçerli seçimler okunur, geçersizler varsayılana düşer", () => {
    expect(h2hFilterFromParams({ h2h: "away", h2hn: "all" })).toEqual({ venue: "away", last: null });
    expect(h2hFilterFromParams({ h2h: "x", h2hn: "7" })).toEqual({ venue: "all", last: 10 });
  });
  it("parametreye geri çevirir, varsayılanları yazmaz", () => {
    expect(h2hFilterParams({ venue: "all", last: 10 })).toEqual({});
    expect(h2hFilterParams({ venue: "home", last: null })).toEqual({ h2h: "home", h2hn: "all" });
  });
});
