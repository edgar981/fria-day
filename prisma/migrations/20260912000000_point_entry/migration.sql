-- CreateTable
CREATE TABLE "point_entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "sessionId" TEXT,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shownAt" TIMESTAMP(3),

    CONSTRAINT "point_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "point_entry_userId_idx" ON "point_entry"("userId");

-- CreateIndex
CREATE INDEX "point_entry_userId_sessionId_idx" ON "point_entry"("userId", "sessionId");

-- CreateIndex
CREATE INDEX "point_entry_userId_action_createdAt_idx" ON "point_entry"("userId", "action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "point_entry_userId_action_refId_key" ON "point_entry"("userId", "action", "refId");

-- AddForeignKey
ALTER TABLE "point_entry" ADD CONSTRAINT "point_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

