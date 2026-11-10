-- AlterTable
ALTER TABLE "players" ADD COLUMN     "availability" TEXT,
ADD COLUMN     "careerSyncedAt" TIMESTAMP(3),
ADD COLUMN     "contractUntil" DATE,
ADD COLUMN     "currentTeamId" INTEGER,
ADD COLUMN     "currentTeamName" TEXT,
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "injuryReturn" DATE,
ADD COLUMN     "injuryType" TEXT,
ADD COLUMN     "jerseyNumber" INTEGER,
ADD COLUMN     "marketValueEur" BIGINT,
ADD COLUMN     "nationalTeamId" INTEGER,
ADD COLUMN     "nationalTeamName" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "preferredFoot" TEXT,
ADD COLUMN     "profileSyncedAt" TIMESTAMP(3),
ADD COLUMN     "shortName" TEXT,
ADD COLUMN     "specificPosition" TEXT,
ADD COLUMN     "weightKg" INTEGER;

-- CreateTable
CREATE TABLE "player_career_seasons" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "seasonName" TEXT,
    "leagueId" INTEGER NOT NULL,
    "leagueName" TEXT,
    "teamId" INTEGER NOT NULL,
    "teamName" TEXT,
    "matches" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION,

    CONSTRAINT "player_career_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_transfers" (
    "id" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "transferDate" DATE NOT NULL,
    "fromTeamId" INTEGER,
    "fromTeamName" TEXT,
    "toTeamId" INTEGER,
    "toTeamName" TEXT,
    "feeEur" BIGINT,
    "feeDescription" TEXT,
    "transferType" INTEGER,

    CONSTRAINT "player_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_career_seasons_playerId_idx" ON "player_career_seasons"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_career_seasons_playerId_seasonId_teamId_key" ON "player_career_seasons"("playerId", "seasonId", "teamId");

-- CreateIndex
CREATE INDEX "player_transfers_playerId_idx" ON "player_transfers"("playerId");

-- AddForeignKey
ALTER TABLE "player_career_seasons" ADD CONSTRAINT "player_career_seasons_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
