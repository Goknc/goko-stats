// scripts/sync-seasons.ts
// Takip edilen liglerin tüm sezonlarını çeker.
import { prisma } from "../src/lib/prisma";
import { bsd } from "../src/lib/bsd/client";
import { runJob } from "./lib/run-job";

runJob("seasons", async () => {
  const leagues = await prisma.league.findMany({ where: { isTracked: true } });

  for (const league of leagues) {
    const seasons = await bsd.leagueSeasons(league.id);
    for (const s of seasons) {
      const data = {
        leagueId: league.id,
        name: s.name,
        startDate: new Date(s.start_date),
        endDate: new Date(s.end_date),
        isCurrent: s.is_current,
      };
      await prisma.season.upsert({ where: { id: s.id }, update: data, create: { id: s.id, ...data } });
    }
    console.log(`${league.name}: ${seasons.length} sezon`);
  }
});