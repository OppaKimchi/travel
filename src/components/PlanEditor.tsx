import { useState, type FormEvent } from "react";
import { friendlyError } from "../lib/errors";
import { parseAmount, roundMoney } from "../lib/money";
import { SPEND_CATEGORIES, type BudgetLine, type SpendCategory } from "../lib/types";
import { Sheet } from "./Sheet";

export function PlanEditor({
  budget,
  home,
  onSave,
  onClose,
}: {
  budget: BudgetLine[];
  home: string;
  onSave: (planned: Record<SpendCategory, number>) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<SpendCategory, string>>(() => {
    const initial = {} as Record<SpendCategory, string>;
    for (const { value } of SPEND_CATEGORIES) {
      const line = budget.find((l) => l.category === value);
      initial[value] = line && line.planned > 0 ? String(line.planned) : "";
    }
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = SPEND_CATEGORIES.reduce((sum, { value }) => sum + (parseAmount(values[value]) ?? 0), 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const planned = {} as Record<SpendCategory, number>;
      for (const { value, label } of SPEND_CATEGORIES) {
        const amount = values[value].trim() === "" ? 0 : parseAmount(values[value]);
        if (amount === null) throw new Error(`Check the amount for ${label.toLowerCase()}.`);
        planned[value] = roundMoney(amount);
      }
      await onSave(planned);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title="Plan the budget" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <p className="muted">How much you expect to spend on each, in {home}. Leave any blank.</p>
        {SPEND_CATEGORIES.map(({ value, label }) => (
          <label key={value} className="field field-inline">
            <span>{label}</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={values[value]}
              onChange={(e) => setValues((current) => ({ ...current, [value]: e.target.value }))}
            />
          </label>
        ))}
        <p className="plan-total">
          Total <strong>{home} {roundMoney(total).toLocaleString("en-AU")}</strong>
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save budget"}
        </button>
      </form>
    </Sheet>
  );
}
