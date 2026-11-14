import { useState, type FormEvent } from "react";
import { addMember, deleteTrip, updateTrip } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { go } from "../lib/router";
import type { TripBundle } from "../lib/types";
import { Sheet } from "./Sheet";
import { TripForm } from "./TripForm";

export function TripSettings({
  bundle,
  onChanged,
  onClose,
}: {
  bundle: TripBundle;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { trip, members } = bundle;
  const [email, setEmail] = useState("");
  const [memberNote, setMemberNote] = useState("");
  const [deleteNote, setDeleteNote] = useState("");

  async function submitMember(event: FormEvent) {
    event.preventDefault();
    try {
      await addMember(trip.id, email);
      setEmail("");
      setMemberNote("Added.");
      onChanged();
    } catch (err) {
      setMemberNote(friendlyError(err));
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${trip.name}" and everything planned in it? This can't be undone.`)) return;
    try {
      await deleteTrip(trip.id);
      onClose();
      go("#/");
    } catch (err) {
      setDeleteNote(friendlyError(err));
    }
  }

  return (
    <Sheet title="Trip settings" onClose={onClose}>
      <TripForm
        initial={trip}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await updateTrip(trip.id, input);
          onChanged();
          onClose();
        }}
      />

      <section className="stack section-gap">
        <h3>Travellers</h3>
        <ul className="plain-list">
          {members.map((m) => (
            <li key={m.user_id}>{m.display_name}</li>
          ))}
        </ul>
        <form onSubmit={submitMember} className="stack">
          <label className="field">
            <span>Add a traveller by their account email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {memberNote && <p className="note">{memberNote}</p>}
          <button className="button">Add traveller</button>
        </form>
      </section>

      <section className="stack section-gap">
        <h3>Delete trip</h3>
        {deleteNote && (
          <p className="error" role="alert">
            {deleteNote}
          </p>
        )}
        <button type="button" className="button danger" onClick={() => void remove()}>
          Delete this trip
        </button>
      </section>
    </Sheet>
  );
}
