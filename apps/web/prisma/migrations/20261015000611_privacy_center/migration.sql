-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "deliverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "advisorProposals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificationsPausedUntil" TIMESTAMP(3),
ADD COLUMN     "notifyFrequency" TEXT NOT NULL DEFAULT 'immediate',
ADD COLUMN     "quietHoursEnd" INTEGER,
ADD COLUMN     "quietHoursStart" INTEGER;

-- CreateIndex
CREATE INDEX "Notification_userId_deliverAt_idx" ON "Notification"("userId", "deliverAt");
