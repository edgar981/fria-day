-- AlterTable
ALTER TABLE "session_comment" ADD COLUMN     "roundId" TEXT;

-- CreateTable
CREATE TABLE "session_round" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "dynamicKey" TEXT NOT NULL,
    "loserId" TEXT NOT NULL,
    "challengeKey" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "passedAt" TIMESTAMP(3),

    CONSTRAINT "session_round_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_round_sessionId_idx" ON "session_round"("sessionId");

-- CreateIndex
CREATE INDEX "session_round_loserId_idx" ON "session_round"("loserId");

-- CreateIndex
CREATE UNIQUE INDEX "session_round_sessionId_roundNumber_key" ON "session_round"("sessionId", "roundNumber");

-- CreateIndex
CREATE INDEX "session_comment_roundId_idx" ON "session_comment"("roundId");

-- AddForeignKey
ALTER TABLE "session_comment" ADD CONSTRAINT "session_comment_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "session_round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_round" ADD CONSTRAINT "session_round_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_round" ADD CONSTRAINT "session_round_loserId_fkey" FOREIGN KEY ("loserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
