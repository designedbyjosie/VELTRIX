/**
 * Demonstration data. Every record created here is tagged source = DEMO so the UI
 * can label it and `removeDemoData` can delete it without touching real records.
 * Dates are generated relative to today so dashboards look current.
 */
import { categorize } from "@veltrix/shared";
import { db } from "../db";
import { dec } from "../money";
import { addDays, addMonths, fromYmd, monthStart, todayIn } from "../dates";
import { DemoMarketProvider } from "../providers/market";
import { categoryBySlug } from "./categories";
import { refreshRecurring } from "./recurring";
import { refreshInsights } from "./insights";
import { ensureInstrument } from "./investments";
import { audit } from "../audit";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

interface DemoTxn {
  date: string;
  merchant: string;
  amountCents: number;
  slug?: string;
  account: "checking" | "card";
}

function generateTransactions(today: string): DemoTxn[] {
  const r = rng(42);
  const between = (min: number, max: number) => Math.round((min + r() * (max - min)) * 100);
  const out: DemoTxn[] = [];
  const ym = today.slice(0, 7);
  for (let m = -12; m <= 0; m++) {
    const month = addMonths(ym, m);
    const d = (day: number) => `${month}-${String(day).padStart(2, "0")}`;
    const push = (day: number, merchant: string, cents: number, account: DemoTxn["account"] = "card", slug?: string) => {
      const date = d(day);
      if (date <= today) out.push({ date, merchant, amountCents: cents, account, slug });
    };
    push(1, "Northwind Labs Payroll", 385000, "checking");
    push(15, "Northwind Labs Payroll", 385000, "checking");
    push(1, "Parkview Apartments Rent", -185000, "checking", "housing");
    push(2, "Transfer to High-Yield Savings", -60000, "checking", "transfer");
    push(5, "City Power & Electric", -between(78, 132), "checking", "utilities");
    push(12, "Xfinity Internet", -7999, "card");
    push(18, "Verizon Wireless", -6500, "card");
    push(3, "NETFLIX.COM", -1549, "card");
    push(8, "Spotify USA", -1199, "card");
    push(20, "Apple.com/bill iCloud", -299, "card");
    push(22, "Adobe Creative Cloud", -5999, "card");
    push(6, "Equinox Fitness", -8900, "card", "health");
    push(25, "Credit Card Payment - Thank You", -between(1200, 1800), "checking", "transfer");
    if ((m + 12) % 3 === 0) push(28, "Vanguard Dividend", between(40, 60), "checking", "income");
    for (let w = 0; w < 4; w++) {
      push(2 + w * 7, w % 2 ? "Trader Joe's" : "Whole Foods Market", -between(55, 145));
      push(3 + w * 7, "Starbucks", -between(5, 9));
      push(4 + w * 7, "Starbucks", -between(5, 9));
      push(6 + w * 7, ["Chipotle", "Sushi Zen", "Luigi's Trattoria", "DoorDash"][w], -between(16, 72));
      push(5 + w * 7, "Uber", -between(11, 34));
    }
    push(9, "Shell Oil", -between(44, 62));
    push(23, "Shell Oil", -between(44, 62));
    push(10, "Amazon.com", -between(18, 140));
    push(17, "Amazon.com", -between(18, 95));
    push(24, "Target", -between(25, 110));
    if (r() > 0.5) push(14, "Best Buy", -between(40, 260));
    if (r() > 0.6) push(19, "Ticketmaster", -between(45, 160));
    if (r() > 0.5) push(26, "Steam Games", -between(10, 60));
    if (m === -7) push(11, "Delta Air Lines", -64200);
    if (m === -7) push(13, "Marriott Lisbon", -48600);
    if (m === -2) push(16, "Airbnb", -31200);
  }
  return out;
}

