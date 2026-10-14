"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Landmark, Lock, PenLine, Plus, Sparkles, Trash2 } from "lucide-react";
import { formatMoney } from "@veltrix/shared";
import { BankConnections } from "@/components/overview/bank-connections";
import { Badge, Button, Field, FormError, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

type Path = "bank" | "manual";
type Step = "choose" | "connect" | "accounts" | "income" | "budget" | "goal" | "review";

const STEPS: Record<Path, Step[]> = {
  bank: ["connect", "income", "budget", "goal", "review"],
  manual: ["accounts", "income", "budget", "goal", "review"],
};
const STEP_LABEL: Record<Step, string> = { choose: "Start", connect: "Connect", accounts: "Accounts", income: "Income", budget: "Monthly spending", goal: "Goal", review: "Review" };

const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Checking", hint: "Current balance" },
  { value: "SAVINGS", label: "Savings", hint: "Current balance" },
  { value: "CREDIT_CARD", label: "Credit card", hint: "Amount you owe" },
  { value: "CASH", label: "Cash", hint: "Amount on hand" },
  { value: "INVESTMENT", label: "Investments / brokerage", hint: "Current value" },
  { value: "RETIREMENT", label: "Retirement (401k, IRA)", hint: "Current value" },
  { value: "LOAN", label: "Loan (student, car…)", hint: "Amount you owe" },
  { value: "MORTGAGE", label: "Mortgage", hint: "Amount you owe" },
] as const;

const BUDGET_CATEGORIES = [
  { slug: "housing", name: "Housing", hint: "Rent or mortgage payment", share: 0.3 },
  { slug: "utilities", name: "Utilities & phone", hint: "Electric, water, internet, phone", share: 0.06 },
  { slug: "food", name: "Food & dining", hint: "Groceries, restaurants, coffee", share: 0.12 },
  { slug: "transport", name: "Transportation", hint: "Gas, transit, car costs", share: 0.1 },
  { slug: "health", name: "Health", hint: "Insurance, pharmacy, gym", share: 0.04 },
  { slug: "subscriptions", name: "Subscriptions", hint: "Streaming, apps, memberships", share: 0.02 },
  { slug: "entertainment", name: "Entertainment", hint: "Going out, hobbies", share: 0.05 },
  { slug: "shopping", name: "Shopping", hint: "Clothes, household items", share: 0.05 },
  { slug: "travel", name: "Travel", hint: "Trips and vacations", share: 0.03 },
  { slug: "other", name: "Other", hint: "Anything else", share: 0.03 },
] as const;

const GOAL_KINDS = [
  { kind: "EMERGENCY_FUND", name: "Emergency fund" },
  { kind: "VACATION", name: "Vacation" },
  { kind: "CAR", name: "New car" },
  { kind: "HOME", name: "Home down payment" },
  { kind: "DEBT", name: "Pay off debt" },
  { kind: "OTHER", name: "Something else" },
] as const;

const FREQUENCIES = [
  { value: "monthly", label: "per month", toMonthly: (n: number) => n },
  { value: "biweekly", label: "every two weeks", toMonthly: (n: number) => (n * 26) / 12 },
  { value: "weekly", label: "per week", toMonthly: (n: number) => (n * 52) / 12 },
  { value: "twice", label: "twice a month", toMonthly: (n: number) => n * 2 },
  { value: "yearly", label: "per year", toMonthly: (n: number) => n / 12 },
] as const;

/** "1,200" / "$45.5" → "1200.00"; null when not a valid amount. Empty → "". */
function cleanAmount(raw: string): string | null {
  const v = raw.replace(/[$,\s]/g, "");
  if (!v) return "";
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(v)) return null;
  return Number(v).toFixed(2);
}
const toCents = (s: string) => Math.round(Number(s || 0) * 100);

interface AccountRow {
  key: number;
  name: string;
  type: string;
  balance: string;
}
interface Suggestions {
  monthsOfHistory: number;
  monthlyIncomeCents: number | null;
  monthlySpendingCents: Record<string, number>;
  accounts: { id: string; name: string; type: string; linked: boolean; balanceCents: number }[];
}

