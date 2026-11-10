// Takım güç puanları: hücum ve savunma, RAKİP GÜCÜNE GÖRE düzeltilmiş.
//
// Bir maçta takımın beklenen golü = lig taban golü (ev/dep) × takımın hücumu × rakibin savunması.
// Puanlar, bu beklentinin gerçek gollere en iyi uyduğu değerlere tekrarlı olarak (iterasyonla) yerleşir:
// güçlü savunmaya atılan gol daha değerli, zayıf hücuma yenmeyen gol daha az değerli sayılır.
// 1.0 = lig ortalaması; 1.3 hücum = ortalamanın %30 fazlası gol; 0.8 savunma = %20 az gol yer (iyi).
//
// Saf fonksiyonlar; veritabanı yok.

export interface ScoredMatch {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  eventDate: Date;
}

export interface Ratings {
  attack: Map<number, number>;
  defense: Map<number, number>;
  homeBase: number; // lig ev sahibi maç başı golü (ağırlıklı)
  awayBase: number;
}

export interface Strength {
  attack: number;
  defense: number;
  games: number;
}

export const HALF_LIFE_DAYS = 180; // 6 ay önceki maç yarı ağırlıkta
export const RATING_PRIOR = 2; // beklenen gol cinsinden "ortalama takım" varsayımı (az maçta puanı 1'e çeker)
export const H2H_PRIOR = 6; // aralarındaki maçların etkisini sınırlar; büyüdükçe etki azalır
const ITERATIONS = 40;
const DAY = 86_400_000;

export function decayWeight(date: Date, asOf: Date, halfLifeDays = HALF_LIFE_DAYS): number {
  const ageDays = Math.max(0, (asOf.getTime() - date.getTime()) / DAY);
  return 0.5 ** (ageDays / halfLifeDays);
}

const get = (m: Map<number, number>, id: number) => m.get(id) ?? 1;

function normalize(m: Map<number, number>) {
  if (m.size === 0) return;
  const mean = [...m.values()].reduce((s, v) => s + v, 0) / m.size;
  for (const [k, v] of m) m.set(k, v / mean);
}

export function fitRatings(
  matches: ScoredMatch[],
  opts: { asOf: Date; halfLifeDays?: number; prior?: number },
): Ratings {
  const prior = opts.prior ?? RATING_PRIOR;
  const w = matches.map((m) => decayWeight(m.eventDate, opts.asOf, opts.halfLifeDays));
  const wSum = w.reduce((s, x) => s + x, 0);
  const homeBase = wSum ? matches.reduce((s, m, i) => s + w[i] * m.homeScore, 0) / wSum : 1.5;
  const awayBase = wSum ? matches.reduce((s, m, i) => s + w[i] * m.awayScore, 0) / wSum : 1.2;

  const teams = new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]));
  const attack = new Map([...teams].map((t) => [t, 1]));
  const defense = new Map([...teams].map((t) => [t, 1]));

  for (let it = 0; it < ITERATIONS; it++) {
    // Hücum: attığı gol / (rakip savunmasına göre beklenen gol)
    const aNum = new Map<number, number>();
    const aDen = new Map<number, number>();
    const add = (map: Map<number, number>, id: number, v: number) => map.set(id, (map.get(id) ?? 0) + v);
    matches.forEach((m, i) => {
      add(aNum, m.homeTeamId, w[i] * m.homeScore);
      add(aDen, m.homeTeamId, w[i] * homeBase * get(defense, m.awayTeamId));
      add(aNum, m.awayTeamId, w[i] * m.awayScore);
      add(aDen, m.awayTeamId, w[i] * awayBase * get(defense, m.homeTeamId));
    });
    for (const t of teams) attack.set(t, ((aNum.get(t) ?? 0) + prior) / ((aDen.get(t) ?? 0) + prior));
    normalize(attack);

    // Savunma: yediği gol / (rakip hücumuna göre beklenen gol). Küçük = iyi savunma.
    const dNum = new Map<number, number>();
    const dDen = new Map<number, number>();
    matches.forEach((m, i) => {
      add(dNum, m.homeTeamId, w[i] * m.awayScore);
      add(dDen, m.homeTeamId, w[i] * awayBase * get(attack, m.awayTeamId));
      add(dNum, m.awayTeamId, w[i] * m.homeScore);
      add(dDen, m.awayTeamId, w[i] * homeBase * get(attack, m.homeTeamId));
    });
    for (const t of teams) defense.set(t, ((dNum.get(t) ?? 0) + prior) / ((dDen.get(t) ?? 0) + prior));
    normalize(defense);
  }

  return { attack, defense, homeBase, awayBase };
}

