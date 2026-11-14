import { useEffect, useState, type FormEvent } from "react";
import { changePassword, loadDisplayName, saveDisplayName } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { signOut, type CurrentUser } from "../lib/session";
import { Sheet } from "./Sheet";

export function AccountSheet({ user, onClose }: { user: CurrentUser; onClose: () => void }) {
  const [name, setName] = useState("");
  const [nameNote, setNameNote] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordNote, setPasswordNote] = useState("");

  useEffect(() => {
    loadDisplayName(user.id).then(setName, () => undefined);
  }, [user.id]);

  async function submitName(event: FormEvent) {
    event.preventDefault();
    try {
      await saveDisplayName(user.id, name);
      setNameNote("Saved.");
    } catch (err) {
      setNameNote(friendlyError(err));
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setPasswordNote("The two passwords don't match.");
      return;
    }
    try {
      await changePassword(password);
      setPassword("");
      setConfirm("");
      setPasswordNote("Password changed.");
    } catch (err) {
      setPasswordNote(friendlyError(err));
    }
  }

  return (
    <Sheet title="Your account" onClose={onClose}>
      <p className="muted">Signed in as {user.email}</p>

      <form onSubmit={submitName} className="stack">
        <label className="field">
          <span>Your name, as your travel partner sees it</span>
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {nameNote && <p className="note">{nameNote}</p>}
        <button className="button">Save name</button>
      </form>

      <form onSubmit={submitPassword} className="stack section-gap">
        <h3>Change password</h3>
        <label className="field">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span>New password again</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {passwordNote && <p className="note">{passwordNote}</p>}
        <button className="button">Change password</button>
      </form>

      <button type="button" className="button danger section-gap" onClick={() => void signOut()}>
        Sign out
      </button>
    </Sheet>
  );
}
