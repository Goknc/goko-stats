// prisma/seed.ts
// Takip edilen ligleri veritabanına yükler. Liste BSD'deki tüm erkek futbolu turnuvalarıdır (GET /leagues/).
// Kıta kulüp kupaları (Libertadores dahil) EUROPE, ulusal kupalar ve milli takım turnuvaları CUP tipindedir.
// Birden fazla kez çalıştırılabilir; kayıtları çoğaltmaz, günceller.
// Trend tanımları kodda: src/lib/trend-config.ts
import { prisma } from "../src/lib/prisma";

type LeagueSeed = {
  id: number;
  name: string;
  country: string;
  competitionType: "LEAGUE" | "EUROPE" | "CUP" | "FRIENDLY";
  playerStatsEnabled: boolean;
};

const leagues: LeagueSeed[] = [
  // ---------- Oyuncu verisi açık ----------
  // Üst ligler
  { id: 1, name: "Premier League", country: "England", competitionType: "LEAGUE", playerStatsEnabled: true },
  { id: 3, name: "La Liga", country: "Spain", competitionType: "LEAGUE", playerStatsEnabled: true },
  { id: 4, name: "Serie A", country: "Italy", competitionType: "LEAGUE", playerStatsEnabled: true },
  { id: 5, name: "Bundesliga", country: "Germany", competitionType: "LEAGUE", playerStatsEnabled: true },
  { id: 6, name: "Ligue 1", country: "France", competitionType: "LEAGUE", playerStatsEnabled: true },
  { id: 11, name: "Süper Lig", country: "Turkey", competitionType: "LEAGUE", playerStatsEnabled: true },
  { id: 2, name: "Liga Portugal", country: "Portugal", competitionType: "LEAGUE", playerStatsEnabled: true },
  { id: 10, name: "Eredivisie", country: "Netherlands", competitionType: "LEAGUE", playerStatsEnabled: true },
  { id: 9, name: "Brasileirão Série A", country: "Brazil", competitionType: "LEAGUE", playerStatsEnabled: true },
  { id: 18, name: "MLS", country: "USA", competitionType: "LEAGUE", playerStatsEnabled: true },
  // Kıta kupaları (kulüp)
  { id: 7, name: "Champions League", country: "Europe", competitionType: "EUROPE", playerStatsEnabled: true },
  { id: 8, name: "Europa League", country: "Europe", competitionType: "EUROPE", playerStatsEnabled: true },
  { id: 83, name: "Conference League", country: "Europe", competitionType: "EUROPE", playerStatsEnabled: true },
  { id: 90, name: "UEFA Super Cup", country: "Europe", competitionType: "EUROPE", playerStatsEnabled: true },
  { id: 32, name: "Copa Libertadores", country: "South America", competitionType: "EUROPE", playerStatsEnabled: true },
  { id: 33, name: "Copa Sudamericana", country: "South America", competitionType: "EUROPE", playerStatsEnabled: true },
  // Ulusal kupalar
  { id: 110, name: "Türkiye Kupası", country: "Turkey", competitionType: "CUP", playerStatsEnabled: true },
  { id: 39, name: "FA Cup", country: "England", competitionType: "CUP", playerStatsEnabled: true },
  { id: 40, name: "Carabao Cup", country: "England", competitionType: "CUP", playerStatsEnabled: true },
  { id: 41, name: "Copa del Rey", country: "Spain", competitionType: "CUP", playerStatsEnabled: true },
  { id: 42, name: "Coppa Italia", country: "Italy", competitionType: "CUP", playerStatsEnabled: true },
  { id: 43, name: "DFB Pokal", country: "Germany", competitionType: "CUP", playerStatsEnabled: true },
  { id: 44, name: "Coupe de France", country: "France", competitionType: "CUP", playerStatsEnabled: true },
  { id: 92, name: "Taça de Portugal", country: "Portugal", competitionType: "CUP", playerStatsEnabled: true },
  // Milli takım turnuvaları
  { id: 27, name: "World Cup", country: "International", competitionType: "CUP", playerStatsEnabled: true },
  { id: 66, name: "UEFA Euro", country: "Europe", competitionType: "CUP", playerStatsEnabled: true },
  { id: 64, name: "UEFA Nations League", country: "Europe", competitionType: "CUP", playerStatsEnabled: true },
  { id: 58, name: "World Cup Qualification UEFA", country: "Europe", competitionType: "CUP", playerStatsEnabled: true },

  // ---------- Yalnızca takım istatistikleri ----------
  // İkinci ve alt ligler
  { id: 107, name: "1. Lig", country: "Turkey", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 12, name: "Championship", country: "England", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 86, name: "League One", country: "England", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 87, name: "League Two", country: "England", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 91, name: "National League", country: "England", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 38, name: "LaLiga 2", country: "Spain", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 94, name: "2. Bundesliga", country: "Germany", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 100, name: "Serie B", country: "Italy", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 101, name: "Serie C, Girone A", country: "Italy", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 103, name: "Serie C, Girone B", country: "Italy", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 102, name: "Serie C, Girone C", country: "Italy", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 89, name: "Ligue 2", country: "France", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 105, name: "Ligue 3", country: "France", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 88, name: "Liga Portugal 2", country: "Portugal", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 82, name: "Liga 3", country: "Portugal", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 95, name: "Campeonato de Portugal", country: "Portugal", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 108, name: "Eerste Divisie", country: "Netherlands", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 97, name: "Challenger Pro League", country: "Belgium", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 34, name: "Brasileirão Série B", country: "Brazil", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 106, name: "Superettan", country: "Sweden", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 57, name: "USL Championship", country: "USA", competitionType: "LEAGUE", playerStatsEnabled: false },
  // Avrupa'nın diğer üst ligleri
  { id: 14, name: "Pro League", country: "Belgium", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 13, name: "Scottish Premiership", country: "Scotland", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 96, name: "Austrian Bundesliga", country: "Austria", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 15, name: "Swiss Super League", country: "Switzerland", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 24, name: "Greek Super League", country: "Greece", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 84, name: "Danish Superliga", country: "Denmark", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 25, name: "Ekstraklasa", country: "Poland", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 54, name: "Eliteserien", country: "Norway", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 26, name: "Allsvenskan", country: "Sweden", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 55, name: "Veikkausliiga", country: "Finland", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 99, name: "Czech First League", country: "Czech Republic", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 23, name: "Romanian Superliga", country: "Romania", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 22, name: "Parva Liga", country: "Bulgaria", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 109, name: "Niké liga", country: "Slovakia", competitionType: "LEAGUE", playerStatsEnabled: false },
  // Amerika, Asya, Afrika, Okyanusya
  { id: 85, name: "Liga Profesional", country: "Argentina", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 80, name: "Categoría Primera A", country: "Colombia", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 19, name: "Liga MX Apertura", country: "Mexico", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 20, name: "Liga MX Clausura", country: "Mexico", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 17, name: "Saudi Pro League", country: "Saudi Arabia", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 52, name: "Chinese Super League", country: "China", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 49, name: "J1 League", country: "Japan", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 50, name: "K League 1", country: "South Korea", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 104, name: "A-League Men", country: "Australia", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 70, name: "NPL Queensland", country: "Australia", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 53, name: "Botola Pro", country: "Morocco", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 47, name: "Tunisian Ligue 1", country: "Tunisia", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 28, name: "Nigeria Premier Football League", country: "Nigeria", competitionType: "LEAGUE", playerStatsEnabled: false },
  { id: 98, name: "Girabola", country: "Angola", competitionType: "LEAGUE", playerStatsEnabled: false },
  // Diğer kupalar
  { id: 93, name: "Taça da Liga", country: "Portugal", competitionType: "CUP", playerStatsEnabled: false },
  { id: 46, name: "Puchar Polski", country: "Poland", competitionType: "CUP", playerStatsEnabled: false },
  { id: 35, name: "Copa do Brasil", country: "Brazil", competitionType: "CUP", playerStatsEnabled: false },
  { id: 81, name: "Copa Colombia", country: "Colombia", competitionType: "CUP", playerStatsEnabled: false },
  { id: 51, name: "Emperor Cup", country: "Japan", competitionType: "CUP", playerStatsEnabled: false },
  { id: 56, name: "Suomen Cup", country: "Finland", competitionType: "CUP", playerStatsEnabled: false },
  { id: 48, name: "Coupe de Tunisie", country: "Tunisia", competitionType: "CUP", playerStatsEnabled: false },
  { id: 29, name: "CAF Champions League", country: "Africa", competitionType: "EUROPE", playerStatsEnabled: false },
  // Diğer milli takım turnuvaları
  { id: 67, name: "Copa America", country: "South America", competitionType: "CUP", playerStatsEnabled: false },
  { id: 30, name: "Africa Cup of Nations", country: "Africa", competitionType: "CUP", playerStatsEnabled: false },
  { id: 68, name: "AFC Asian Cup", country: "Asia", competitionType: "CUP", playerStatsEnabled: false },
  { id: 69, name: "CONCACAF Gold Cup", country: "North America", competitionType: "CUP", playerStatsEnabled: false },
  { id: 65, name: "CONCACAF Nations League", country: "North America", competitionType: "CUP", playerStatsEnabled: false },
  { id: 71, name: "UEFA European U19 Championship", country: "Europe", competitionType: "CUP", playerStatsEnabled: false },
  { id: 59, name: "World Cup Qualification CONMEBOL", country: "South America", competitionType: "CUP", playerStatsEnabled: false },
  { id: 60, name: "World Cup Qualification CAF", country: "Africa", competitionType: "CUP", playerStatsEnabled: false },
  { id: 61, name: "World Cup Qualification AFC", country: "Asia", competitionType: "CUP", playerStatsEnabled: false },
  { id: 62, name: "World Cup Qualification CONCACAF", country: "North America", competitionType: "CUP", playerStatsEnabled: false },
  { id: 63, name: "World Cup Qualification OFC", country: "Oceania", competitionType: "CUP", playerStatsEnabled: false },
  // Takip edilmeyenler (BSD'de var): Liga F (36) ve NWSL (72) kadın ligleri, hazırlık maçları (31, 79)
];

async function main() {
  for (const league of leagues) {
    const data = { ...league, isTracked: true };
    await prisma.league.upsert({ where: { id: league.id }, update: data, create: data });
  }
  console.log(`${leagues.length} lig yüklendi (${leagues.filter((l) => l.playerStatsEnabled).length} tanesinde oyuncu verisi açık)`);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());