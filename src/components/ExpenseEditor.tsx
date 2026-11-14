import { useState, type FormEvent } from "react";
import type { ExpenseInput } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { SPEND_CATEGORIES, type Expense, type Member, type SpendCategory } from "../lib/types";
import { MoneyFields, moneyValue, readMoney } from "./MoneyFields";
import { Sheet } from "./Sheet";

export function ExpenseEditor({
  expense,
  defaultDay,
  home,
  defaultCurrency,
  members,
  userId,
  onSave,
  onDelete,
  onClose,
}: {
  expense?: Expense;
  defaultDay: string;
  home: string;
  defaultCurrency: string;
  members: Member[];
  userId: string;
  onSave: (input: ExpenseInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(expense?.description ?? "");
  const [money, setMoney] = useState(() =>
    moneyValue(expense?.amount ?? null, expense?.currency ?? defaultCurrency, expense?.home_amount ?? null),
  );
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? defaultDay);
  const [category, setCategory] = useState<SpendCategory>(expense?.category ?? "food");
  const [paidBy, setPaidBy] = useState(expense ? (expense.paid_by ?? "") : userId);
  const [split, setSplit] = useState<"shared" | "personal">(expense?.split ?? "shared");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const cost = readMoney(money, home);
      if (!cost || cost.amount <= 0) throw new Error("Enter how much it cost.");
      await onSave({
        description: description.trim(),
        amount: cost.amount,
        currency: cost.currency,
        home_amount: cost.home,
        spent_on: spentOn,
        category,
        paid_by: paidBy || null,
        split,
      });
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete || !window.confirm(`Delete "${description}"?`)) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  const payer = members.find((m) => m.user_id === paidBy)?.display_name ?? "the payer";

  return (
    <Sheet title={expense ? "Edit spending" : "Add spending"} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>What for</span>
          <input
            required
            maxLength={200}
            placeholder="Dinner at Ningxia Night Market"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <MoneyFields value={money} onChange={setMoney} home={home} label="Amount" required />

        <div className="row-2">
          <label className="field">
            <span>Date</span>
            <input type="date" required value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as SpendCategory)}>
              {SPEND_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {members.length > 1 && (
          <>
            <label className="field">
              <span>Paid by</span>
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="fieldset choice">
              <legend>Who it was for</legend>
              <label>
                <input type="radio" name="split" checked={split === "shared"} onChange={() => setSplit("shared")} />
                Both of us, split evenly
              </label>
              <label>
                <input type="radio" name="split" checked={split === "personal"} onChange={() => setSplit("personal")} />
                Just {payer}
              </label>
            </fieldset>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="button-row">
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          {onDelete && (
            <button type="button" className="button danger" onClick={() => void remove()} disabled={busy}>
              Delete
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
