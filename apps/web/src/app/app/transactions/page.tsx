import { Suspense } from "react";
import { requireUser } from "@/server/current-user";
import { listCategories } from "@/server/services/categories";
import { listAccounts } from "@/server/services/accounts";
import { listTransactions } from "@/server/services/transactions";
import { transactionQuerySchema } from "@veltrix/shared";
import { TransactionsView } from "@/components/transactions/transactions-view";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const parsed = transactionQuerySchema.safeParse(sp);
  const [categories, accounts, initial] = await Promise.all([
    listCategories(user.id),
    listAccounts(user.id),
    listTransactions(user.id, parsed.success ? parsed.data : transactionQuerySchema.parse({})),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="Transactions" description="Every record shows where it came from: entered manually, imported, or demo data." />
      <Suspense>
        <TransactionsView categories={categories} accounts={accounts.map((a) => ({ id: a.id, name: a.name, mask: a.mask }))} initial={initial} />
      </Suspense>
    </div>
  );
}
