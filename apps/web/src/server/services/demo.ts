/**
 * Demo data is no longer offered. Accounts created before that change may still hold
 * records tagged source = DEMO; this removes exactly those records.
 */
import { db } from "../db";
import { refreshRecurring } from "./recurring";
import { audit } from "../audit";

export async function removeDemoData(userId: string, opts: { silent?: boolean } = {}) {
  await db.$transaction([
    db.transaction.deleteMany({ where: { userId, source: "DEMO" } }),
    db.connectedAccount.deleteMany({ where: { userId, source: "DEMO" } }),
    db.budget.deleteMany({ where: { userId, source: "DEMO" } }),
    db.savingsGoal.deleteMany({ where: { userId, source: "DEMO" } }),
    db.portfolioSnapshot.deleteMany({ where: { userId, source: "DEMO" } }),
    db.watchlistItem.deleteMany({ where: { watchlist: { userId }, source: "DEMO" } }),
    db.deal.deleteMany({ where: { userId, source: "DEMO" } }),
    db.savedProduct.deleteMany({ where: { userId, source: "DEMO" } }),
    db.travelPlan.deleteMany({ where: { userId, source: "DEMO" } }),
    db.rewardProgram.deleteMany({ where: { userId, source: "DEMO" } }),
    db.savedArticle.deleteMany({ where: { userId, source: "DEMO" } }),
    db.recurringPayment.deleteMany({ where: { userId, status: "SUSPECTED" } }),
    db.financialInsight.deleteMany({ where: { userId, status: "ACTIVE" } }),
    db.userProfile.update({ where: { userId }, data: { hasDemoData: false } }),
  ]);
  if (!opts.silent) {
    await refreshRecurring(userId);
    await audit("data.demo_removed", { userId });
  }
}