function MoneyInput({ id, value, onChange, placeholder = "0.00", invalid, ariaLabel }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean; ariaLabel?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink3">$</span>
      <Input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={invalid || undefined} aria-label={ariaLabel} className="num pl-7" />
    </div>
  );
}

export function SetupWizard({ initialPath, plaidConfigured, currency, firstName }: { initialPath: Path | null; plaidConfigured: boolean; currency: string; firstName: string }) {
  const router = useRouter();
  const [path, setPath] = useState<Path | null>(initialPath);
  const [step, setStep] = useState<Step>(initialPath ? STEPS[initialPath][0] : "choose");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [banksConnected, setBanksConnected] = useState(0);
  const [accounts, setAccounts] = useState<AccountRow[]>([
    { key: 1, name: "Checking", type: "CHECKING", balance: "" },
    { key: 2, name: "Savings", type: "SAVINGS", balance: "" },
  ]);
  const [income, setIncome] = useState("");
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]["value"]>("monthly");
  const [budget, setBudget] = useState<Record<string, string>>({});
  const [goalOn, setGoalOn] = useState(true);
  const [goal, setGoal] = useState({ kind: "EMERGENCY_FUND", name: "Emergency fund", target: "", month: "", monthly: "" });
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);

  const m = (c: number) => formatMoney(c, currency, { noCents: c % 100 === 0 });
  const steps = path ? STEPS[path] : [];
  const index = steps.indexOf(step);

  // Prefill from linked-bank history once, when the user reaches the income step.
  const loadSuggestions = useCallback(async () => {
    try {
      const s = await api<Suggestions>("/api/setup");
      setSuggestions(s);
      if (s.monthlyIncomeCents && !income) setIncome((s.monthlyIncomeCents / 100).toFixed(2));
      if (Object.keys(s.monthlySpendingCents).length)
        setBudget((b) => (Object.keys(b).length ? b : Object.fromEntries(Object.entries(s.monthlySpendingCents).map(([k, v]) => [k, (v / 100).toFixed(2)]))));
    } catch {
      /* suggestions are optional */
    }
  }, [income]);
  useEffect(() => {
    if (step === "income" && path === "bank" && !suggestions) loadSuggestions();
  }, [step, path, suggestions, loadSuggestions]);

  const incomeMonthlyCents = useMemo(() => {
    const v = cleanAmount(income);
    if (!v) return null;
    return Math.round(FREQUENCIES.find((f) => f.value === frequency)!.toMonthly(Number(v)) * 100);
  }, [income, frequency]);
  const budgetCents = Object.values(budget).reduce((s, v) => s + toCents(cleanAmount(v) ?? "0"), 0);
  const goalMonthlyCents = goalOn ? toCents(cleanAmount(goal.monthly) ?? "0") : 0;

  function validate(): string | null {
    if (step === "accounts") {
      // Rows without a balance are left out.
      for (const a of accounts) {
        if (!a.balance.trim()) continue;
        if (cleanAmount(a.balance) === null) return `Check the balance for ${a.name || "each account"}. Use a number like 1250.00.`;
        if (!a.name.trim()) return "Give each account a name.";
      }
    }
    if (step === "income" && cleanAmount(income) === null) return "Enter your income as a number, like 3500.";
    if (step === "budget") for (const [slug, v] of Object.entries(budget)) if (cleanAmount(v) === null) return `Check the amount for ${BUDGET_CATEGORIES.find((c) => c.slug === slug)?.name}.`;
    if (step === "goal" && goalOn) {
      if (!goal.name.trim()) return "Name your goal.";
      const t = cleanAmount(goal.target);
      if (!t || Number(t) <= 0) return "Enter how much you want to save.";
      if (cleanAmount(goal.monthly) === null) return "Check the monthly amount.";
    }
    return null;
  }

  function next() {
    const problem = validate();
    setError(problem);
    if (problem || index < 0) return;
    const upcoming = steps[index + 1];
    // Suggest three months of budgeted spending as a starting emergency-fund target.
    if (upcoming === "goal" && goal.kind === "EMERGENCY_FUND" && !goal.target && budgetCents) setGoal((g) => ({ ...g, target: ((budgetCents * 3) / 100).toFixed(2) }));
    setStep(upcoming);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setError(null);
    if (index <= 0) {
      setPath(null);
      setStep("choose");
    } else setStep(steps[index - 1]);
  }
  function choose(p: Path) {
    setPath(p);
    setStep(STEPS[p][0]);
    router.replace(`/app/setup?path=${p}`, { scroll: false });
  }

  const goalTargetDate = goal.month ? (() => {
    const [y, mo] = goal.month.split("-").map(Number);
    return `${goal.month}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
  })() : null;
  const neededMonthlyCents = useMemo(() => {
    const t = toCents(cleanAmount(goal.target) ?? "0");
    if (!goal.month || !t) return null;
    const [y, mo] = goal.month.split("-").map(Number);
    const now = new Date();
    const months = (y - now.getFullYear()) * 12 + (mo - (now.getMonth() + 1));
    return months > 0 ? Math.ceil(t / months) : null;
  }, [goal.target, goal.month]);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/setup", {
        body: {
          path,
          accounts: path === "manual" ? accounts.filter((a) => a.name.trim() && a.balance.trim()).map((a) => ({ name: a.name.trim(), type: a.type, balance: cleanAmount(a.balance) })) : [],
          monthlyIncome: incomeMonthlyCents === null ? null : (incomeMonthlyCents / 100).toFixed(2),
          budget: Object.entries(budget)
            .map(([category, v]) => ({ category, limit: cleanAmount(v) }))
            .filter((l) => l.limit && Number(l.limit) > 0),
          goal: goalOn ? { name: goal.name.trim(), kind: goal.kind, target: cleanAmount(goal.target), startingAmount: "0", targetDate: goalTargetDate, plannedMonthly: cleanAmount(goal.monthly) || null } : null,
        },
      });
      router.push("/app");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your setup. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div>
        <p className="text-sm text-ink3">Guided setup</p>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">{step === "choose" ? `Welcome, ${firstName}. How would you like to start?` : STEP_LABEL[step]}</h1>
      </div>

      {path && (
        <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Setup progress">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`grid size-6 place-items-center rounded-full border ${i < index ? "border-pos bg-pos/15 text-pos" : i === index ? "border-blue bg-blue/20 text-ink" : "border-line text-ink3"}`} aria-current={i === index ? "step" : undefined}>
                {i < index ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={i === index ? "text-ink" : "text-ink3"}>{STEP_LABEL[s]}</span>
              {i < steps.length - 1 && <span className="h-px w-5 bg-line" aria-hidden />}
            </li>
          ))}
        </ol>
      )}

      {step === "choose" && (
        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => choose("bank")} className="panel group flex flex-col p-6 text-left transition hover:border-blue/60">
            <span className="mb-4 flex items-center justify-between">
              <span className="grid size-12 place-items-center rounded-[14px] bg-blue/10 text-cyan">
                <Landmark className="size-6" aria-hidden />
              </span>
              <Badge tone="pos">Fastest</Badge>
            </span>
            <span className="font-display text-lg font-semibold">Connect my bank</span>
            <span className="mt-1.5 flex-1 text-sm text-ink2">Plaid imports your balances and transactions and keeps them updated. You sign in to your bank in Plaid&apos;s window. VELTRIX never sees your password and can&apos;t move money.</span>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-cyan">
              Connect <ArrowRight className="size-4" aria-hidden />
            </span>
          </button>
          <button onClick={() => choose("manual")} className="panel group flex flex-col p-6 text-left transition hover:border-blue/60">
            <span className="mb-4">
              <span className="grid size-12 place-items-center rounded-[14px] bg-blue/10 text-cyan">
                <PenLine className="size-6" aria-hidden />
              </span>
            </span>
            <span className="font-display text-lg font-semibold">Enter it myself</span>
            <span className="mt-1.5 flex-1 text-sm text-ink2">No bank login needed. Type in your balances, income and usual monthly costs. Rough numbers are fine; you can change anything later or just tell the advisor.</span>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-cyan">
              Start step by step <ArrowRight className="size-4" aria-hidden />
            </span>
          </button>
          <p className="flex items-center gap-2 text-xs text-ink3 md:col-span-2">
            <Lock className="size-3.5" aria-hidden /> Your data is private to your account. You can switch methods anytime, or use both.
          </p>
        </div>
      )}

      {step === "connect" && (
        <div className="panel space-y-4 p-6">
          <p className="text-sm text-ink2">Connect one or more banks. When you&apos;re done, continue to set your income, budget and a goal.</p>
          <BankConnections configured={plaidConfigured} onChange={setBanksConnected} />
          {!plaidConfigured && <p className="text-sm text-ink2">Bank linking isn&apos;t available right now. You can enter your accounts yourself instead.</p>}
          <button className="text-sm text-cyan hover:underline" onClick={() => choose("manual")}>
            Rather not link a bank? Enter accounts myself instead
          </button>
        </div>
      )}

      {step === "accounts" && (
        <div className="panel space-y-4 p-6">
          <p className="text-sm text-ink2">Add the accounts you want to track. Check your bank app for current balances. For cards and loans, enter what you owe.</p>
          <ul className="space-y-3">
            {accounts.map((a, i) => {
              const t = ACCOUNT_TYPES.find((x) => x.value === a.type)!;
              const update = (patch: Partial<AccountRow>) => setAccounts((xs) => xs.map((x) => (x.key === a.key ? { ...x, ...patch } : x)));
              return (
                <li key={a.key} className="grid gap-3 rounded-[12px] border border-line-soft bg-bg2/50 p-3 sm:grid-cols-[1.1fr_1fr_1fr_auto] sm:items-end">
                  <Field label="Type" htmlFor={`acc-type-${a.key}`}>
                    <Select
                      id={`acc-type-${a.key}`}
                      value={a.type}
                      onChange={(e) => {
                        const nextType = ACCOUNT_TYPES.find((x) => x.value === e.target.value)!;
                        const wasDefaultName = ACCOUNT_TYPES.some((x) => x.label === a.name) || !a.name;
                        update({ type: nextType.value, ...(wasDefaultName ? { name: nextType.label } : {}) });
                      }}
                    >
                      {ACCOUNT_TYPES.map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Name" htmlFor={`acc-name-${a.key}`}>
                    <Input id={`acc-name-${a.key}`} value={a.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Chase checking" />
                  </Field>
                  <Field label={t.hint} htmlFor={`acc-bal-${a.key}`}>
                    <MoneyInput id={`acc-bal-${a.key}`} value={a.balance} onChange={(v) => update({ balance: v })} invalid={cleanAmount(a.balance) === null} />
                  </Field>
                  <Button variant="ghost" size="sm" className="h-10" aria-label={`Remove ${a.name || `account ${i + 1}`}`} onClick={() => setAccounts((xs) => xs.filter((x) => x.key !== a.key))}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" size="sm" onClick={() => setAccounts((xs) => [...xs, { key: Date.now(), name: "Credit card", type: "CREDIT_CARD", balance: "" }])} disabled={accounts.length >= 20}>
            <Plus className="size-4" /> Add another account
          </Button>
        </div>
      )}

      {step === "income" && (
        <div className="panel space-y-4 p-6">
          <p className="text-sm text-ink2">How much lands in your account after taxes? This powers your monthly plan: income minus budget and saving.</p>
          {path === "bank" && suggestions?.monthlyIncomeCents ? <p className="text-xs text-ink3">Pre-filled from your linked bank&apos;s last {suggestions.monthsOfHistory} month{suggestions.monthsOfHistory === 1 ? "" : "s"} of deposits. Adjust if it&apos;s off.</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Take-home pay" htmlFor="income">
              <MoneyInput id="income" value={income} onChange={setIncome} placeholder="3500.00" invalid={cleanAmount(income) === null} />
            </Field>
            <Field label="How often" htmlFor="freq">
              <Select id="freq" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {incomeMonthlyCents !== null && frequency !== "monthly" && <p className="num text-sm text-ink2">That&apos;s about {m(incomeMonthlyCents)} a month.</p>}
          <p className="text-xs text-ink3">Not sure or irregular income? Leave it blank. You can add it later.</p>
        </div>
      )}

      {step === "budget" && (
        <div className="panel space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-lg text-sm text-ink2">What do you usually spend each month? These become your monthly budget. Leave anything you don&apos;t spend on blank.</p>
            {incomeMonthlyCents ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBudget(Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c.slug, (Math.round((incomeMonthlyCents * c.share) / 1000) * 10).toFixed(2)])))}
              >
                <Sparkles className="size-3.5" /> Suggest from my income
              </Button>
            ) : null}
          </div>
          {path === "bank" && suggestions && Object.keys(suggestions.monthlySpendingCents).length > 0 && <p className="text-xs text-ink3">Pre-filled with your average monthly spending from your linked accounts.</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {BUDGET_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Field label={c.name} htmlFor={`b-${c.slug}`} hint={c.hint}>
                  <MoneyInput id={`b-${c.slug}`} value={budget[c.slug] ?? ""} onChange={(v) => setBudget((b) => ({ ...b, [c.slug]: v }))} invalid={cleanAmount(budget[c.slug] ?? "") === null} />
                </Field>
              </li>
            ))}
          </ul>
          <div className="num flex flex-wrap gap-x-6 gap-y-1 rounded-[10px] bg-bg2/70 px-4 py-3 text-sm">
            <span>
              Total: <strong>{m(budgetCents)}</strong>/month
            </span>
            {incomeMonthlyCents ? (
              <span className={incomeMonthlyCents - budgetCents < 0 ? "text-neg" : "text-ink2"}>
                {incomeMonthlyCents - budgetCents < 0 ? "Over your income by " : "Leaves "}
                <strong>{m(Math.abs(incomeMonthlyCents - budgetCents))}</strong>
                {incomeMonthlyCents - budgetCents < 0 ? "" : " for saving and extras"}
              </span>
            ) : null}
          </div>
          {incomeMonthlyCents ? <p className="text-[11px] text-ink3">Suggestions use a common starting split (about 80% spending, 20% saving). They&apos;re a starting point, not advice; adjust to your real costs.</p> : null}
        </div>
      )}

      {step === "goal" && (
        <div className="panel space-y-4 p-6">
          <p className="text-sm text-ink2">What are you saving for? Pick one to start. You can add more on the Goals page.</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Goal type">
            {GOAL_KINDS.map((g) => (
              <button
                key={g.kind}
                role="radio"
                aria-checked={goalOn && goal.kind === g.kind}
                onClick={() => {
                  setGoalOn(true);
                  const suggested = g.kind === "EMERGENCY_FUND" && !goal.target && budgetCents ? ((budgetCents * 3) / 100).toFixed(2) : goal.target;
                  setGoal((x) => ({ ...x, kind: g.kind, name: GOAL_KINDS.some((k) => k.name === x.name) || !x.name ? (g.kind === "OTHER" ? "" : g.name) : x.name, target: suggested }));
                }}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${goalOn && goal.kind === g.kind ? "border-blue bg-blue/20 text-ink" : "border-line text-ink2 hover:border-blue/60"}`}
              >
                {g.name}
              </button>
            ))}
            <button role="radio" aria-checked={!goalOn} onClick={() => setGoalOn(false)} className={`rounded-full border px-3.5 py-1.5 text-sm ${!goalOn ? "border-blue bg-blue/20 text-ink" : "border-line text-ink3 hover:border-blue/60"}`}>
              Skip for now
            </button>
          </div>
          {goalOn && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Goal name" htmlFor="g-name">
                <Input id="g-name" value={goal.name} maxLength={80} onChange={(e) => setGoal((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Japan trip" />
              </Field>
              <Field label="Amount to save" htmlFor="g-target" hint={goal.kind === "EMERGENCY_FUND" && budgetCents ? `3 months of your budget is ${m(budgetCents * 3)}` : undefined}>
                <MoneyInput id="g-target" value={goal.target} onChange={(v) => setGoal((x) => ({ ...x, target: v }))} placeholder="5000.00" invalid={cleanAmount(goal.target) === null} />
              </Field>
              <Field label="Target month (optional)" htmlFor="g-month">
                <Input id="g-month" type="month" value={goal.month} onChange={(e) => setGoal((x) => ({ ...x, month: e.target.value }))} />
              </Field>
              <Field label="I can save each month (optional)" htmlFor="g-monthly" hint={neededMonthlyCents ? `You'd need about ${m(neededMonthlyCents)}/month to hit your date.` : undefined}>
                <MoneyInput id="g-monthly" value={goal.monthly} onChange={(v) => setGoal((x) => ({ ...x, monthly: v }))} invalid={cleanAmount(goal.monthly) === null} />
              </Field>
            </div>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="panel space-y-5 p-6">
          <p className="text-sm text-ink2">Here&apos;s what will be saved. Everything can be changed later, by you or by asking the advisor.</p>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink3">Accounts</dt>
              <dd className="mt-1">
                {path === "bank"
                  ? banksConnected
                    ? `${banksConnected} bank connection${banksConnected === 1 ? "" : "s"} (syncing automatically)`
                    : "No bank connected yet"
                  : accounts.filter((a) => a.name.trim() && a.balance.trim()).map((a) => (
                      <span key={a.key} className="num block">
                        {a.name}: {m(toCents(cleanAmount(a.balance) ?? "0"))}
                      </span>
                    ))}
                {path === "manual" && !accounts.some((a) => a.name.trim() && a.balance.trim()) && "None added"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink3">Monthly take-home income</dt>
              <dd className="num mt-1">{incomeMonthlyCents !== null ? m(incomeMonthlyCents) : "Not set"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink3">Monthly budget</dt>
              <dd className="num mt-1">{budgetCents ? `${m(budgetCents)} across ${Object.values(budget).filter((v) => toCents(cleanAmount(v) ?? "0") > 0).length} categories` : "Not set"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink3">Goal</dt>
              <dd className="num mt-1">{goalOn ? `${goal.name}: ${m(toCents(cleanAmount(goal.target) ?? "0"))}${goal.month ? ` by ${goal.month}` : ""}${goalMonthlyCents ? `, ${m(goalMonthlyCents)}/month` : ""}` : "Skipped"}</dd>
            </div>
          </dl>
          {incomeMonthlyCents ? (
            <p className={`num rounded-[10px] px-4 py-3 text-sm ${incomeMonthlyCents - budgetCents - goalMonthlyCents < 0 ? "bg-neg/10 text-neg" : "bg-pos/10 text-pos"}`}>
              Left over each month after budget and goal saving: <strong>{m(incomeMonthlyCents - budgetCents - goalMonthlyCents)}</strong>
            </p>
          ) : null}
        </div>
      )}

      <FormError message={error} />

      {step !== "choose" && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={back} disabled={saving}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            {step !== "review" && step !== "connect" && step !== "accounts" && (
              <button
                className="text-sm text-ink3 hover:text-ink"
                onClick={() => {
                  setError(null);
                  if (step === "goal") setGoalOn(false);
                  if (step === "income") setIncome("");
                  setStep(steps[index + 1]);
                }}
              >
                Skip this step
              </button>
            )}
            {step === "review" ? (
              <Button variant="primary" onClick={finish} loading={saving}>
                <Check className="size-4" /> Finish setup
              </Button>
            ) : (
              <Button variant="primary" onClick={next}>
                Continue <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
      {step === "choose" && (
        <p className="text-center text-sm text-ink3">
          <Link href="/app" className="hover:text-ink">
            I&apos;ll do this later
          </Link>
        </p>
      )}
    </div>
  );
}
