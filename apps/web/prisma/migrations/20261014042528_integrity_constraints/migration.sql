-- Integrity constraints Prisma's schema language cannot express.

-- System categories (userId IS NULL) must have unique slugs.
CREATE UNIQUE INDEX "TransactionCategory_system_slug_key" ON "TransactionCategory"("slug") WHERE "userId" IS NULL;

-- Currencies are ISO-4217-shaped codes.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

-- A transaction always moves money.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_nonzero" CHECK ("amount" <> 0);

-- Budgets, goals and holdings must be sane.
ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_limit_positive" CHECK ("limitAmount" > 0);
ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_threshold_range" CHECK ("alertThreshold" BETWEEN 10 AND 100);
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_target_positive" CHECK ("targetAmount" > 0);
ALTER TABLE "InvestmentHolding" ADD CONSTRAINT "InvestmentHolding_quantity_nonneg" CHECK ("quantity" >= 0);
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_price_positive" CHECK ("price" > 0);
ALTER TABLE "RewardProgram" ADD CONSTRAINT "RewardProgram_balance_nonneg" CHECK ("balance" >= 0);
ALTER TABLE "TravelExpense" ADD CONSTRAINT "TravelExpense_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_cashback_range" CHECK ("cashbackRate" IS NULL OR ("cashbackRate" >= 0 AND "cashbackRate" <= 100));
