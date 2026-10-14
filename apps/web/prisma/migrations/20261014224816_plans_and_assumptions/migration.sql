-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "planningAssumptions" JSONB;

-- CreateTable
CREATE TABLE "PlanSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startMonth" TEXT NOT NULL,
    "baseline" JSONB NOT NULL,
    "assumptions" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "decision" JSONB,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanSnapshot_userId_createdAt_idx" ON "PlanSnapshot"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlanSnapshot" ADD CONSTRAINT "PlanSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
