-- CreateTable
CREATE TABLE "session_reaction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_reaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_reaction_sessionId_idx" ON "session_reaction"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "session_reaction_sessionId_userId_key" ON "session_reaction"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "session_reaction" ADD CONSTRAINT "session_reaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_reaction" ADD CONSTRAINT "session_reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
