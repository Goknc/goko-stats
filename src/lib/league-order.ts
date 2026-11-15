// Maç listesinde liglerin sırası: popüler ligler üstte, aşağı indikçe daha az popüler olanlar.
// Listede olmayan lig en alta düşer (kendi aralarında alfabetik).
// İsimler DB'deki league.name ile eşleşir (büyük/küçük harf ve aksan farkı önemsiz).
import { trLeague } from "./team-names";

const POPULARITY = [
  // Avrupa kupaları
  "Champions League",
  "Europa League",
  "Conference League",
  "UEFA Super Cup",
  // Milli takımlar (büyük turnuvalar)
  "World Cup",
  "UEFA Euro",
  "UEFA Nations League",
  "World Cup Qualification UEFA",
  // Büyük 5 + Süper Lig
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Süper Lig",
  // Ulusal kupalar
  "Türkiye Kupası",
  "FA Cup",
  "Carabao Cup",
  "Copa del Rey",
  "Coppa Italia",
  "DFB Pokal",
  "Coupe de France",
  // Diğer üst ligler
  "Eredivisie",
  "Liga Portugal",
  "Pro League",
  "Scottish Premiership",
  "Brasileirão Série A",
  "Copa Libertadores",
  "Copa Sudamericana",
  "MLS",
  "Liga Profesional",
  "Saudi Pro League",
  "Greek Super League",
  // İkinci ligler
  "1. Lig",
  "Championship",
  "2. Bundesliga",
  "Serie B",
  "LaLiga 2",
  "Ligue 2",
  "Liga Portugal 2",
  "Eerste Divisie",
  "Challenger Pro League",
  "Taça de Portugal",
  // Kuzey ve Orta Avrupa
  "Austrian Bundesliga",
  "Swiss Super League",
  "Danish Superliga",
  "Czech First League",
  "Eliteserien",
  "Allsvenskan",
  "Ekstraklasa",
  // Diğer milli takım turnuvaları
  "Copa America",
  "Africa Cup of Nations",
  "AFC Asian Cup",
  "CONCACAF Gold Cup",
  "World Cup Qualification CONMEBOL",
];

const norm = (s: string) =>
  s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Ekranda turnuva adları Türkçe görünür (lib/team-names); sıra iki adla da bulunur
const RANK = new Map(POPULARITY.flatMap((name, i) => [[norm(name), i], [norm(trLeague(name)), i]] as [string, number][]));

export function leagueRank(name: string): number {
  return RANK.get(norm(name)) ?? POPULARITY.length;
}

export function byLeaguePopularity(a: string, b: string): number {
  return leagueRank(a) - leagueRank(b) || a.localeCompare(b, "tr");
}
