import { requireUser } from "@/server/current-user";
import { budgetStatusForMonth } from "@/server/services/budgets";
import { listCategories } from "@/server/services/categories";
import { todayIn } from "@/server/dates";
import { BudgetsView } from "@/components/budgets/budgets-view";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Budgets" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const current = todayIn(user.timezone).slice(0, 7);
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : current;
  const [budgets, categories] = await Promise.all([budgetStatusForMonth(user.id, month, user.timezone), listCategories(user.id)]);
  return (
    <div className="space-y-5">
      <PageHeader title="Budgets" description="Plan monthly limits by category and track actual spending against them." />
      <BudgetsView month={month} budgets={budgets} categories={categories} isCurrentMonth={month === current} />
    </div>
  );
}
