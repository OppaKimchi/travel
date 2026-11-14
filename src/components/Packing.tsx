import { useState, type FormEvent } from "react";
import { addPackingItems, deletePackingItem, setPacked, unpackAll } from "../lib/api";
import { friendlyError } from "../lib/errors";
import type { Member, PackingItem } from "../lib/types";
import { Icon } from "./Icon";

const STARTER_LIST = [
  "Passports",
  "Travel insurance details",
  "Copies of bookings",
  "Bank cards and some cash",
  "eSIM or SIM card",
  "Phone chargers and cables",
  "Power adapters",
  "Power bank",
  "Medications",
  "Toiletries",
  "Sunscreen and sunglasses",
  "Comfortable walking shoes",
  "Rain jacket or umbrella",
  "Reusable water bottle",
  "Earphones",
];

type Section = { owner: string | null; title: string };

export function Packing({
  tripId,
  items,
  members,
  userId,
  canEdit,
  onItems,
  onRefresh,
}: {
  tripId: string;
  items: PackingItem[];
  members: Member[];
  userId: string;
  canEdit: boolean;
  onItems: (update: (items: PackingItem[]) => PackingItem[]) => void;
  onRefresh: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const packed = items.filter((i) => i.packed).length;

  // Your own list first, then shared, then everyone else's.
  const sections: Section[] = [
    ...members.filter((m) => m.user_id === userId).map((m) => ({ owner: m.user_id, title: `${m.display_name}'s` })),
    { owner: null, title: "Shared" },
    ...members.filter((m) => m.user_id !== userId).map((m) => ({ owner: m.user_id, title: `${m.display_name}'s` })),
  ];

  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(friendlyError(err));
      await onRefresh();
    }
  }

  function toggle(item: PackingItem) {
    onItems((all) => all.map((i) => (i.id === item.id ? { ...i, packed: !item.packed } : i)));
    void run(() => setPacked(item.id, !item.packed));
  }

  function remove(item: PackingItem) {
    onItems((all) => all.filter((i) => i.id !== item.id));
    void run(() => deletePackingItem(item.id));
  }

  async function add(owner: string | null, labels: string[]) {
    const mine = items.filter((i) => i.owner === owner);
    const start = mine.length ? Math.max(...mine.map((i) => i.position)) : 0;
    await run(async () => {
      await addPackingItems(
        tripId,
        labels.map((label, n) => ({ label, owner, position: start + (n + 1) * 1000 })),
      );
      await onRefresh();
    });
  }

  function untickAll() {
    if (!window.confirm("Untick everything, ready to pack for the trip home?")) return;
    onItems((all) => all.map((i) => ({ ...i, packed: false })));
    void run(() => unpackAll(tripId));
  }

  return (
    <div className="packing">
      <div className="page-actions">
        <h2 className="page-heading">Packing</h2>
        {canEdit && packed > 0 && (
          <button type="button" className="button" onClick={untickAll}>
            Untick all
          </button>
        )}
      </div>

      {items.length > 0 && (
        <p className="muted packing-progress">
          {packed} of {items.length} packed
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 && canEdit && (
        <div className="empty">
          <p>Start with a list of the usual things, then add your own.</p>
          <button type="button" className="button" onClick={() => void add(null, STARTER_LIST)}>
            Add a starter list
          </button>
        </div>
      )}

      {sections.map((section) => {
        const list = items
          .filter((i) => i.owner === section.owner)
          .sort((a, b) => a.position - b.position);
        return (
          <PackingSection
            key={section.owner ?? "shared"}
            title={section.title}
            items={list}
            canEdit={canEdit}
            onToggle={toggle}
            onRemove={remove}
            onAdd={(label) => add(section.owner, [label])}
          />
        );
      })}
    </div>
  );
}

function PackingSection({
  title,
  items,
  canEdit,
  onToggle,
  onRemove,
  onAdd,
}: {
  title: string;
  items: PackingItem[];
  canEdit: boolean;
  onToggle: (item: PackingItem) => void;
  onRemove: (item: PackingItem) => void;
  onAdd: (label: string) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const packed = items.filter((i) => i.packed).length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = label.trim();
    if (!text) return;
    setLabel("");
    await onAdd(text);
  }

  return (
    <section className="packing-section">
      <h3 className="packing-heading">
        {title}
        {items.length > 0 && (
          <span className="muted">
            {packed}/{items.length}
          </span>
        )}
      </h3>
      <ul className="plain packing-list">
        {items.map((item) => (
          <li key={item.id} className={item.packed ? "packing-item packed" : "packing-item"}>
            <label>
              <input type="checkbox" checked={item.packed} disabled={!canEdit} onChange={() => onToggle(item)} />
              <span>{item.label}</span>
            </label>
            {canEdit && (
              <button type="button" className="icon-button small" aria-label={`Remove ${item.label}`} onClick={() => onRemove(item)}>
                <Icon name="close" size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form className="search-row packing-add" onSubmit={submit}>
          <input
            aria-label={`Add to ${title.toLowerCase()} list`}
            placeholder="Add an item"
            maxLength={200}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button className="button" disabled={!label.trim()}>
            Add
          </button>
        </form>
      )}
    </section>
  );
}
