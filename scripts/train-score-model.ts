// scripts/train-score-model.ts
// Eğitilmiş skor modeli: eğit, mevcut Poisson modeliyle aynı maçlarda karşılaştır. Veritabanına yazmaz.
// Eğitim: --split tarihinden önceki maçlar · Test: --split ve sonrası (model test maçlarını hiç görmez).
// Kullanım: npx tsx --env-file=.env scripts/train-score-model.ts [--split 2026-03-01] [--to 2026-11-09] [--no-baseline] [--save]
// --save: modeli tüm maçlarla yeniden eğitip src/lib/score-model.json dosyasına yazar (sitenin kullandığı).
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { predictMatch } from "../src/lib/prediction";
import { canonicalLeagueId } from "../src/lib/engine/leagues";
import {
  FeatureState, FEATURE_NAMES, fitPoisson, fitRho, predictLambda, scoreProb, type PlayedMatch, type PoissonModel, type SavedScoreModel,
} from "../src/lib/engine/score-model";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const split = new Date(`${arg("split") ?? "2026-03-01"}T00:00:00+03:00`);
const to = new Date(`${arg("to") ?? new Date().toISOString().slice(0, 10)}T00:00:00+03:00`);
const withBaseline = !process.argv.includes("--no-baseline");
const MIN_GAMES = 5; // iki takımın da en az bu kadar geçmiş maçı olmalı
const TRAIN_FROM = new Date("2024-01-01T00:00:00Z"); // öncesi yalnızca ısınma

// Bir maçın skor dağılımından ölçüler
interface Dist { home: number; draw: number; away: number; over25: number; btts: number; top: { h: number; a: number; p: number }[] }
function dist(cell: (h: number, a: number) => number): Dist {
  const cells: { h: number; a: number; p: number }[] = [];
  for (let h = 0; h <= 10; h++) for (let a = 0; a <= 10; a++) cells.push({ h, a, p: cell(h, a) });
  const mass = cells.reduce((s, c) => s + c.p, 0);
  cells.forEach((c) => (c.p /= mass));
  const sum = (f: (c: { h: number; a: number }) => boolean) => cells.filter(f).reduce((s, c) => s + c.p, 0);
  return {
    home: sum((c) => c.h > c.a), draw: sum((c) => c.h === c.a), away: sum((c) => c.h < c.a),
    over25: sum((c) => c.h + c.a >= 3), btts: sum((c) => c.h > 0 && c.a > 0),
    top: cells.sort((x, y) => y.p - x.p).slice(0, 3),
  };
}

class Metrics {
  n = 0; exact = 0; top3 = 0; result = 0; over = 0; btts = 0; ll = 0; brier = 0; brierOver = 0; brierBtts = 0; topP = 0;
  predicted = new Map<string, number>();
  add(d: Dist, hs: number, as: number) {
    const res = hs > as ? "home" : hs === as ? "draw" : "away";
    const probs = { home: d.home, draw: d.draw, away: d.away };
    const best = (Object.keys(probs) as (keyof typeof probs)[]).sort((x, y) => probs[y] - probs[x])[0];
    this.n++;
    if (d.top[0].h === hs && d.top[0].a === as) this.exact++;
    if (d.top.some((t) => t.h === hs && t.a === as)) this.top3++;
    if (best === res) this.result++;
    if (d.over25 >= 0.5 === hs + as >= 3) this.over++;
    if (d.btts >= 0.5 === (hs > 0 && as > 0)) this.btts++;
    this.ll += -Math.log(Math.max(probs[res], 1e-6));
    this.brier += (["home", "draw", "away"] as const).reduce((s, k) => s + (probs[k] - (k === res ? 1 : 0)) ** 2, 0);
    this.brierOver += (d.over25 - (hs + as >= 3 ? 1 : 0)) ** 2;
    this.brierBtts += (d.btts - (hs > 0 && as > 0 ? 1 : 0)) ** 2;
    this.topP += d.top[0].p;
    const k = `${d.top[0].h}-${d.top[0].a}`;
    this.predicted.set(k, (this.predicted.get(k) ?? 0) + 1);
  }
  rows() {
    const n = this.n || 1;
    const p = (x: number) => `%${((x / n) * 100).toFixed(1)}`;
    return {
      "Ana skor tuttu": `${this.exact} (${p(this.exact)})`,
      "İlk 3 skordan biri": p(this.top3),
      "En olası sonuç": p(this.result),
      "3+ gol (evet/hayır)": p(this.over),
      "İki takım da gol (evet/hayır)": p(this.btts),
      "1X2 log-loss ↓": (this.ll / n).toFixed(4),
      "1X2 Brier ↓": (this.brier / n).toFixed(4),
      "2.5 Üst Brier ↓": (this.brierOver / n).toFixed(4),
      "KG Brier ↓": (this.brierBtts / n).toFixed(4),
      "Ana skora verilen ort. olasılık": p(this.topP),
      "Farklı ana skor sayısı": String(this.predicted.size),
      "En sık tahminler": [...this.predicted].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, c]) => `${k} %${Math.round((c / n) * 100)}`).join(", "),
    };
  }
}

