import { describe, expect, it } from "vitest";
import { lineupScore, pickEleven, pitchRows, repairEleven, type Candidate } from "./lineup-pick";

const c = (id: number, position: string, starts: number[], subs: number[] = []): Candidate<number> => ({ player: id, position, starts, subs });

// 2 kaleci, 6 defans, 6 orta saha, 5 forvet; id küçüldükçe daha düzenli
const squad = (): Candidate<number>[] => [
  c(1, "G", [0, 1, 2]), c(2, "G", [], [0]),
  ...[3, 4, 5, 6].map((id) => c(id, "D", [0, 1, 2])), c(7, "D", [2]), c(8, "D", [], [1]),
  ...[9, 10, 11].map((id) => c(id, "M", [0, 1, 2])), c(12, "M", [1]), c(13, "M", [2]), c(14, "M", [], [0]),
  ...[15, 16, 17].map((id) => c(id, "F", [0, 1, 2])), c(18, "F", [1, 2]), c(19, "F", [], [2]),
];

describe("Tahmini ilk 11", () => {
  it("Yeni maçtaki ilk 11 eskisinden, ilk 11 yedekten girmekten değerlidir", () => {
    expect(lineupScore({ starts: [0], subs: [] })).toBeGreaterThan(lineupScore({ starts: [3], subs: [] }));
    expect(lineupScore({ starts: [2], subs: [] })).toBeGreaterThan(lineupScore({ starts: [], subs: [0] }));
  });

  it("Son maçın dizilişini (4-3-3) en düzenli oyuncularla kurar, kalanlar yedek olur", () => {
    const picked = pickEleven(squad(), 9)!;
    expect(picked.starters.sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 6, 9, 10, 11, 15, 16, 17]);
    expect(picked.bench).toHaveLength(8);
    expect(picked.bench[0]).toBe(18); // en düzenli yedek önde
  });

  it("Kaleci yoksa ya da 11 kişi çıkmıyorsa kadro kurulmaz", () => {
    expect(pickEleven(squad().filter((x) => x.position !== "G"), 9)).toBeNull();
    expect(pickEleven(squad().slice(0, 8), 9)).toBeNull();
  });

  it("Maç verisi yokken hazır sıraya (rank) göre 4-3-3 seçer", () => {
    const ranked = squad().map((x, i) => ({ ...x, starts: [], subs: [], rank: i }));
    const picked = pickEleven(ranked, 5)!;
    expect(picked.starters).toHaveLength(11);
    expect(picked.starters).toContain(1);
    expect(picked.bench).toHaveLength(5);
  });
});

describe("Sahaya diziliş", () => {
  const p = (id: number, position: string | null, specificPosition: string | null = null) => ({ id, position, specificPosition });

  it("Hatlara böler ve her hattı soldan sağa sıralar", () => {
    const rows = pitchRows([p(1, "G", "GK"), p(2, "D", "RB"), p(3, "D", "CB"), p(4, "D", "LB"), p(5, "M", "AM"), p(6, "M", "DM"), p(7, "F", "ST"), p(8, "F", "LW")]);
    expect(rows.keeper.map((x) => x.id)).toEqual([1]);
    expect(rows.defence.map((x) => x.id)).toEqual([4, 3, 2]);
    expect(rows.midfield.map((x) => x.id)).toEqual([6, 5]);
    expect(rows.attack.map((x) => x.id)).toEqual([8, 7]);
  });

  it("Mevkisi bilinmeyen oyuncu orta sahaya konur; taşan hat dengelenir", () => {
    const rows = pitchRows([p(1, "G"), ...[2, 3, 4, 5].map((id) => p(id, "D")), ...[6, 7, 8, 9, 10, 11].map((id) => p(id, "F"))]);
    expect(rows.attack.length).toBeLessThanOrEqual(4);
    expect(rows.midfield.length).toBeGreaterThan(0);
    expect(pitchRows([p(1, null)]).midfield).toHaveLength(1);
  });
});

describe("Tahmini ilk 11'i onarma", () => {
  const p = (id: number, position: string) => ({ id, position });
  const eleven = [p(1, "G"), p(3, "D"), p(4, "D"), p(5, "D"), p(6, "D"), p(9, "M"), p(10, "M"), p(11, "M"), p(15, "F"), p(16, "F"), p(99, "F")];
  const pool: Candidate<{ id: number; position: string }>[] = [
    { player: p(18, "F"), position: "F", starts: [0, 1], subs: [] },
    { player: p(19, "F"), position: "F", starts: [], subs: [0] },
    { player: p(12, "M"), position: "M", starts: [0], subs: [] },
  ];

  it("Kadroda olmayan oyuncunun yerine aynı hattan en düzenli aday girer", () => {
    const r = repairEleven(eleven, (x) => x.id !== 99, pool, 3)!;
    expect(r.starters.map((x) => x.id)).toContain(18);
    expect(r.starters.map((x) => x.id)).not.toContain(99);
    expect(r.replaced).toEqual([{ out: p(99, "F"), in: p(18, "F") }]);
  });

  it("Herkes uygunsa kadro aynen kalır", () => {
    expect(repairEleven(eleven, () => true, pool, 3)).toEqual({ starters: eleven, replaced: [] });
  });

  it("Çok oyuncu çıkıyorsa ya da yer doldurulamıyorsa tahmin bırakılır", () => {
    expect(repairEleven(eleven, (x) => x.id > 10, pool, 3)).toBeNull();
    expect(repairEleven(eleven, (x) => x.id !== 1, pool, 3)).toBeNull(); // yedek kaleci yok
  });
});
