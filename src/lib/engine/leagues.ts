// src/lib/engine/leagues.ts
// Aynı ligin farklı turnuva id'leri tek lig sayılır.
// Meksika: Apertura (19) ve Clausura (20) aynı lig, sezonun iki yarısı.
const LEAGUE_ALIASES: Record<number, number> = { 20: 19 };

export const canonicalLeagueId = (leagueId: number) => LEAGUE_ALIASES[leagueId] ?? leagueId;