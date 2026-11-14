import { useState, type FormEvent } from "react";
import type { BookingInput } from "../lib/api";
import { phaseLabels } from "../lib/bookings";
import { friendlyError } from "../lib/errors";
import { BOOKING_KINDS, type Booking, type BookingKind, type Member } from "../lib/types";
import { MoneyFields, moneyValue, readMoney } from "./MoneyFields";
import { NoteLinks } from "./NoteLinks";
import { Sheet } from "./Sheet";

export function BookingEditor({
  booking,
  defaultDay,
  home,
  defaultCurrency,
  members,
  userId,
  onSave,
  onDelete,
  onClose,
}: {
  booking?: Booking;
  defaultDay: string;
  home: string;
  defaultCurrency: string;
  members: Member[];
  userId: string;
  onSave: (input: BookingInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<BookingKind>(booking?.kind ?? "flight");
  const [title, setTitle] = useState(booking?.title ?? "");
  const [provider, setProvider] = useState(booking?.provider ?? "");
  const [reference, setReference] = useState(booking?.reference ?? "");
  const [startsOn, setStartsOn] = useState(booking?.starts_on ?? defaultDay);
  const [startTime, setStartTime] = useState(booking?.start_time?.slice(0, 5) ?? "");
  const [endsOn, setEndsOn] = useState(booking?.ends_on ?? "");
  const [endTime, setEndTime] = useState(booking?.end_time?.slice(0, 5) ?? "");
  const [startPlace, setStartPlace] = useState(booking?.start_place ?? "");
  const [endPlace, setEndPlace] = useState(booking?.end_place ?? "");
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [money, setMoney] = useState(() =>
    moneyValue(booking?.cost ?? null, booking?.currency ?? defaultCurrency, booking?.home_cost ?? null),
  );
  const [paidBy, setPaidBy] = useState(booking ? (booking.paid_by ?? "") : userId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const labels = phaseLabels(kind);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (endsOn && endsOn < startsOn) {
      setError(`${labels.end} can't be before ${labels.start.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    try {
      const cost = readMoney(money, home);
      await onSave({
        kind,
        title: title.trim(),
        provider: provider.trim() || null,
        reference: reference.trim() || null,
        starts_on: startsOn,
        start_time: startTime || null,
        ends_on: endsOn || null,
        end_time: endTime || null,
        start_place: startPlace.trim() || null,
        end_place: labels.to ? endPlace.trim() || null : null,
        notes: notes.trim(),
        cost: cost?.amount ?? null,
        currency: cost?.currency ?? null,
        home_cost: cost?.home ?? null,
        paid_by: cost ? paidBy || null : null,
      });
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete || !window.confirm(`Delete the booking "${title}"?`)) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title={booking ? "Edit booking" : "Add a booking"} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as BookingKind)}>
            {BOOKING_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Title</span>
          <input
            required
            maxLength={200}
            placeholder={labels.example}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="row-2">
          <label className="field">
            <span>Company</span>
            <input maxLength={120} value={provider} onChange={(e) => setProvider(e.target.value)} />
          </label>
          <label className="field">
            <span>Confirmation number</span>
            <input
              maxLength={120}
              autoCapitalize="characters"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        </div>

        <div className="row-2">
          <label className="field">
            <span>{labels.start}</span>
            <input type="date" required value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </label>
          <label className="field">
            <span>Time</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
        </div>

        <div className="row-2">
          <label className="field">
            <span>{labels.end}</span>
            <input
              type="date"
              min={startsOn || undefined}
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Time</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>{labels.from}</span>
          <input maxLength={300} value={startPlace} onChange={(e) => setStartPlace(e.target.value)} />
        </label>
        {labels.to && (
          <label className="field">
            <span>{labels.to}</span>
            <input maxLength={300} value={endPlace} onChange={(e) => setEndPlace(e.target.value)} />
          </label>
        )}

        <fieldset className="fieldset">
          <legend>Cost (optional, counts towards the budget)</legend>
          <MoneyFields value={money} onChange={setMoney} home={home} label="Amount" />
          {money.amount.trim() !== "" && members.length > 1 && (
            <label className="field">
              <span>Paid by</span>
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                <option value="">Not recorded</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>

        <label className="field">
          <span>Notes</span>
          <textarea
            rows={3}
            maxLength={5000}
            placeholder="Seats, baggage, what's included…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <NoteLinks text={notes} />

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
