-- CreateEnum
CREATE TYPE "AdvisorActionStatus" AS ENUM ('PROPOSED', 'APPLIED', 'DISMISSED', 'FAILED');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "dashboardLayout" JSONB,
ADD COLUMN     "monthlyIncome" DECIMAL(18,2),
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "setupPath" TEXT;

-- CreateTable
CREATE TABLE "AdvisorAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "AdvisorActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "error" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorAction_userId_status_idx" ON "AdvisorAction"("userId", "status");

-- CreateIndex
CREATE INDEX "AdvisorAction_messageId_idx" ON "AdvisorAction"("messageId");

-- AddForeignKey
ALTER TABLE "AdvisorAction" ADD CONSTRAINT "AdvisorAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorAction" ADD CONSTRAINT "AdvisorAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorAction" ADD CONSTRAINT "AdvisorAction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AIMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Accounts that already hold data have effectively finished setup.
UPDATE "UserProfile" p SET "onboardingCompletedAt" = now()
WHERE EXISTS (SELECT 1 FROM "ConnectedAccount" a WHERE a."userId" = p."userId");
