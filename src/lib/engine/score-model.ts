// src/lib/engine/score-model.ts
// Eğitilmiş skor modeli (deneysel). Saf fonksiyonlar; veritabanı yok.
//
// 1) FeatureState: bitmiş maçları tarih sırasıyla "oynatır" ve her an için takımların durumunu tutar
//    (Elo gücü, son dönem gol / şut / isabetli şut ortalamaları, sahaya göre ortalamalar, form, dinlenme,
//    aralarındaki maçlar, benzer güçteki rakiplere karşı performans, lig gol ortalaması).
//    Bir maçın özellikleri yalnızca o maçtan ÖNCE oynanan maçlardan çıkar (geleceği sızdırmaz).
// 2) Poisson regresyonu: log(beklenen gol) = ağırlıklar · özellikler. Her maç iki satır: ev sahibinin golü ve
//    deplasmanın golü (takımın hücum özellikleri + rakibin savunma özellikleri + ev sahibi mi).
// 3) Dixon–Coles düzeltmesi: düşük skorlu sonuçların (0-0, 1-0, 0-1, 1-1) olasılığını ayarlar.

const DAY = 86_400_000;
const EW = 0.12; // son dönem ortalamalarında yeni maçın ağırlığı (≈ son 8 maç belirleyici)
const ELO_K = 20;
const ELO_HOME = 60;
const SIMILAR_ELO = 100; // "benzer rakip": Elo farkı bundan az

export interface PlayedMatch {
  id: number;
  leagueId: number;
  eventDate: Date;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  // Takım istatistikleri (yoksa null)
  homeShots: number | null;
  awayShots: number | null;
  homeSot: number | null;
  awaySot: number | null;
}

interface Ewma { v: number; n: number }
const ew = (init: number): Ewma => ({ v: init, n: 0 });
function push(e: Ewma, x: number) {
  e.v = e.n === 0 ? x : e.v + EW * (x - e.v);
  e.n++;
}

interface TeamState {
  elo: number;
  games: number;
  gf: Ewma; ga: Ewma; // genel
  gfHome: Ewma; gaHome: Ewma; gfAway: Ewma; gaAway: Ewma; // sahaya göre
  shotsF: Ewma; shotsA: Ewma; sotF: Ewma; sotA: Ewma;
  points: number[]; // son maçların puanı (en yeni sonda)
  lastDate: number | null;
  history: { oppElo: number; gf: number; ga: number }[]; // benzer rakiplere karşı performans için
}

interface LeagueState { home: Ewma; away: Ewma }

export const FEATURE_NAMES = [
  "evSahibi",
  "eloFarkı",
  "golOrt", "golOrtSaha", "rakipYedigi", "rakipYedigiSaha",
  "şutOrt", "rakipŞutYedigi", "isabetliOrt", "rakipIsabetliYedigi",
  "ligGolOrt",
  "form", "rakipForm",
  "dinlenme", "rakipDinlenme",
  "aralarındaGol", "benzerRakipGol", "rakipBenzerYedigi",
  "azMaç", "rakipAzMaç",
] as const;

const lg = (x: number) => Math.log(Math.max(x, 0) + 0.25);

export class FeatureState {
  private teams = new Map<number, TeamState>();
  private leagues = new Map<number, LeagueState>();
  private h2h = new Map<string, { a: number; gf: number; ga: number }[]>(); // anahtar küçük-büyük id

  private team(id: number): TeamState {
    let t = this.teams.get(id);
    if (!t) {
      t = {
        elo: 1500, games: 0,
        gf: ew(1.35), ga: ew(1.35), gfHome: ew(1.5), gaHome: ew(1.2), gfAway: ew(1.2), gaAway: ew(1.5),
        shotsF: ew(12), shotsA: ew(12), sotF: ew(4), sotA: ew(4),
        points: [], lastDate: null, history: [],
      };
      this.teams.set(id, t);
    }
    return t;
  }

  private league(id: number): LeagueState {
    let l = this.leagues.get(id);
    if (!l) {
      l = { home: ew(1.5), away: ew(1.2) };
      this.leagues.set(id, l);
    }
    return l;
  }

  gamesOf(teamId: number): number {
    return this.teams.get(teamId)?.games ?? 0;
  }