async function main() {
  const started = Date.now();
  const raw = await prisma.match.findMany({
    where: { status: "finished", homeScore: { not: null }, awayScore: { not: null }, eventDate: { lt: to } },
    select: {
      id: true, leagueId: true, eventDate: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
      teamStats: { where: { period: "FULL" }, select: { isHome: true, shotsTotal: true, shotsOnTarget: true } },
    },
    orderBy: { eventDate: "asc" },
  });
  const matches: PlayedMatch[] = raw.map((m) => {
    const h = m.teamStats.find((s) => s.isHome);
    const a = m.teamStats.find((s) => !s.isHome);
    return {
      id: m.id, leagueId: canonicalLeagueId(m.leagueId), eventDate: m.eventDate, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeScore: m.homeScore!, awayScore: m.awayScore!,
      homeShots: h?.shotsTotal ?? null, awayShots: a?.shotsTotal ?? null, homeSot: h?.shotsOnTarget ?? null, awaySot: a?.shotsOnTarget ?? null,
    };
  });
  console.log(`${matches.length} maç yüklendi`);

  // Tarih sırasıyla oynat: önce özellik, sonra güncelle (aynı gün maçları birbirini görmesin diye gün gün)
  const state = new FeatureState();
  type Sample = { m: PlayedMatch; home: number[]; away: number[] };
  const train: Sample[] = [];
  const test: Sample[] = [];
  let i = 0;
  while (i < matches.length) {
    const day = matches[i].eventDate.toISOString().slice(0, 10);
    let j = i;
    while (j < matches.length && matches[j].eventDate.toISOString().slice(0, 10) === day) j++;
    const batch = matches.slice(i, j);
    for (const m of batch) {
      if (m.eventDate < TRAIN_FROM) continue;
      if (state.gamesOf(m.homeTeamId) < MIN_GAMES || state.gamesOf(m.awayTeamId) < MIN_GAMES) continue;
      const f = state.features(m);
      (m.eventDate < split ? train : test).push({ m, ...f });
    }
    for (const m of batch) state.update(m);
    i = j;
  }
  console.log(`eğitim ${train.length} · test ${test.length} maç`);

  // Eğit
  const X = train.flatMap((s) => [s.home, s.away]);
  const y = train.flatMap((s) => [s.m.homeScore, s.m.awayScore]);
  let best: { l2: number; model: PoissonModel; ll: number } | null = null;
  // Düzenleme gücü: eğitimin son %15'i doğrulama
  const cut = Math.floor(train.length * 0.85);
  for (const l2 of [1, 10, 100, 300, 1000, 3000]) {
    const model = fitPoisson(train.slice(0, cut).flatMap((s) => [s.home, s.away]), train.slice(0, cut).flatMap((s) => [s.m.homeScore, s.m.awayScore]), l2);
    let ll = 0;
    for (const s of train.slice(cut)) {
      const lh = predictLambda(model, s.home);
      const la = predictLambda(model, s.away);
      ll += -Math.log(scoreProb(Math.min(s.m.homeScore, 10), Math.min(s.m.awayScore, 10), lh, la, 0) + 1e-12);
    }
    console.log(`l2=${l2} doğrulama skor log-loss ${(ll / (train.length - cut)).toFixed(4)}`);
    if (!best || ll < best.ll) best = { l2, model, ll };
  }
  const model = fitPoisson(X, y, best!.l2);
  const lam = (s: Sample) => ({ lh: predictLambda(model, s.home), la: predictLambda(model, s.away) });
  const rho = fitRho(train.map((s) => ({ ...lam(s), h: s.m.homeScore, a: s.m.awayScore })));
  console.log(`seçilen l2=${best!.l2}, Dixon–Coles ρ=${rho}`);

  // Test
  const mNew = new Metrics();
  const mNewNoDc = new Metrics();
  const mOld = new Metrics();
  const mOldSame = new Metrics(); // yeni modelin de tahmin ettiği aynı maçlar
  const mNewSame = new Metrics();
  for (const [k, s] of test.entries()) {
    const { lh, la } = lam(s);
    const dNew = dist((h, a) => scoreProb(h, a, lh, la, rho));
    mNew.add(dNew, s.m.homeScore, s.m.awayScore);
    mNewNoDc.add(dist((h, a) => scoreProb(h, a, lh, la, 0)), s.m.homeScore, s.m.awayScore);
    if (withBaseline) {
      const old = await predictMatch(s.m.id, { model: "poisson" });
      if (old) {
        const { lambdaHome, lambdaAway } = old.prediction;
        mOld.add(dist((h, a) => scoreProb(h, a, lambdaHome, lambdaAway, 0)), s.m.homeScore, s.m.awayScore);
        mNewSame.add(dNew, s.m.homeScore, s.m.awayScore);
      }
      if ((k + 1) % 1000 === 0) console.log(`test ${k + 1}/${test.length}`);
    }
  }
  void mOldSame;

  // Rapor
  const L: string[] = [
    `# Skor modeli: eğitilmiş model vs mevcut model`, ``,
    `Eğitim: 2024-01 → ${split.toISOString().slice(0, 10)} (${train.length} maç) · Test: ${split.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)} (${test.length} maç, model bu maçları hiç görmedi)`,
    `Düzenleme l2=${best!.l2} · Dixon–Coles ρ=${rho} · ${new Date().toLocaleString("tr-TR")}`, ``,
    `↓ = düşük olan iyi. Log-loss ve Brier olasılıkların ne kadar doğru olduğunu ölçer (yalnızca "tuttu mu" değil, "ne kadar emin" de).`, ``,
  ];
  const cols: [string, Metrics][] = withBaseline
    ? [["Mevcut model", mOld], ["Yeni model", mNewSame], ["Yeni (ρ yok)", mNewNoDc]]
    : [["Yeni model", mNew], ["Yeni (ρ yok)", mNewNoDc]];
  L.push(`| Ölçü | ${cols.map((c) => `${c[0]} (${c[1].n})`).join(" | ")} |`, `| --- | ${cols.map(() => "---").join(" | ")} |`);
  const keys = Object.keys(cols[0][1].rows()) as (keyof ReturnType<Metrics["rows"]>)[];
  for (const k of keys) L.push(`| ${k} | ${cols.map((c) => c[1].rows()[k]).join(" | ")} |`);
  L.push(``, `## Özelliklerin etkisi (standartlaştırılmış ağırlık; büyük = gol beklentisini çok değiştiriyor, + artırır, − azaltır)`, ``);
  L.push(`| Özellik | Ağırlık |`, `| --- | --- |`);
  const ws = FEATURE_NAMES.map((n, j) => [n, model.weights[j + 1]] as const).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [n, w] of ws) L.push(`| ${n} | ${w >= 0 ? "+" : ""}${w.toFixed(3)} |`);

  // --save: testten sonra TÜM maçlarla yeniden eğit, sitenin kullandığı dosyaya yaz
  if (process.argv.includes("--save")) {
    const all = [...train, ...test];
    const finalModel = fitPoisson(all.flatMap((s) => [s.home, s.away]), all.flatMap((s) => [s.m.homeScore, s.m.awayScore]), best!.l2);
    const finalRho = fitRho(all.map((s) => ({ lh: predictLambda(finalModel, s.home), la: predictLambda(finalModel, s.away), h: s.m.homeScore, a: s.m.awayScore })));
    const saved: SavedScoreModel = { trainedAt: new Date().toISOString(), trainedOn: all.length, features: FEATURE_NAMES, model: finalModel, rho: finalRho };
    writeFileSync("src/lib/score-model.json", JSON.stringify(saved, null, 2));
    L.push(``, `Site modeli kaydedildi: src/lib/score-model.json (${all.length} maç, ρ=${finalRho})`);
  }

  const report = L.join("\n");
  mkdirSync("reports", { recursive: true });
  const file = `reports/score-model-${split.toISOString().slice(0, 10)}.md`;
  writeFileSync(file, report);
  writeFileSync(`reports/score-model-${split.toISOString().slice(0, 10)}.json`, JSON.stringify({ features: FEATURE_NAMES, model, rho, l2: best!.l2 }, null, 2));
  console.log(report);
  console.log(`\nRapor: ${file} · ${((Date.now() - started) / 60000).toFixed(1)} dk`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
