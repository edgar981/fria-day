-- CreateEnum
CREATE TYPE "DrinkKind" AS ENUM ('CERVEZA', 'COCTEL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BeerFormat" ADD VALUE 'COPA';
ALTER TYPE "BeerFormat" ADD VALUE 'VASO';
ALTER TYPE "BeerFormat" ADD VALUE 'JARRA_COMPARTIDA';

-- AlterTable
ALTER TABLE "beer" ADD COLUMN     "kind" "DrinkKind" NOT NULL DEFAULT 'CERVEZA',
ALTER COLUMN "brewery" DROP NOT NULL;
