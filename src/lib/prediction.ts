// Maçın Poisson tahmini: veritabanından okur, hesabı motora (engine/ratings + engine/poisson) bırakır.
//
// 1) Lig geneli güç puanları: ligdeki bütün takımlar, birbirlerine karşı skorlarından (rakip gücü düzeltmeli,
//    yeni maçlar daha ağırlıklı).
// 2) İki takımın formu: son 10 iç saha + son 10 deplasman lig maçı, rakiplerin puanına göre düzeltilmiş.
// 3) Aralarındaki maçlar: beklenenden fazla/az gol attıysa küçük, maç sayısıyla büyüyen bir çarpan.
//
// Skor olasılıkları varsayılan olarak eğitilmiş modelden gelir (score-model-live; testte bu Poisson modelinden
// her ölçüde iyi çıktı). Takımlardan birinin yeterli maçı yoksa bu Poisson modeli kullanılır.
// Güç puanları, benzer rakip karnesi ve aralarındaki maçlar bilgisi her durumda bu dosyadan.
import { prisma } from "./prisma";
import { windowStartFor, teamHistory } from "./analysis";
import { canonicalLeagueId } from "./engine/leagues";
import { selectTeamSample, type MatchContext, type TeamHistoryMatch } from "./engine/selection";
import { predictFromLambdas, type Prediction } from "./engine/poisson";
import { trainedPredict } from "./score-model-live";
import {
  fitRatings, teamForm, h2hMultiplier, ratedLambdas, tiersOf, recordVsTier,
  type ScoredMatch, type Strength, type TierRecord, type Tier,
} from "./engine/ratings";

export interface MatchPrediction {
  prediction: Prediction;
  home: Strength;
  away: Strength;
  h2h: { games: number; home: number; away: number }; // uygulanan çarpanlar
  tiers: {
    home: Tier | null; // ev sahibinin grubu
    away: Tier | null;
    homeVsAwayTier: TierRecord; // ev sahibi, rakibin grubundaki takımlara karşı
    awayVsHomeTier: TierRecord; // rakip, ev sahibinin grubundaki takımlara karşı
  };
  lowSample: boolean;
  source: "trained" | "poisson"; // olasılıklar hangi modelden
}

const MIN_FORM_GAMES = 6;

const scored = <T extends { homeScore: number | null; awayScore: number | null }>(xs: T[]) =>
  xs.filter((m): m is T & { homeScore: number; awayScore: number } => m.homeScore !== null && m.awayScore !== null);

const toScored = (m: TeamHistoryMatch & { homeScore: number; awayScore: number }): ScoredMatch => ({
  homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeScore: m.homeScore, awayScore: m.awayScore, eventDate: m.eventDate,
});

// model: "poisson" eski modeli zorlar (karşılaştırma scriptleri için)
export async function predictMatch(matchId: number, options: { model?: "auto" | "poisson" } = {}): Promise<MatchPrediction | null> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { league: true } });
  if (!match) return null;

  const target: MatchContext = {
    eventDate: match.eventDate,
    leagueId: canonicalLeagueId(match.leagueId),
    competitionType: match.league.competitionType,
  };
  const windowStart = await windowStartFor(target);
  const opts = { target, windowStart };

  const [leagueRows, homeHistory, awayHistory, h2hRows] = await Promise.all([
    // Lig geneli: puanlar için bütün maçlar
    prisma.match.findMany({
      where: {
        leagueId: { in: [...new Set([match.leagueId, target.leagueId])] },
        status: "finished",
        eventDate: { gte: windowStart, lt: match.eventDate },
      },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, eventDate: true },
    }),
    teamHistory(match.homeTeamId, windowStart, match.eventDate),
    teamHistory(match.awayTeamId, windowStart, match.eventDate),
    // Aralarındaki maçlar: bütün turnuvalar, skor arşivi dahil
    prisma.match.findMany({
      where: {
        status: "finished",
        eventDate: { lt: match.eventDate },
        OR: [
          { homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId },
          { homeTeamId: match.awayTeamId, awayTeamId: match.homeTeamId },
        ],
      },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, eventDate: true },
    }),
  ]);

  const leagueMatches = scored(leagueRows);
  const ratings = fitRatings(leagueMatches, { asOf: match.eventDate });

  // Form örneği: son 10 iç saha + son 10 deplasman (takım trendleriyla aynı seçim kuralı)
  const formOf = (history: TeamHistoryMatch[], teamId: number) => [
    ...selectTeamSample(history, teamId, "home", opts).items,
    ...selectTeamSample(history, teamId, "away", opts).items,
  ];
  const homeGames = scored(formOf(homeHistory, match.homeTeamId)).map(toScored);
  const awayGames = scored(formOf(awayHistory, match.awayTeamId)).map(toScored);
  const home = teamForm(match.homeTeamId, homeGames, ratings);
  const away = teamForm(match.awayTeamId, awayGames, ratings);

  const h2hGames = scored(h2hRows);
  const h2h = {
    games: h2hGames.length,
    home: h2hMultiplier(h2hGames, match.homeTeamId, home, away, ratings),
    away: h2hMultiplier(h2hGames, match.awayTeamId, away, home, ratings),
  };

  const { lambdaHome, lambdaAway } = ratedLambdas(home, away, ratings, h2h);

  const tiers = tiersOf(ratings);
  const homeTier = tiers.get(match.homeTeamId) ?? null;
  const awayTier = tiers.get(match.awayTeamId) ?? null;

  const trained = options.model === "poisson" ? null : await trainedPredict(match);

  return {
    prediction: trained?.prediction ?? predictFromLambdas(lambdaHome, lambdaAway),
    source: trained ? "trained" : "poisson",
    home,
    away,
    h2h,
    tiers: {
      home: homeTier,
      away: awayTier,
      homeVsAwayTier: recordVsTier(match.homeTeamId, leagueMatches, tiers, awayTier ?? "mid"),
      awayVsHomeTier: recordVsTier(match.awayTeamId, leagueMatches, tiers, homeTier ?? "mid"),
    },
    lowSample: !trained && (home.games < MIN_FORM_GAMES || away.games < MIN_FORM_GAMES),
  };
}
