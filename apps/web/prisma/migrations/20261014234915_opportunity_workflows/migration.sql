-- CreateTable
CREATE TABLE "OpportunityWorkflow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recurringId" TEXT,
    "kind" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'prepared',
    "merchant" TEXT NOT NULL,
    "merchantKey" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "baselineCents" INTEGER NOT NULL,
    "nextExpected" DATE,
    "estimatedAnnualCents" INTEGER NOT NULL,
    "targetCents" INTEGER,
    "checklist" JSONB NOT NULL,
    "draft" TEXT NOT NULL DEFAULT '',
    "contactUrl" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "actionDate" DATE,
    "verification" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "realizedCents" INTEGER NOT NULL DEFAULT 0,
    "confirmedAnnualCents" INTEGER NOT NULL DEFAULT 0,
    "events" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityWorkflow_userId_stage_idx" ON "OpportunityWorkflow"("userId", "stage");

-- CreateIndex
CREATE INDEX "OpportunityWorkflow_userId_merchantKey_idx" ON "OpportunityWorkflow"("userId", "merchantKey");

-- AddForeignKey
ALTER TABLE "OpportunityWorkflow" ADD CONSTRAINT "OpportunityWorkflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityWorkflow" ADD CONSTRAINT "OpportunityWorkflow_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
