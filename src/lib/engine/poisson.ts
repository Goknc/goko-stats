// Poisson skor modeli: iki takımın hücum/savunma gücünden beklenen golleri ve skor olasılıklarını hesaplar.
// Saf matematik; yapay zekâ veya rastgelelik yok, aynı girdi her zaman aynı sonucu verir.
//
// beklenen ev golü   = ev hücumu (evinde)       × dep. savunması (deplasmanda) × lig ev golü ort.
// beklenen dep. golü = dep. hücumu (deplasmanda) × ev savunması (evinde)      × lig dep. golü ort.
// Güç = takım ortalaması / lig ortalaması. Az maçlı takımın ortalaması lig ortalamasına çekilir (PRIOR_GAMES).

export const MAX_GOALS = 10; // skor matrisinin sınırı (0..10); üstü ihmal edilecek kadar küçük
export const PRIOR_GAMES = 5; // "lig ortalaması gibi oynadığı" varsayılan sanal maç sayısı

export interface GoalSample {
  games: number;
  scored: number; // toplam attığı
  conceded: number; // toplam yediği
}

export interface LeagueAverages {
  homeGoals: number; // ev sahiplerinin maç başı golü
  awayGoals: number; // deplasman takımlarının maç başı golü
}

export interface ScoreProb { home: number; away: number; p: number }

export interface Prediction {
  lambdaHome: number;
  lambdaAway: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  btts: number;
  mostLikely: ScoreProb;
  topScores: ScoreProb[]; // en olası 3 skor
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  // e^-λ · λ^k / k!  (çarpımla, faktöriyel taşmasın)
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

// Lig ortalamasına çekilmiş maç başı değer
export function shrunkRate(total: number, games: number, leagueRate: number, prior = PRIOR_GAMES): number {
  return (total + prior * leagueRate) / (games + prior);
}

export function expectedGoals(home: GoalSample, away: GoalSample, league: LeagueAverages) {
  const { homeGoals: lh, awayGoals: la } = league;
  const homeAttack = shrunkRate(home.scored, home.games, lh) / lh; // evinde attığı / ev sahibi ortalaması
  const homeDefense = shrunkRate(home.conceded, home.games, la) / la; // evinde yediği / deplasman ortalaması
  const awayAttack = shrunkRate(away.scored, away.games, la) / la;
  const awayDefense = shrunkRate(away.conceded, away.games, lh) / lh;
  return {
    lambdaHome: homeAttack * awayDefense * lh,
    lambdaAway: awayAttack * homeDefense * la,
  };
}

export function scoreMatrix(lambdaHome: number, lambdaAway: number): ScoreProb[] {
  const out: ScoreProb[] = [];
  for (let h = 0; h <= MAX_GOALS; h++) {
    const ph = poissonPmf(h, lambdaHome);
    for (let a = 0; a <= MAX_GOALS; a++) out.push({ home: h, away: a, p: ph * poissonPmf(a, lambdaAway) });
  }
  return out;
}

export function predict(home: GoalSample, away: GoalSample, league: LeagueAverages): Prediction {
  const { lambdaHome, lambdaAway } = expectedGoals(home, away, league);
  return predictFromLambdas(lambdaHome, lambdaAway);
}

// Beklenen goller başka yerde (ör. rakip gücü düzeltmeli puanlarla) hesaplandıysa doğrudan buradan
export function predictFromLambdas(lambdaHome: number, lambdaAway: number): Prediction {
  const cells = scoreMatrix(lambdaHome, lambdaAway);
  // Matris 10'da kesildiği için toplam 1'in hemen altında kalır; oranlar bu toplama bölünür
  const mass = cells.reduce((s, c) => s + c.p, 0);
  const sum = (test: (c: ScoreProb) => boolean) => cells.filter(test).reduce((s, c) => s + c.p, 0) / mass;

  const sorted = [...cells].sort((x, y) => y.p - x.p).map((c) => ({ ...c, p: c.p / mass }));
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
