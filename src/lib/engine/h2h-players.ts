// src/lib/engine/h2h-players.ts
// Aralarındaki maçlarda öne çıkan oyuncular: son karşılaşmalarda en az N maçta gol ya da asisti olanlar.
// Yalnızca hâlâ aynı takımda oynayanlar sayılır (son maçı o takımla). Saf fonksiyon, veritabanı yok.

export interface H2HPlayerLine {
  matchId: number;
  playerId: number;
  name: string;
  teamId: number; // o karşılaşmada oynadığı takım
  goals: number;
  assists: number;
  minutesPlayed: number;
}

export interface H2HPlayerSummary {
  playerId: number;
  name: string;
  teamId: number;
  games: number; // bu karşılaşmalarda oynadığı maç
  goals: number;
  goalGames: number; // gol attığı maç sayısı
  assists: number;
  assistGames: number;
}

export interface H2HPlayers {
  matches: number; // oyuncu verisi olan karşılaşma sayısı
  home: H2HPlayerSummary[];
  away: H2HPlayerSummary[];
}

// "Öne çıkan" için en az kaç maçta gol veya asist
export const H2H_PLAYER_MIN_GAMES = 2;

export function summarizeH2HPlayers(
  lines: H2HPlayerLine[],
  matches: number,
  homeId: number,
  awayId: number,
  currentTeam: Map<number, number>, // oyuncu → son maçındaki takım
  minGames = H2H_PLAYER_MIN_GAMES,
): H2HPlayers {
  const byPlayer = new Map<number, H2HPlayerSummary>();
  for (const l of lines) {
    if (l.minutesPlayed <= 0) continue;
    if (currentTeam.get(l.playerId) !== l.teamId) continue; // takımdan ayrılmış (ya da karşı tarafa geçmiş)
    const s = byPlayer.get(l.playerId) ?? {
      playerId: l.playerId, name: l.name, teamId: l.teamId, games: 0, goals: 0, goalGames: 0, assists: 0, assistGames: 0,
    };
    s.games++;
    s.goals += l.goals;
    s.assists += l.assists;
    if (l.goals > 0) s.goalGames++;
    if (l.assists > 0) s.assistGames++;
    byPlayer.set(l.playerId, s);
  }

  const notable = [...byPlayer.values()]
    .filter((s) => s.goalGames >= minGames || s.assistGames >= minGames)
    .sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals || a.name.localeCompare(b.name, "tr"));

  return {
    matches,
    home: notable.filter((s) => s.teamId === homeId),
    away: notable.filter((s) => s.teamId === awayId),
  };
}