export async function loadDemoData(userId: string, timezone = "UTC") {
  await removeDemoData(userId, { silent: true });
  const today = todayIn(timezone);
  const ym = today.slice(0, 7);
  const cats = await categoryBySlug(userId);
  const md = new DemoMarketProvider();

  // Accounts
  const mk = (name: string, institution: string, type: "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "INVESTMENT" | "RETIREMENT" | "LOAN", balance: number, mask: string) =>
    db.connectedAccount.create({ data: { userId, name, institution, type, currentBalance: dec(balance), mask, source: "DEMO", currency: "USD" } });
  const checking = await mk("Everyday Checking", "Demo Bank", "CHECKING", 842055, "4821");
  const savings = await mk("High-Yield Savings", "Demo Bank", "SAVINGS", 1842000, "9930");
  const card = await mk("Rewards Visa", "Demo Card Co.", "CREDIT_CARD", 128433, "1187");
  const brokerage = await mk("Brokerage", "Demo Invest", "INVESTMENT", 0, "5502");
  const retirement = await mk("401(k)", "Demo Retirement", "RETIREMENT", 0, "7714");
  const loan = await mk("Auto Loan", "Demo Auto Finance", "LOAN", 980000, "3301");

  // Holdings valued at demo prices; account balances follow the holdings.
  const holdings: [string, string, string, number][] = [
    [brokerage.id, "VOO", "40", 1780000],
    [brokerage.id, "QQQ", "15", 590000],
    [brokerage.id, "NVDA", "60", 390000],
    [brokerage.id, "AAPL", "25", 410000],
    [brokerage.id, "AMZN", "30", 460000],
    [brokerage.id, "BND", "80", 580000],
    [retirement.id, "VTI", "100", 2200000],
    [retirement.id, "VXUS", "150", 850000],
  ];
  const values = new Map<string, number>();
  for (const [accountId, symbol, qty, cost] of holdings) {
    const inst = await ensureInstrument(symbol);
    await db.investmentHolding.create({ data: { userId, accountId, instrumentId: inst.id, quantity: qty, costBasis: dec(cost), source: "DEMO" } });
    const q = await md.quote(symbol);
    values.set(accountId, (values.get(accountId) ?? 0) + Math.round(Number(qty) * (q?.price ?? 0) * 100));
  }
  await db.connectedAccount.update({ where: { id: brokerage.id }, data: { currentBalance: dec(values.get(brokerage.id) ?? 0) } });
  await db.connectedAccount.update({ where: { id: retirement.id }, data: { currentBalance: dec(values.get(retirement.id) ?? 0) } });

  // Monthly balance history (13 points) with gentle trends ending at today's balances.
  const series: [string, number, number][] = [
    [checking.id, 842055, -0.004],
    [savings.id, 1842000, 0.035],
    [card.id, 128433, 0.0],
    [brokerage.id, values.get(brokerage.id) ?? 0, 0.016],
    [retirement.id, values.get(retirement.id) ?? 0, 0.012],
    [loan.id, 980000, -0.018],
  ];
  for (const [accountId, end, growth] of series) {
    for (let m = 12; m >= 0; m--) {
      const date = m === 0 ? today : monthStart(addMonths(ym, -m));
      const balance = Math.round(end / Math.pow(1 + growth, m));
      await db.accountBalance.upsert({
        where: { accountId_asOf: { accountId, asOf: fromYmd(date) } },
        create: { userId, accountId, asOf: fromYmd(date), balance: dec(balance), source: "DEMO" },
        update: { balance: dec(balance) },
      });
    }
  }

  // Transactions
  const txns = generateTransactions(today);
  await db.transaction.createMany({
    data: txns.map((t, i) => {
      const slug = t.slug ?? categorize(t.merchant, "", t.amountCents).slug;
      return {
        userId,
        accountId: t.account === "checking" ? checking.id : card.id,
        date: fromYmd(t.date),
        amount: dec(t.amountCents),
        currency: "USD",
        merchant: t.merchant,
        categoryId: cats.get(slug)?.id ?? null,
        categorySource: "RULE" as const,
        source: "DEMO" as const,
        dedupeHash: `demo:${i}:${t.date}`,
      };
    }),
  });

  // Budget (recurring, started 3 months ago)
  const lines: [string, number][] = [
    ["housing", 190000],
    ["food", 75000],
    ["shopping", 32000],
    ["transport", 30000],
    ["entertainment", 15000],
    ["utilities", 25000],
    ["subscriptions", 9000],
  ];
  await db.budget.create({
    data: {
      userId,
      name: "Monthly plan",
      startMonth: fromYmd(monthStart(addMonths(ym, -3))),
      recurring: true,
      source: "DEMO",
      lines: { create: lines.filter(([s]) => cats.has(s)).map(([s, c]) => ({ categoryId: cats.get(s)!.id, limitAmount: dec(c), alertThreshold: 80 })) },
    },
  });

  // Goals with contributions
  const goal = async (name: string, kind: "EMERGENCY_FUND" | "VACATION" | "CAR" | "HOME", target: number, start: number, monthly: number, monthsOut: number, contributions: number) => {
    const g = await db.savingsGoal.create({
      data: { userId, name, kind, targetAmount: dec(target), startingAmount: dec(start), plannedMonthly: dec(monthly), targetDate: fromYmd(`${addMonths(ym, monthsOut)}-01`), source: "DEMO" },
    });
    for (let i = contributions; i >= 1; i--) {
      await db.goalContribution.create({ data: { userId, goalId: g.id, amount: dec(monthly), date: fromYmd(`${addMonths(ym, -i + 1)}-02`) > fromYmd(today) ? fromYmd(today) : fromYmd(`${addMonths(ym, -i + 1)}-02`), note: "Monthly transfer (demo)" } });
    }
  };
  await goal("Emergency fund", "EMERGENCY_FUND", 2000000, 1200000, 60000, 14, 6);
  await goal("Dream vacation (Japan)", "VACATION", 800000, 150000, 50000, 10, 5);
  await goal("New car", "CAR", 2000000, 700000, 40000, 24, 4);
  await goal("Home deposit", "HOME", 6000000, 1500000, 70000, 48, 3);

  // Portfolio snapshots: value and cumulative contributions, so growth ≠ profit.
  const pv = (values.get(brokerage.id) ?? 0) + (values.get(retirement.id) ?? 0);
  for (let m = 12; m >= 0; m--) {
    const date = m === 0 ? today : monthStart(addMonths(ym, -m));
    const contributions = Math.round(pv * 0.78) - m * 100000;
    const value = Math.round(pv / Math.pow(1.011, m)) - m * 60000;
    await db.portfolioSnapshot.upsert({
      where: { userId_date: { userId, date: fromYmd(date) } },
      create: { userId, date: fromYmd(date), marketValue: dec(value), netContributions: dec(contributions), source: "DEMO" },
      update: { marketValue: dec(value), netContributions: dec(contributions) },
    });
  }

  // Watchlist
  const wl = (await db.watchlist.findFirst({ where: { userId, isDefault: true } })) ?? (await db.watchlist.create({ data: { userId, name: "My watchlist", isDefault: true } }));
  for (const s of ["NVDA", "MSFT", "TSLA", "SCHD"]) {
    const inst = await ensureInstrument(s);
    await db.watchlistItem.upsert({ where: { watchlistId_instrumentId: { watchlistId: wl.id, instrumentId: inst.id } }, create: { watchlistId: wl.id, instrumentId: inst.id, source: "DEMO" }, update: {} });
  }

  // Saved products with observed price history
  const product = async (title: string, merchant: string, url: string, image: string | null, gtin: string | null, prices: [number, number][], status: "WISHLIST" | "WATCHING" = "WISHLIST") => {
    const p = await db.savedProduct.create({
      data: { userId, title, merchant, url, canonicalUrl: url, imageUrl: image, gtin, brand: title.split(" ")[0], status, source: "DEMO", currency: "USD" },
    });
    for (const [daysAgo, cents] of prices) {
      const at = fromYmd(addDays(today, -daysAgo));
      await db.priceObservation.create({
        data: { userId, savedProductId: p.id, price: dec(cents), currency: "USD", merchant, sourceUrl: url, source: "DEMO", observedAt: at, observationKey: `demo:${p.id}:${daysAgo}` },
      });
    }
    const last = prices[prices.length - 1];
    await db.savedProduct.update({ where: { id: p.id }, data: { latestPrice: dec(last[1]), latestSeenAt: fromYmd(addDays(today, -last[0])) } });
    return p;
  };
  const xm5 = await product("Sony WH-1000XM5 Wireless Headphones", "Amazon", "https://amazon.com/dp/B09XS7JWHH", null, "4548736132610", [
    [74, 39999],
    [52, 37900],
    [31, 39999],
    [12, 36800],
    [1, 34800],
  ]);
  await product("Sony WH-1000XM5 Wireless Headphones", "Best Buy", "https://bestbuy.com/site/sony-wh-1000xm5/6505727.p", null, "4548736132610", [
    [40, 39999],
    [9, 36999],
  ], "WATCHING");
  await product("Kindle Paperwhite (16 GB)", "Amazon", "https://amazon.com/dp/B0CFPJYX7P", null, null, [
    [60, 14999],
    [33, 14999],
    [5, 15999],
  ]);
  await db.deal.create({
    data: { userId, savedProductId: xm5.id, title: xm5.title, merchant: "Amazon", url: xm5.url, currency: "USD", price: dec(34800), previousPrice: dec(36800), verification: "VERIFIED", confidence: "HIGH", source: "DEMO", lastCheckedAt: fromYmd(addDays(today, -1)) },
  });
  await db.deal.create({
    data: { userId, title: "Running shoes — 15% off with code", merchant: "Demo Sports", url: "https://example.com/demo-deal", currency: "USD", couponCode: "DEMO15", couponConditions: "Demo coupon: illustrative only; minimum order $75.", verification: "USER_REPORTED", confidence: "LOW", source: "DEMO", expiresAt: fromYmd(addDays(today, 20)) },
  });

  // Travel
  const japan = await db.travelPlan.create({
    data: { userId, name: "Japan in spring", destination: "Tokyo & Kyoto", startDate: fromYmd(`${addMonths(ym, 6)}-04`), endDate: fromYmd(`${addMonths(ym, 6)}-16`), budget: dec(600000), currency: "USD", status: "PLANNING", source: "DEMO" },
  });
  await db.travelExpense.createMany({
    data: [
      { userId, tripId: japan.id, category: "FLIGHT", description: "SFO → HND round trip (quote)", amount: dec(124000), currency: "USD", provider: "Demo Air", isQuote: true, source: "DEMO" },
      { userId, tripId: japan.id, category: "LODGING", description: "Kyoto ryokan deposit", amount: dec(45000), currency: "USD", provider: "Demo Stays", isQuote: false, date: fromYmd(addDays(today, -20)), source: "DEMO" },
      { userId, tripId: japan.id, category: "TRANSPORT", description: "7-day rail pass (quote)", amount: dec(32000), currency: "USD", provider: "Demo Rail", isQuote: true, source: "DEMO" },
    ],
  });
  const lisbon = await db.travelPlan.create({
    data: { userId, name: "Lisbon weekend", destination: "Lisbon", startDate: fromYmd(`${addMonths(ym, -7)}-11`), endDate: fromYmd(`${addMonths(ym, -7)}-15`), budget: dec(150000), currency: "USD", status: "COMPLETED", source: "DEMO" },
  });
  await db.travelExpense.createMany({
    data: [
      { userId, tripId: lisbon.id, category: "FLIGHT", description: "Delta Air Lines", amount: dec(64200), currency: "USD", provider: "Delta", source: "DEMO" },
      { userId, tripId: lisbon.id, category: "LODGING", description: "Marriott Lisbon, 4 nights", amount: dec(48600), currency: "USD", provider: "Marriott", source: "DEMO" },
    ],
  });
  await db.rewardProgram.createMany({
    data: [
      { userId, name: "Demo SkyMiles", programType: "AIRLINE", balance: 45000, pointValueCents: "1.2", source: "DEMO" },
      { userId, name: "Demo Card Rewards", programType: "CARD", balance: 82300, pointValueCents: "1.0", source: "DEMO" },
      { userId, name: "Demo Hotel Points", programType: "HOTEL", balance: 30000, pointValueCents: null, source: "DEMO" },
    ],
  });
  await db.savedArticle.create({
    data: {
      userId,
      title: "Demo article: what a rate cut could mean for savers",
      url: "https://example.com/demo/rate-cut-savers",
      canonicalUrl: "https://example.com/demo/rate-cut-savers",
      publisher: "VELTRIX demo content",
      summary: "Illustrative demo article. Savings yields typically follow policy rates, so savers may see lower interest if rates are cut.",
      summarySource: "page-metadata",
      mentionedSymbols: ["BND", "SCHD"],
      source: "DEMO",
    },
  });

  await db.userProfile.update({ where: { userId }, data: { hasDemoData: true } });
  await refreshRecurring(userId, timezone);
  await refreshInsights(userId, timezone);
  await audit("data.demo_loaded", { userId });
  return { transactions: txns.length };
}

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