  // Bir takımın gözünden özellik satırı (takım hücumu × rakip savunması)
  private row(teamId: number, oppId: number, isHome: boolean, leagueId: number, date: Date): number[] {
    const t = this.team(teamId);
    const o = this.team(oppId);
    const l = this.league(leagueId);
    const rest = (s: TeamState) => (s.lastDate === null ? 7 : Math.min(14, (date.getTime() - s.lastDate) / DAY));
    const form = (s: TeamState) => {
      const last = s.points.slice(-5);
      return last.length ? last.reduce((a, b) => a + b, 0) / last.length : 1.35;
    };
    const eloDiff = (t.elo + (isHome ? ELO_HOME : 0) - (o.elo + (isHome ? 0 : ELO_HOME))) / 400;

    // Aralarındaki maçlarda attığı gol (az maçta ortalamaya çekilir)
    const key = teamId < oppId ? `${teamId}-${oppId}` : `${oppId}-${teamId}`;
    const meetings = (this.h2h.get(key) ?? []).slice(-6);
    const h2hGoals = meetings.reduce((s, m) => s + (m.a === teamId ? m.gf : m.ga), 0);
    const h2h = (h2hGoals + 3 * t.gf.v) / (meetings.length + 3);

    // Benzer güçteki rakiplere karşı: takımın, bugünkü rakibe benzer Elo'lu rakiplere attığı;
    // rakibin, bu takıma benzer Elo'lu rakiplere yediği
    const similar = (s: TeamState, refElo: number, pick: "gf" | "ga", fallback: number) => {
      const xs = s.history.slice(-40).filter((h) => Math.abs(h.oppElo - refElo) < SIMILAR_ELO);
      return (xs.reduce((a, h) => a + h[pick], 0) + 4 * fallback) / (xs.length + 4);
    };

    return [
      isHome ? 1 : 0,
      eloDiff,
      lg(t.gf.v), lg(isHome ? t.gfHome.v : t.gfAway.v),
      lg(o.ga.v), lg(isHome ? o.gaAway.v : o.gaHome.v),
      lg(t.shotsF.v), lg(o.shotsA.v), lg(t.sotF.v), lg(o.sotA.v),
      lg(isHome ? l.home.v : l.away.v),
      form(t) / 3, form(o) / 3,
      rest(t) / 7, rest(o) / 7,
      lg(h2h),
      lg(similar(t, o.elo, "gf", t.gf.v)), lg(similar(o, t.elo, "ga", o.ga.v)),
      t.games < 8 ? 1 : 0, o.games < 8 ? 1 : 0,
    ];
  }

  features(m: { homeTeamId: number; awayTeamId: number; leagueId: number; eventDate: Date }): { home: number[]; away: number[] } {
    return {
      home: this.row(m.homeTeamId, m.awayTeamId, true, m.leagueId, m.eventDate),
      away: this.row(m.awayTeamId, m.homeTeamId, false, m.leagueId, m.eventDate),
    };
  }

  // Maç bitti: durumu güncelle
  update(m: PlayedMatch) {
    const h = this.team(m.homeTeamId);
    const a = this.team(m.awayTeamId);
    const l = this.league(m.leagueId);
    const hs = m.homeScore;
    const as = m.awayScore;
    const preH = h.elo;
    const preA = a.elo;

    // Elo (gol farkı çarpanlı)
    const expH = 1 / (1 + 10 ** ((preA - (preH + ELO_HOME)) / 400));
    const res = hs > as ? 1 : hs === as ? 0.5 : 0;
    const gd = Math.abs(hs - as);
    const mult = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
    const delta = ELO_K * mult * (res - expH);
    h.elo += delta;
    a.elo -= delta;

    push(h.gf, hs); push(h.ga, as); push(h.gfHome, hs); push(h.gaHome, as);
    push(a.gf, as); push(a.ga, hs); push(a.gfAway, as); push(a.gaAway, hs);
    if (m.homeShots !== null && m.awayShots !== null) {
      push(h.shotsF, m.homeShots); push(h.shotsA, m.awayShots);
      push(a.shotsF, m.awayShots); push(a.shotsA, m.homeShots);
    }
    if (m.homeSot !== null && m.awaySot !== null) {
      push(h.sotF, m.homeSot); push(h.sotA, m.awaySot);
      push(a.sotF, m.awaySot); push(a.sotA, m.homeSot);
    }
    push(l.home, hs);
    push(l.away, as);

    h.points.push(res === 1 ? 3 : res === 0.5 ? 1 : 0);
    a.points.push(res === 0 ? 3 : res === 0.5 ? 1 : 0);
    if (h.points.length > 10) h.points.shift();
    if (a.points.length > 10) a.points.shift();
    h.history.push({ oppElo: preA, gf: hs, ga: as });
    a.history.push({ oppElo: preH, gf: as, ga: hs });
    if (h.history.length > 60) h.history.shift();
    if (a.history.length > 60) a.history.shift();
    h.games++;
    a.games++;
    h.lastDate = a.lastDate = m.eventDate.getTime();

    const key = m.homeTeamId < m.awayTeamId ? `${m.homeTeamId}-${m.awayTeamId}` : `${m.awayTeamId}-${m.homeTeamId}`;
    const list = this.h2h.get(key) ?? [];
    list.push({ a: m.homeTeamId, gf: hs, ga: as });
    if (list.length > 10) list.shift();
    this.h2h.set(key, list);
  }
}

