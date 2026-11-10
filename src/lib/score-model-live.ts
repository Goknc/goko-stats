// src/lib/score-model-live.ts
// Eğitilmiş skor modelini sitede çalıştırır (model: src/lib/score-model.json, eğitim: scripts/train-score-model.ts --save).
// Takım durumları bütün bitmiş maçlar tarih sırasıyla oynatılarak çıkar; maç gününün başına kadarki durum
// gün bazında önbellekte tutulur (bugünün bütün maçları aynı durumu paylaşır, geçmiş maç kendi gününden öncesini görür).
import saved from "./score-model.json";
import { prisma } from "./prisma";
import { cached } from "./ttl-cache";
import { canonicalLeagueId } from "./engine/leagues";
import { FeatureState, predictDixonColes, predictLambda, type PlayedMatch, type SavedScoreModel } from "./engine/score-model";
import type { Prediction } from "./engine/poisson";

const model = saved as SavedScoreModel;
const STATE_TTL_MS = 30 * 60 * 1000;
export const TRAINED_MIN_GAMES = 5; // eğitimdeki gibi: iki takımın da en az bu kadar maçı olmalı

export const trainedModelInfo = { trainedAt: model.trainedAt, trainedOn: model.trainedOn };

// İstanbul saatine göre gün anahtarı ve günün başlangıcı
function dayStart(date: Date): { key: string; start: Date } {
  const key = new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
  return { key, start: new Date(`${key}T00:00:00+03:00`) };
}

async function stateBefore(start: Date): Promise<FeatureState> {
  const raw = await prisma.match.findMany({
    where: { status: "finished", homeScore: { not: null }, awayScore: { not: null }, eventDate: { lt: start } },
    select: {
      id: true, leagueId: true, eventDate: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
      teamStats: { where: { period: "FULL" }, select: { isHome: true, shotsTotal: true, shotsOnTarget: true } },
    },
    orderBy: { eventDate: "asc" },
  });
  const state = new FeatureState();
  for (const m of raw) {
    const h = m.teamStats.find((s) => s.isHome);
    const a = m.teamStats.find((s) => !s.isHome);
    const played: PlayedMatch = {
      id: m.id, leagueId: canonicalLeagueId(m.leagueId), eventDate: m.eventDate, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeScore: m.homeScore!, awayScore: m.awayScore!,
      homeShots: h?.shotsTotal ?? null, awayShots: a?.shotsTotal ?? null, homeSot: h?.shotsOnTarget ?? null, awaySot: a?.shotsOnTarget ?? null,
    };
    state.update(played);
  }
  return state;
}

export interface TrainedPrediction {
  prediction: Prediction;
  homeGames: number;
  awayGames: number;
}

// Takımlardan birinin yeterli maçı yoksa null (çağıran eski modele döner)
export async function trainedPredict(m: { homeTeamId: number; awayTeamId: number; leagueId: number; eventDate: Date }): Promise<TrainedPrediction | null> {
  const { key, start } = dayStart(m.eventDate);
  const state = await cached(`score-state:${key}`, STATE_TTL_MS, () => stateBefore(start));
  const homeGames = state.gamesOf(m.homeTeamId);
  const awayGames = state.gamesOf(m.awayTeamId);
  if (homeGames < TRAINED_MIN_GAMES || awayGames < TRAINED_MIN_GAMES) return null;
  const f = state.features({ ...m, leagueId: canonicalLeagueId(m.leagueId) });
  const lh = predictLambda(model.model, f.home);
  const la = predictLambda(model.model, f.away);
  return { prediction: predictDixonColes(lh, la, model.rho), homeGames, awayGames };
}
