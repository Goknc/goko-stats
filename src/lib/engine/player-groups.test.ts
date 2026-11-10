import { describe, expect, it } from "vitest";
import { bestPerStat, orderPlayers, type GroupTrend, type GroupPlayer } from "./player-groups";

// Kısa yardımcı: trend üret (oran 0-1)
function mk(code: string, statKey: string, line: number, threshold: number, rate: number | null, extra: Partial<GroupTrend> = {}): GroupTrend {
  return {
    code, name: code, statKey, line, threshold, rate,
    hits: rate === null ? 0 : Math.round(rate * 10), total: rate === null ? 0 : 10,
    lowSample: false, recommended: false, ...extra,
  };
}
const player = (playerId: number, name: string, trends: GroupTrend[]): GroupPlayer => ({ playerId, name, trends });

// Barcelona ekran görüntüsündeki gerçek oranlar
const yamal = player(1, "Lamine Yamal", [
  mk("P_SOT1", "shotsOnTarget", 1, 0.9, 0.8),
  mk("P_SOT2", "shotsOnTarget", 2, 0.6, 0.6, { recommended: true }),
  mk("P_SHOT2", "shotsTotal", 2, 0.9, 1.0),
  mk("P_SHOT3", "shotsTotal", 3, 0.8, 0.9, { recommended: true }),
  mk("P_GOAL", "goals", 1, 0.7, 0.6),
]);
const gordon = player(2, "Anthony Gordon", [
  mk("P_SHOT2", "shotsTotal", 2, 0.9, 0.8),
  mk("P_SOT1", "shotsOnTarget", 1, 0.9, 0.6),
]);
const olmo = player(3, "Dani Olmo", [mk("P_SHOT2", "shotsTotal", 2, 0.9, 0.7)]);
const rodri = player(4, "Rodri", [
  mk("P_SHOT2", "shotsTotal", 2, 0.9, 0.4),
  mk("P_SHOT3", "shotsTotal", 3, 0.8, 0.2),
  mk("P_TKL2", "tackles", 2, 0.9, 0.4),
  mk("P_YC", "yellowCards", 1, 0.6, 0.2),
]);
const jesus = player(5, "Gabriel Jesus", [
  mk("P_GOAL", "goals", 1, 0.7, 0.5, { lowSample: true, hits: 1, total: 2 }),
  mk("P_SOT1", "shotsOnTarget", 1, 0.9, 1.0, { lowSample: true, hits: 2, total: 2 }),
]);
const keeper = player(6, "Joan García", [mk("P_GOAL", "goals", 1, 0.7, 0), mk("P_SHOT2", "shotsTotal", 2, 0.9, 0)]);

describe("bestPerStat", () => {
  it("her istatistikten en yüksek oranlıyı alır ve orana göre sıralar", () => {
    const r = bestPerStat(rodri.trends);
    expect(r.map((m) => m.code)).toEqual(["P_SHOT2", "P_TKL2", "P_YC"]);
  });
  it("oran eşitse yüksek çizgiyi seçer", () => {
    const r = bestPerStat([mk("a", "s", 1, 0.5, 0.5), mk("b", "s", 2, 0.5, 0.5)]);
    expect(r.map((m) => m.code)).toEqual(["b"]);
  });
});

describe("orderPlayers (maç detayı, tüm ilk 11)", () => {
  it("Öne çıkanı olan en üstte ve kartı öne çıkan trendyla açılır; kalanlar en iyi isabete göre", () => {
    const out = orderPlayers([rodri, jesus, keeper, gordon, yamal, olmo]);
    expect(out.map((o) => o.player.name)).toEqual(["Lamine Yamal", "Anthony Gordon", "Dani Olmo", "Rodri", "Joan García", "Gabriel Jesus"]);
    expect(out[0].focus?.code).toBe("P_SHOT3"); // öne çıkanların en yüksek oranlısı
    expect(out[0].featured.map((m) => m.code)).toEqual(["P_SHOT3", "P_SOT2"]);
    expect(out[1].focus?.code).toBe("P_SHOT2"); // en çok tutan trend
    expect(out[4].lowSample).toBe(false); // hiç tutmasa da verisi var
    expect(out[5].lowSample).toBe(true); // az veri en sonda
    expect(out[5].focus).toBeNull();
  });
});
