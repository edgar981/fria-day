-- CreateTable
CREATE TABLE "join_request" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "join_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "join_request_recipientId_idx" ON "join_request"("recipientId");

-- CreateIndex
CREATE INDEX "join_request_requesterId_idx" ON "join_request"("requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "join_request_requesterId_recipientId_key" ON "join_request"("requesterId", "recipientId");

-- AddForeignKey
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
