-- CreateTable
CREATE TABLE "session_photo" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_photo_sessionId_idx" ON "session_photo"("sessionId");

-- AddForeignKey
ALTER TABLE "session_photo" ADD CONSTRAINT "session_photo_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration (Pasada I-2): la foto pasó del check-in a la salida. Cada
-- CheckIn.photoUrl no nulo se convierte en una fila de SessionPhoto de su salida, en
-- orden de creación del check-in (order 0..n-1 por salida). CheckIn.photoUrl NO se
-- borra en esta pasada (columna sin uso; limpieza anotada en BACKLOG).
INSERT INTO "session_photo" ("id", "sessionId", "url", "order", "createdAt")
SELECT
  gen_random_uuid()::text,
  "sessionId",
  "photoUrl",
  (ROW_NUMBER() OVER (PARTITION BY "sessionId" ORDER BY "createdAt", "id"))::int - 1,
  "createdAt"
FROM "check_in"
WHERE "photoUrl" IS NOT NULL;