// ——— Poisson regresyonu (IRLS / Newton, L2 düzenlemeli) ———

export interface PoissonModel {
  mean: number[]; // standardizasyon
  std: number[];
  weights: number[]; // [sabit, ...özellikler]
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

export function fitPoisson(X: number[][], y: number[], l2 = 1, iterations = 25): PoissonModel {
  const d = X[0].length;
  const mean = Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[j], 0) / X.length);
  const std = Array.from({ length: d }, (_, j) => Math.sqrt(X.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / X.length) || 1);
  const Z = X.map((r) => [1, ...r.map((v, j) => (v - mean[j]) / std[j])]);
  const p = d + 1;
  const w = new Array(p).fill(0);
  w[0] = Math.log(y.reduce((s, v) => s + v, 0) / y.length);
  for (let it = 0; it < iterations; it++) {
    const H = Array.from({ length: p }, () => new Array(p).fill(0));
    const g = new Array(p).fill(0);
    for (let i = 0; i < Z.length; i++) {
      const z = Z[i];
      let eta = 0;
      for (let k = 0; k < p; k++) eta += w[k] * z[k];
      const mu = Math.exp(Math.min(eta, 5));
      const r = y[i] - mu;
      for (let k = 0; k < p; k++) {
        g[k] += r * z[k];
        const mz = mu * z[k];
        for (let j = k; j < p; j++) H[k][j] += mz * z[j];
      }
    }
    for (let k = 0; k < p; k++) {
      for (let j = 0; j < k; j++) H[k][j] = H[j][k];
      if (k > 0) {
        H[k][k] += l2;
        g[k] -= l2 * w[k];
      }
    }
    const step = solve(H, g);
    let maxStep = 0;
    for (let k = 0; k < p; k++) {
      w[k] += step[k];
      maxStep = Math.max(maxStep, Math.abs(step[k]));
    }
    if (maxStep < 1e-7) break;
  }
  return { mean, std, weights: w };
}

export function predictLambda(model: PoissonModel, x: number[]): number {
  let eta = model.weights[0];
  for (let j = 0; j < x.length; j++) eta += model.weights[j + 1] * ((x[j] - model.mean[j]) / model.std[j]);
  return Math.exp(Math.min(eta, 2));
}

// ——— Dixon–Coles ———

export function dcTau(h: number, a: number, lh: number, la: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

function pmf(k: number, l: number) {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
}

export function scoreProb(h: number, a: number, lh: number, la: number, rho: number): number {
  return Math.max(0, pmf(h, lh) * pmf(a, la) * dcTau(h, a, lh, la, rho));
}

// Dixon–Coles ρ: düşük skorlar için en olası değer (ızgara araması)
export function fitRho(rows: { lh: number; la: number; h: number; a: number }[]): number {
  let best = 0;
  let bestLL = -Infinity;
  for (let rho = -0.25; rho <= 0.25001; rho += 0.01) {
    let ll = 0;
    for (const r of rows) ll += Math.log(Math.max(1e-12, scoreProb(r.h, r.a, r.lh, r.la, rho)));
    if (ll > bestLL) {
      bestLL = ll;
      best = Math.round(rho * 100) / 100;
    }
  }
  return best;
}

// Eğitilmiş modelin kayıtlı hali (src/lib/score-model.json)
export interface SavedScoreModel {
  trainedAt: string;
  trainedOn: number; // maç sayısı
  features: readonly string[];
  model: PoissonModel;
  rho: number;
}

// Beklenen gollerden skor olasılıkları (Dixon–Coles düzeltmeli), mevcut Poisson modeliyle aynı şekil
export function predictDixonColes(lambdaHome: number, lambdaAway: number, rho: number) {
  const cells: { home: number; away: number; p: number }[] = [];
  for (let h = 0; h <= 10; h++) for (let a = 0; a <= 10; a++) cells.push({ home: h, away: a, p: scoreProb(h, a, lambdaHome, lambdaAway, rho) });
  const mass = cells.reduce((s, c) => s + c.p, 0);
  cells.forEach((c) => (c.p /= mass));
  const sum = (f: (c: { home: number; away: number }) => boolean) => cells.filter(f).reduce((s, c) => s + c.p, 0);
  const sorted = [...cells].sort((x, y) => y.p - x.p);
  return {
    lambdaHome,
    lambdaAway,
    homeWin: sum((c) => c.home > c.away),
    draw: sum((c) => c.home === c.away),
    awayWin: sum((c) => c.home < c.away),
    over25: sum((c) => c.home + c.away >= 3),
    btts: sum((c) => c.home > 0 && c.away > 0),
    mostLikely: sorted[0],
    topScores: sorted.slice(0, 3),
  };
}
