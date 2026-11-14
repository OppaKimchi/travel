import { allSpending, categoryTotals, settleUp, type Spend } from "../lib/budget";
import { formatDay } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { spendCategoryLabel, type Booking, type TripBundle } from "../lib/types";
import type { Expense } from "../lib/types";
import { Icon } from "./Icon";

function Bar({ value, max, over }: { value: number; max: number; over?: boolean }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span className="bar" aria-hidden="true">
      <span className={over ? "bar-fill bar-over" : "bar-fill"} style={{ width: `${percent}%` }} />
    </span>
  );
}

export function Budget({
  bundle,
  canEdit,
  onAddExpense,
  onOpenExpense,
  onOpenBooking,
  onEditPlan,
}: {
  bundle: TripBundle;
  canEdit: boolean;
  onAddExpense: () => void;
  onOpenExpense: (expense: Expense) => void;
  onOpenBooking: (booking: Booking) => void;
  onEditPlan: () => void;
}) {
  const home = bundle.trip.home_currency;
  const money = (amount: number) => formatMoney(amount, home, home);
  const spending = allSpending(bundle.expenses, bundle.bookings);
  const totals = categoryTotals(spending, bundle.budget);
  const spent = totals.reduce((sum, t) => sum + t.spent, 0);
  const planned = totals.reduce((sum, t) => sum + t.planned, 0);
  const settlements = settleUp(spending, bundle.members);
  const nameOf = (id: string | null) =>
    bundle.members.find((m) => m.user_id === id)?.display_name ?? "Someone";

  const byDay = new Map<string, Spend[]>();
  for (const s of spending) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);

  return (
    <div className="budget">
      <div className="page-actions">
        <h2 className="page-heading">Budget</h2>
        {canEdit && (
          <button type="button" className="button primary" onClick={onAddExpense}>
            <Icon name="plus" size={18} /> Add spending
          </button>
        )}
      </div>

      <section className="card budget-summary">
        <p className="muted">Spent so far</p>
        <p className="budget-total">{money(spent)}</p>
        {planned > 0 ? (
          <>
            <Bar value={spent} max={planned} over={spent > planned} />
            <p className={spent > planned ? "error" : "muted"}>
              {spent > planned
                ? `${money(spent - planned)} over the ${money(planned)} budget`
                : `${money(planned - spent)} left of ${money(planned)}`}
            </p>
          </>
        ) : (
          <p className="muted">No budget planned yet.</p>
        )}
        {canEdit && (
          <button type="button" className="link-button" onClick={onEditPlan}>
            {planned > 0 ? "Change the budget" : "Plan a budget"}
          </button>
        )}
      </section>

      {bundle.members.length > 1 && (
        <section className="card settle">
          <h3>Who owes whom</h3>
          {settlements.length === 0 ? (
            <p className="muted">You're all square on shared costs.</p>
          ) : (
            <ul className="plain">
              {settlements.map((s) => (
                <li key={`${s.from}-${s.to}`}>
                  <strong>{nameOf(s.from)}</strong> owes <strong>{nameOf(s.to)}</strong> {money(s.amount)}
                </li>
              ))}
            </ul>
          )}
          <p className="fine-print">Counts shared spending only, split evenly.</p>
        </section>
      )}

      <section className="categories">
        <h3 className="section-title">By category</h3>
        <ul className="plain category-list">
          {totals
            .filter((t) => t.spent > 0 || t.planned > 0)
            .map((t) => (
              <li key={t.category}>
                <span className="category-row">
                  <span>{spendCategoryLabel(t.category)}</span>
                  <span>
                    {money(t.spent)}
                    {t.planned > 0 && <span className="muted"> of {money(t.planned)}</span>}
                  </span>
                </span>
                {t.planned > 0 && <Bar value={t.spent} max={t.planned} over={t.spent > t.planned} />}
              </li>
            ))}
        </ul>
        {spent === 0 && planned === 0 && <p className="muted">Nothing spent yet.</p>}
      </section>

      {spending.length > 0 && <h3 className="section-title">Spending</h3>}
      {[...byDay.entries()].map(([day, items]) => (
        <section key={day} className="spend-day">
          <h4 className="spend-day-heading">
            <span>{formatDay(day)}</span>
            <span>{money(items.reduce((sum, s) => sum + s.home, 0))}</span>
          </h4>
          <ul className="plain spend-list">
            {items.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  className="spend-row"
                  onClick={() => (s.expense ? onOpenExpense(s.expense) : s.booking && onOpenBooking(s.booking))}
                >
                  <span className="spend-main">
                    <span className="spend-title">{s.description}</span>
                    <span className="spend-meta">
                      {s.source === "booking" ? "Booking" : spendCategoryLabel(s.category)}
                      {bundle.members.length > 1 && s.paidBy && ` · ${nameOf(s.paidBy)} paid`}
                      {!s.shared && " · personal"}
                    </span>
                  </span>
                  <span className="spend-amounts">
                    <span>{money(s.home)}</span>
                    {s.currency !== home && <span className="muted">{formatMoney(s.amount, s.currency, home)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
