-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'EUROPE', 'CUP', 'FRIENDLY');

-- CreateEnum
CREATE TYPE "Period" AS ENUM ('FULL', 'H1', 'H2');

-- CreateEnum
CREATE TYPE "LineupStatus" AS ENUM ('CONFIRMED', 'PREDICTED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "leagues" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "competitionType" "CompetitionType" NOT NULL,
    "isTracked" BOOLEAN NOT NULL DEFAULT false,
    "playerStatsEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "seasonId" INTEGER,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "replacedBy" INTEGER,
    "roundNumber" INTEGER,
    "stage" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "homeScoreHt" INTEGER,
    "awayScoreHt" INTEGER,
    "detailsSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scoresOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_match_stats" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "period" "Period" NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "corners" INTEGER,
    "yellowCards" INTEGER,
    "redCards" INTEGER,
    "shotsTotal" INTEGER,
    "shotsOnTarget" INTEGER,
    "fouls" INTEGER,
    "offsides" INTEGER,

    CONSTRAINT "team_match_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_lineups" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "isStarter" BOOLEAN NOT NULL,
    "lineupStatus" "LineupStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_lineups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_match_stats" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "minutesPlayed" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "shotsTotal" INTEGER NOT NULL DEFAULT 0,
    "shotsOnTarget" INTEGER NOT NULL DEFAULT 0,
    "tackles" INTEGER NOT NULL DEFAULT 0,
    "fouls" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_match_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" SERIAL NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "requestsUsed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seasons_leagueId_idx" ON "seasons"("leagueId");

-- CreateIndex
CREATE INDEX "teams_name_idx" ON "teams"("name");

-- CreateIndex
CREATE INDEX "players_name_idx" ON "players"("name");

-- CreateIndex
CREATE INDEX "matches_eventDate_idx" ON "matches"("eventDate");

-- CreateIndex
CREATE INDEX "matches_homeTeamId_eventDate_idx" ON "matches"("homeTeamId", "eventDate");

-- CreateIndex
CREATE INDEX "matches_awayTeamId_eventDate_idx" ON "matches"("awayTeamId", "eventDate");

-- CreateIndex
CREATE INDEX "matches_leagueId_status_idx" ON "matches"("leagueId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "team_match_stats_matchId_teamId_period_key" ON "team_match_stats"("matchId", "teamId", "period");

-- CreateIndex
CREATE INDEX "match_lineups_playerId_idx" ON "match_lineups"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "match_lineups_matchId_playerId_key" ON "match_lineups"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "player_match_stats_playerId_idx" ON "player_match_stats"("playerId");

-- CreateIndex
CREATE INDEX "player_match_stats_teamId_idx" ON "player_match_stats"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "player_match_stats_matchId_playerId_key" ON "player_match_stats"("matchId", "playerId");

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_match_stats" ADD CONSTRAINT "team_match_stats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_match_stats" ADD CONSTRAINT "team_match_stats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
