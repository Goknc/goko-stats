// src/lib/engine/leagues.ts
// Aynı ligin farklı turnuva id'leri tek lig sayılır.
// Meksika: Apertura (19) ve Clausura (20) aynı lig, sezonun iki yarısı.
const LEAGUE_ALIASES: Record<number, number> = { 20: 19 };

export const canonicalLeagueId = (leagueId: number) => LEAGUE_ALIASES[leagueId] ?? leagueId;
// Milli takım turnuvaları (BSD lig id'leri): Dünya Kupası ve elemeleri, Uluslar Ligi, kıta şampiyonaları.
// Bu turnuvalardaki takımlar milli takım sayılır: oyuncu tablosundaki "yalnızca milli takım" seçimi ve
// tahmini kadroda "o arada kadroya çağrılanlar" kuralı buna dayanır.
export const NATIONAL_TEAM_LEAGUES: ReadonlySet<number> = new Set([27, 30, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69]);
export const isNationalTeamLeague = (leagueId: number) => NATIONAL_TEAM_LEAGUES.has(canonicalLeagueId(leagueId));
