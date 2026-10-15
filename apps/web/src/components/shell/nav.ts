import {
  ArrowLeftRight,
  BadgeCheck,
  Receipt,
  BadgePercent,
  Brain,
  ChartCandlestick,
  ChartLine,
  ChartPie,
  FileChartColumn,
  FlaskConical,
  Radar,
  House,
  Landmark,
  PiggyBank,
  Plane,
  Settings,
  ShoppingBag,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/plan", label: "What-if Lab", icon: FlaskConical },
  { href: "/app/opportunities", label: "Opportunities", icon: Radar },
  { href: "/app/bills", label: "Bills & Subscriptions", icon: Receipt },
  { href: "/app/outcomes", label: "Outcome Ledger", icon: BadgeCheck },
  { href: "/app/overview", label: "Financial Overview", icon: Landmark },
  { href: "/app/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/app/budgets", label: "Budgets", icon: ChartPie },
  { href: "/app/savings", label: "Savings", icon: PiggyBank },
  { href: "/app/goals", label: "Goals", icon: Target },
  { href: "/app/investments", label: "Investments", icon: ChartLine },
  { href: "/app/markets", label: "Stocks & Trading", icon: ChartCandlestick },
  { href: "/app/deals", label: "Deals & Rewards", icon: BadgePercent },
  { href: "/app/shopping", label: "Shopping", icon: ShoppingBag },
  { href: "/app/travel", label: "Travel", icon: Plane },
  { href: "/app/advisor", label: "AI Advisor", icon: Sparkles },
  { href: "/app/memory", label: "Memory", icon: Brain },
  { href: "/app/reports", label: "Reports", icon: FileChartColumn },
  { href: "/app/settings", label: "Settings", icon: Settings },
];
