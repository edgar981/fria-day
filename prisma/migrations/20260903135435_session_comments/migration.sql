-- CreateTable
CREATE TABLE "session_comment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_comment_sessionId_idx" ON "session_comment"("sessionId");

-- AddForeignKey
ALTER TABLE "session_comment" ADD CONSTRAINT "session_comment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_comment" ADD CONSTRAINT "session_comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
