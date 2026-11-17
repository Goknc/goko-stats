// src/lib/bsd/types.ts
// BSD API yanıt tipleri. Yalnızca kullandığımız alanlar tanımlı.

export interface BsdPage<T> {
  count: number; // güvenilmez, kullanma
  next: string | null;
  results: T[];
}

export interface BsdLeague {
  id: number;
  name: string;
  country: string;
  current_season: {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
  } | null;
}

export interface BsdEvent {
  id: number;
  league_id: number;
  season_id: number | null;
  home_team_id: number;
  home_team: string;
  away_team_id: number;
  away_team: string;
  event_date: string; // ISO, UTC
  status: string; // notstarted, inprogress, finished, postponed...
  replaced_by: number | null;
  round_number: number | null;
  stage: string | null;
  home_score: number | null;
  away_score: number | null;
  home_score_ht: number | null;
  away_score_ht: number | null;
}

export interface BsdTeamStats {
  corner_kicks: number | null;
  yellow_cards: number | null;
  red_cards?: number | null; // kart yoksa null veya hiç gelmeyebilir
  total_shots: number | null;
  shots_on_target: number | null;
  fouls: number | null;
  offsides: number | null;
}

export interface BsdEventStats {
  event_id: number;
  stats?: {
    home: BsdTeamStats;
    away: BsdTeamStats;
    first_half?: { home: BsdTeamStats; away: BsdTeamStats };
    second_half?: { home: BsdTeamStats; away: BsdTeamStats };
  };
}

export interface BsdPlayerStat {
  player_id: number | null; // bazı oyuncular id'siz gelir
  team_id: number;
  minutes_played: number;
  goals: number;
  goal_assist: number;
  total_shots: number;
  shots_on_target: number;
  yellow_card: number;
  red_card: number;
  total_tackle: number | null;
  fouls: number | null;
  // Detaylı alanlar (bazı liglerde hiç gelmeyebilir)
  rating?: number | null;
  touches?: number | null;
  key_pass?: number | null;
  total_pass?: number | null;
  accurate_pass?: number | null;
  total_long_balls?: number | null;
  accurate_long_balls?: number | null;
  total_cross?: number | null;
  accurate_cross?: number | null;
  total_contest?: number | null;
  won_contest?: number | null;
  duel_won?: number | null;
  duel_lost?: number | null;
  aerial_won?: number | null;
  aerial_lost?: number | null;
  won_tackle?: number | null;
  interception?: number | null;
  total_clearance?: number | null;
  ball_recovery?: number | null;
  outfielder_block?: number | null;
  dispossessed?: number | null;
  possession_lost?: number | null;
  was_fouled?: number | null;
  total_offside?: number | null;
  big_chance_created?: number | null;
  big_chance_missed?: number | null;
  hit_woodwork?: number | null;
  expected_goals?: number | null;
  expected_assists?: number | null;
  saves?: number | null;
  goals_conceded?: number | null;
}

export interface BsdPlayerStats {
  event_id: number;
  player_stats: BsdPlayerStat[];

}

export interface BsdLineupPlayer {
  id: number | null; // bazı oyuncular id'siz gelir
  name: string;
  position: string | null;
  jersey_number?: number | null;
}

// Maç öncesi sakat / cezalı listesi (status: injured, suspended...)
export interface BsdUnavailablePlayer {
  id: number | null;
  name: string;
  status: string | null;
  reason: string | null;
}

export interface BsdLineupSide {
  team_id: number;
  players: BsdLineupPlayer[]; // ilk 11
  substitutes: BsdLineupPlayer[];
}

export interface BsdLineups {
  event_id: number;
  lineup_status: "confirmed" | "predicted" | "unavailable";
  lineups: { home: BsdLineupSide; away: BsdLineupSide } | null;
  unavailable_players?: { home?: BsdUnavailablePlayer[]; away?: BsdUnavailablePlayer[] } | null;
}

export interface BsdSeason {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}
export interface BsdPlayerProfile {
  id: number;
  name: string;
  short_name: string | null;
  position: string | null;
  specific_position: string | null;
  jersey_number: number | null;
  date_of_birth: string | null; // YYYY-MM-DD
  height_cm: number | null;
  weight_kg: number | null;
  preferred_foot: string | null;
  nationality: string | null;
  current_team_id: number | null;
  current_team: { id: number; name: string } | null;
  national_team_id: number | null;
  national_team: { id: number; name: string } | null;
  market_value_eur: number | null;
  contract_until: string | null;
  availability: string | null;
  injury_type: string | null;
  injury_expected_return: string | null;
}

export interface BsdCareerSeason {
  season_id: number;
  league_id: number;
  team_id: number;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  avg_rating: number | null;
}

export interface BsdTransfer {
  id: number;
  transfer_date: string;
  from_team_id: number | null;
  from_team_name: string | null;
  to_team_id: number | null;
  to_team_name: string | null;
  fee_eur: number | null;
  fee_description: string | null;
  transfer_type: number | null;
}
