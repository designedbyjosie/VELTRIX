-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InsightStatus" ADD VALUE 'FOLLOWING';
ALTER TYPE "InsightStatus" ADD VALUE 'RESOLVED';

-- AlterTable
ALTER TABLE "FinancialInsight" ADD COLUMN     "confidence" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "confidenceBasis" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "eventDate" DATE,
ADD COLUMN     "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "links" JSONB,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "outcomeAt" TIMESTAMP(3),
ADD COLUMN     "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "scoreBasis" JSONB;

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "mutedInsightKinds" TEXT[] DEFAULT ARRAY[]::TEXT[];
