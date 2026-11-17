-- AlterTable
ALTER TABLE "match_lineups" ADD COLUMN     "jerseyNumber" INTEGER;

-- CreateTable
CREATE TABLE "match_unavailable" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "reason" TEXT,

    CONSTRAINT "match_unavailable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_unavailable_matchId_playerId_key" ON "match_unavailable"("matchId", "playerId");

-- AddForeignKey
ALTER TABLE "match_unavailable" ADD CONSTRAINT "match_unavailable_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
