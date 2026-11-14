import { roundMoney } from "./money";
import {
  SPEND_CATEGORIES,
  bookingSpendCategory,
  type Booking,
  type BudgetLine,
  type Expense,
  type Member,
  type SpendCategory,
} from "./types";

// One line of spending, from either an expense or a booking's cost.
export type Spend = {
  key: string;
  source: "expense" | "booking";
  expense?: Expense;
  booking?: Booking;
  date: string;
  description: string;
  category: SpendCategory;
  home: number;
  amount: number;
  currency: string;
  paidBy: string | null;
  shared: boolean;
};

export function allSpending(expenses: Expense[], bookings: Booking[]): Spend[] {
  const fromExpenses: Spend[] = expenses.map((e) => ({
    key: `e-${e.id}`,
    source: "expense",
    expense: e,
    date: e.spent_on,
    description: e.description,
    category: e.category,
    home: e.home_amount,
    amount: e.amount,
    currency: e.currency,
    paidBy: e.paid_by,
    shared: e.split === "shared",
  }));
  const fromBookings: Spend[] = bookings
    .filter((b) => b.home_cost !== null && b.cost !== null && b.currency)
    .map((b) => ({
      key: `b-${b.id}`,
      source: "booking",
      booking: b,
      date: b.starts_on,
      description: b.title,
      category: bookingSpendCategory(b.kind),
      home: b.home_cost ?? 0,
      amount: b.cost ?? 0,
      currency: b.currency ?? "",
      paidBy: b.paid_by,
      shared: true,
    }));
  return [...fromExpenses, ...fromBookings].sort((a, b) => b.date.localeCompare(a.date));
}

export type CategoryTotal = { category: SpendCategory; spent: number; planned: number };

export function categoryTotals(spending: Spend[], budget: BudgetLine[]): CategoryTotal[] {
  return SPEND_CATEGORIES.map(({ value }) => ({
    category: value,
    spent: roundMoney(spending.filter((s) => s.category === value).reduce((sum, s) => sum + s.home, 0)),
    planned: budget.find((l) => l.category === value)?.planned ?? 0,
  }));
}

export type Settlement = { from: string; to: string; amount: number };

// Shared costs are split evenly between the travellers. Works out who should
// pay whom so everyone has paid their share.
export function settleUp(spending: Spend[], members: Member[]): Settlement[] {
  if (members.length < 2) return [];
  const ids = new Set(members.map((m) => m.user_id));
  const shared = spending.filter((s) => s.shared && s.paidBy && ids.has(s.paidBy));
  const total = shared.reduce((sum, s) => sum + s.home, 0);
  const share = total / members.length;

  const balances = members.map((m) => ({
    id: m.user_id,
    net: shared.filter((s) => s.paidBy === m.user_id).reduce((sum, s) => sum + s.home, 0) - share,
  }));

  const owed = balances.filter((b) => b.net > 0.005).sort((a, b) => b.net - a.net);
  const owing = balances.filter((b) => b.net < -0.005).sort((a, b) => a.net - b.net);
  const result: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < owing.length && j < owed.length) {
    const amount = Math.min(-owing[i].net, owed[j].net);
    result.push({ from: owing[i].id, to: owed[j].id, amount: roundMoney(amount) });
    owing[i].net += amount;
    owed[j].net -= amount;
    if (owing[i].net > -0.005) i += 1;
    if (owed[j].net < 0.005) j += 1;
  }
  return result.filter((s) => s.amount >= 0.01);
}