// Bir takımın FORMU: yalnızca verilen maçlar (son 10 iç saha + son 10 deplasman), rakip gücüne göre düzeltilmiş.
// Rakiplerin puanları lig genelinden (ratings) gelir.
export function teamForm(teamId: number, games: ScoredMatch[], r: Ratings, prior = RATING_PRIOR): Strength {
  let scored = 0;
  let conceded = 0;
  let expScored = 0;
  let expConceded = 0;
  for (const m of games) {
    const home = m.homeTeamId === teamId;
    const opp = home ? m.awayTeamId : m.homeTeamId;
    scored += home ? m.homeScore : m.awayScore;
    conceded += home ? m.awayScore : m.homeScore;
    expScored += (home ? r.homeBase : r.awayBase) * get(r.defense, opp);
    expConceded += (home ? r.awayBase : r.homeBase) * get(r.attack, opp);
  }
  return {
    attack: (scored + prior) / (expScored + prior),
    defense: (conceded + prior) / (expConceded + prior),
    games: games.length,
  };
}

// Aralarındaki maçlarda A, B'ye karşı (güçlerine göre) beklenenden ne kadar fazla/az gol attı.
// 1 = beklendiği kadar; 1.2 = %20 fazla. H2H_PRIOR sayesinde az maçta 1'e yakın kalır.
export function h2hMultiplier(
  games: ScoredMatch[],
  teamA: number,
  a: Strength,
  b: Strength,
  r: Ratings,
  prior = H2H_PRIOR,
): number {
  let actual = 0;
  let expected = 0;
  for (const m of games) {
    const aHome = m.homeTeamId === teamA;
    actual += aHome ? m.homeScore : m.awayScore;
    expected += (aHome ? r.homeBase : r.awayBase) * a.attack * b.defense;
  }
  return (actual + prior) / (expected + prior);
}

export interface RatedLambdas {
  lambdaHome: number;
  lambdaAway: number;
  h2hHome: number; // uygulanan çarpanlar (gösterim / yorum için)
  h2hAway: number;
}

export function ratedLambdas(home: Strength, away: Strength, r: Ratings, h2h: { home: number; away: number } = { home: 1, away: 1 }): RatedLambdas {
  return {
    lambdaHome: r.homeBase * home.attack * away.defense * h2h.home,
    lambdaAway: r.awayBase * away.attack * home.defense * h2h.away,
    h2hHome: h2h.home,
    h2hAway: h2h.away,
  };
}

// ── Güç grupları (kart için) ─────────────────────────────────

export type Tier = "top" | "mid" | "bottom";

// Genel güç = hücum / savunma (yüksek iyi). Lig üçe bölünür.
export function tiersOf(r: Ratings): Map<number, Tier> {
  const ranked = [...r.attack.keys()].sort((x, y) => get(r.attack, y) / get(r.defense, y) - get(r.attack, x) / get(r.defense, x));
  const n = ranked.length;
  return new Map(ranked.map((id, i) => [id, i < n / 3 ? "top" : i < (2 * n) / 3 ? "mid" : "bottom"]));
}

export interface TierRecord {
  tier: Tier;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
}

// Takımın, verilen gruptaki rakiplere karşı karnesi
export function recordVsTier(teamId: number, matches: ScoredMatch[], tiers: Map<number, Tier>, tier: Tier): TierRecord {
  const rec: TierRecord = { tier, games: 0, wins: 0, draws: 0, losses: 0, scored: 0, conceded: 0 };
  for (const m of matches) {
    const home = m.homeTeamId === teamId;
    if (!home && m.awayTeamId !== teamId) continue;
    const opp = home ? m.awayTeamId : m.homeTeamId;
    if (tiers.get(opp) !== tier) continue;
    const gf = home ? m.homeScore : m.awayScore;
    const ga = home ? m.awayScore : m.homeScore;
    rec.games++;
    rec.scored += gf;
    rec.conceded += ga;
    if (gf > ga) rec.wins++;
    else if (gf === ga) rec.draws++;
    else rec.losses++;
  }
  return rec;
}
