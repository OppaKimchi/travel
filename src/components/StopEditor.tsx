import { useState, type FormEvent } from "react";
import { formatDay } from "../lib/dates";
import { friendlyError } from "../lib/errors";
import { directionsUrl, searchPlaces, type PlaceResult } from "../lib/geocode";
import { CATEGORIES, type Category, type StopDraft } from "../lib/types";
import { NoteLinks } from "./NoteLinks";
import { Sheet } from "./Sheet";

export function StopEditor({
  initial,
  days,
  onSave,
  onDelete,
  onClose,
}: {
  initial: StopDraft;
  days: string[];
  onSave: (draft: StopDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<StopDraft>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (patch: Partial<StopDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // Days outside the trip's dates (after the dates changed) stay selectable.
  const dayOptions = draft.day && !days.includes(draft.day) ? [...days, draft.day].sort() : days;

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults(null);
    try {
      const found = await searchPlaces(query);
      setResults(found);
      if (!found.length) setSearchError("No places found. Try adding the city, or paste a Google Maps link.");
    } catch (err) {
      setSearchError(friendlyError(err));
    } finally {
      setSearching(false);
    }
  }

  function choose(place: PlaceResult) {
    update({
      title: draft.title.trim() ? draft.title : place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    setResults(null);
    setQuery("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(draft);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete || !window.confirm(`Remove "${draft.title}" from the plan?`)) return;
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
    <Sheet title={draft.id ? "Edit stop" : "Add a stop"} onClose={onClose}>
      <div className="stack">
        <div className="field">
          <label htmlFor="place-search">Find a place</label>
          <div className="search-row">
            <input
              id="place-search"
              type="search"
              placeholder="Name and city, or a Google Maps link"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
            />
            <button type="button" className="button" onClick={() => void search()} disabled={searching}>
              {searching ? "…" : "Search"}
            </button>
          </div>
          {searchError && <p className="note">{searchError}</p>}
          {results && results.length > 0 && (
            <ul className="results">
              {results.map((place) => (
                <li key={`${place.lat},${place.lng},${place.address}`}>
                  <button type="button" onClick={() => choose(place)}>
                    <strong>{place.name}</strong>
                    <span>{place.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="fine-print">Place search by OpenStreetMap.</p>
        </div>

        {draft.lat !== null && draft.lng !== null && (
          <div className="location">
            <span>{draft.address}</span>
            <span className="location-actions">
              <a href={directionsUrl(draft.lat, draft.lng)} target="_blank" rel="noreferrer">
                Directions
              </a>
              <button type="button" className="link-button" onClick={() => update({ address: null, lat: null, lng: null })}>
                Remove location
              </button>
            </span>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="stack section-gap">
        <label className="field">
          <span>Title</span>
          <input required maxLength={200} value={draft.title} onChange={(e) => update({ title: e.target.value })} />
        </label>

        <label className="field">
          <span>Day</span>
          <select value={draft.day ?? ""} onChange={(e) => update({ day: e.target.value || null })}>
            <option value="">Ideas (no day yet)</option>
            {dayOptions.map((day) => (
              <option key={day} value={day}>
                {days.includes(day) ? `Day ${days.indexOf(day) + 1} · ${formatDay(day)}` : formatDay(day)}
              </option>
            ))}
          </select>
        </label>

        <div className="row-2">
          <label className="field">
            <span>Time (optional)</span>
            <input
              type="time"
              value={draft.start_time}
              onChange={(e) => update({ start_time: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={draft.category} onChange={(e) => update({ category: e.target.value as Category })}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea
            rows={4}
            maxLength={5000}
            placeholder="Opening hours, what to order, booking details…"
            value={draft.notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </label>
        <NoteLinks text={draft.notes} />

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
              Remove
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
