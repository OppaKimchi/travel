import { useState, type FormEvent } from "react";
import type { TripInput } from "../lib/api";
import { friendlyError } from "../lib/errors";

export function TripForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: TripInput;
  submitLabel: string;
  onSubmit: (input: TripInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [start, setStart] = useState(initial?.start_date ?? "");
  const [end, setEnd] = useState(initial?.end_date ?? "");
  const [currency, setCurrency] = useState(initial?.home_currency ?? "AUD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (end < start) {
      setError("The trip has to end on or after the day it starts.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        name: name.trim(),
        start_date: start,
        end_date: end,
        home_currency: currency.trim().toUpperCase(),
      });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <label className="field">
        <span>Trip name</span>
        <input
          required
          maxLength={120}
          placeholder="Japan and Korea"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="row-2">
        <label className="field">
          <span>First day</span>
          <input type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>Last day</span>
          <input
            type="date"
            required
            min={start || undefined}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span>Home currency</span>
        <input
          required
          pattern="[A-Za-z]{3}"
          maxLength={3}
          title="A three-letter currency code, such as AUD"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
