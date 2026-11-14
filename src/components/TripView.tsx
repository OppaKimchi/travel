import { useMemo, useState } from "react";
import {
  deleteBooking,
  deleteExpense,
  deleteStop,
  endPosition,
  moveStop,
  saveBooking,
  saveExpense,
  savePlanned,
  saveStop,
} from "../lib/api";
import { readCache, writeCache } from "../lib/cache";
import { formatClock, formatRange, todayIso, tripDays } from "../lib/dates";
import { friendlyError } from "../lib/errors";
import { tripPath, type Tab } from "../lib/router";
import type { Booking, Expense, PackingItem, Stop, StopDraft } from "../lib/types";
import { useTrip } from "../lib/useTrip";
import { BookingEditor } from "./BookingEditor";
import { Bookings } from "./Bookings";
import { Budget } from "./Budget";
import { ExpenseEditor } from "./ExpenseEditor";
import { Icon, type IconName } from "./Icon";
import { Itinerary, type Placement } from "./Itinerary";
import { MapView } from "./MapView";
import { Packing } from "./Packing";
import { PlanEditor } from "./PlanEditor";
import { StopEditor } from "./StopEditor";
import { TripSettings } from "./TripSettings";

const TAB_ITEMS: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: "plan", label: "Plan", icon: "list" },
  { tab: "map", label: "Map", icon: "map" },
  { tab: "bookings", label: "Bookings", icon: "ticket" },
  { tab: "budget", label: "Budget", icon: "wallet" },
  { tab: "packing", label: "Packing", icon: "bag" },
];

type Editing =
  | { type: "stop"; draft: StopDraft; stop?: Stop }
  | { type: "booking"; booking?: Booking; day?: string }
  | { type: "expense"; expense?: Expense }
  | { type: "plan" }
  | null;

function draftFrom(stop: Stop): StopDraft {
  return {
    id: stop.id,
    title: stop.title,
    day: stop.day,
    start_time: stop.start_time?.slice(0, 5) ?? "",
    category: stop.category,
    notes: stop.notes,
    address: stop.address,
    lat: stop.lat,
    lng: stop.lng,
  };
}

function emptyDraft(day: string | null): StopDraft {
  return { title: "", day, start_time: "", category: "sight", notes: "", address: null, lat: null, lng: null };
}

export function TripView({
  tripId,
  tab,
  userId,
  sessionOffline,
}: {
  tripId: string;
  tab: Tab;
  userId: string;
  sessionOffline: boolean;
}) {
  const { bundle, setBundle, status, error, savedAt, refresh } = useTrip(tripId);
  const [editing, setEditing] = useState<Editing>(null);
  const [settings, setSettings] = useState(false);
  const [actionError, setActionError] = useState("");

  const days = useMemo(
    () => (bundle ? tripDays(bundle.trip.start_date, bundle.trip.end_date) : []),
    [bundle?.trip.start_date, bundle?.trip.end_date],
  );

  const offline = sessionOffline || status === "offline";

  if (!bundle) {
    return (
      <>
        <header className="app-bar">
          <a className="icon-button" href="#/" aria-label="All trips">
            <Icon name="back" />
          </a>
          <h1 className="app-title">Trip</h1>
        </header>
        <main className="page">
          {status === "loading" && <p className="muted">Loading the trip…</p>}
          {status === "offline" && <p className="banner">You're offline and this trip hasn't been saved on this phone yet.</p>}
          {status === "missing" && <p className="error">This trip doesn't exist, or you're not one of its travellers.</p>}
          {status === "error" && <p className="error">{error}</p>}
        </main>
      </>
    );
  }

  const { trip, stops, members } = bundle;
  const home = trip.home_currency;
  const today = todayIso();
  const defaultDay = days.includes(today) ? today : trip.start_date;
  const currencyKey = `currency:${trip.id}`;
  const lastCurrency = readCache<string>(currencyKey)?.data ?? home;

  async function handleSaveStop(draft: StopDraft, original?: Stop) {
    const position =
      original && original.day === draft.day ? original.position : endPosition(stops, draft.day, draft.id);
    await saveStop(trip.id, draft, position);
    await refresh();
  }

  function handlePlace(changes: Placement[]) {
    if (!changes.length) return;
    // Show the new order straight away, then save it.
    const byId = new Map(changes.map((c) => [c.id, c]));
    setBundle((current) =>
      current && {
        ...current,
        stops: current.stops.map((s) => {
          const change = byId.get(s.id);
          return change ? { ...s, day: change.day, position: change.position } : s;
        }),
      },
    );
    setActionError("");
    Promise.all(changes.map((c) => moveStop(c.id, c.day, c.position))).catch((err) => {
      setActionError(friendlyError(err));
      void refresh();
    });
  }

  function setPacking(update: (items: PackingItem[]) => PackingItem[]) {
    setBundle((current) => current && { ...current, packing: update(current.packing) });
  }

  const openStop = (stop: Stop) => setEditing({ type: "stop", draft: draftFrom(stop), stop });
  const openBooking = (booking: Booking) => setEditing({ type: "booking", booking });
  const openExpense = (expense: Expense) => setEditing({ type: "expense", expense });

  return (
    <>
      <header className="app-bar">
        <a className="icon-button" href="#/" aria-label="All trips">
          <Icon name="back" />
        </a>
        <div className="app-title-block">
          <h1 className="app-title">{trip.name}</h1>
          <p className="app-subtitle">
            {formatRange(trip.start_date, trip.end_date)}
            {members.length > 0 && ` · ${members.map((m) => m.display_name).join(" and ")}`}
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setSettings(true)}
          aria-label="Trip settings"
          disabled={offline}
        >
          <Icon name="settings" />
        </button>
      </header>

      {offline && (
        <p className="banner banner-flush">
          <Icon name="cloudOff" size={16} /> Offline. Showing the copy saved{" "}
          {savedAt ? `at ${formatClock(savedAt)}` : "earlier"}. Changes need a connection.
        </p>
      )}
      {actionError && (
        <p className="error banner-flush" role="alert">
          {actionError}
        </p>
      )}

      <main className={tab === "map" ? "page page-map" : "page"}>
        {tab === "plan" && (
          <Itinerary
            days={days}
            stops={stops}
            bookings={bundle.bookings}
            canEdit={!offline}
            onAdd={(day) => setEditing({ type: "stop", draft: emptyDraft(day) })}
            onOpen={openStop}
            onOpenBooking={openBooking}
            onPlace={handlePlace}
          />
        )}
        {tab === "map" && <MapView days={days} stops={stops} onOpen={openStop} />}
        {tab === "bookings" && (
          <Bookings
            bookings={bundle.bookings}
            days={days}
            home={home}
            canEdit={!offline}
            onAdd={() => setEditing({ type: "booking" })}
            onOpen={openBooking}
          />
        )}
        {tab === "budget" && (
          <Budget
            bundle={bundle}
            canEdit={!offline}
            onAddExpense={() => setEditing({ type: "expense" })}
            onOpenExpense={openExpense}
            onOpenBooking={openBooking}
            onEditPlan={() => setEditing({ type: "plan" })}
          />
        )}
        {tab === "packing" && (
          <Packing
            tripId={trip.id}
            items={bundle.packing}
            members={members}
            userId={userId}
            canEdit={!offline}
            onItems={setPacking}
            onRefresh={refresh}
          />
        )}
      </main>

      <nav className="tab-bar" aria-label="Trip sections">
        {TAB_ITEMS.map((item) => (
          <a
            key={item.tab}
            className={tab === item.tab ? "tab tab-active" : "tab"}
            href={tripPath(trip.id, item.tab)}
            aria-current={tab === item.tab ? "page" : undefined}
          >
            <Icon name={item.icon} />
            {item.label}
          </a>
        ))}
      </nav>

      {editing?.type === "stop" && (
        <StopEditor
          key={editing.stop?.id ?? "new"}
          initial={editing.draft}
          days={days}
          onSave={(draft) => handleSaveStop(draft, editing.stop)}
          onDelete={
            editing.stop
              ? async () => {
                  await deleteStop(editing.stop!.id);
                  await refresh();
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}

      {editing?.type === "booking" && (
        <BookingEditor
          booking={editing.booking}
          defaultDay={editing.day ?? defaultDay}
          home={home}
          defaultCurrency={lastCurrency}
          members={members}
          userId={userId}
          onSave={async (input) => {
            await saveBooking(trip.id, input, editing.booking?.id);
            if (input.currency) writeCache(currencyKey, input.currency);
            await refresh();
          }}
          onDelete={
            editing.booking
              ? async () => {
                  await deleteBooking(editing.booking!.id);
                  await refresh();
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}

      {editing?.type === "expense" && (
        <ExpenseEditor
          expense={editing.expense}
          defaultDay={today}
          home={home}
          defaultCurrency={lastCurrency}
          members={members}
          userId={userId}
          onSave={async (input) => {
            await saveExpense(trip.id, input, editing.expense?.id);
            writeCache(currencyKey, input.currency);
            await refresh();
          }}
          onDelete={
            editing.expense
              ? async () => {
                  await deleteExpense(editing.expense!.id);
                  await refresh();
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}

      {editing?.type === "plan" && (
        <PlanEditor
          budget={bundle.budget}
          home={home}
          onSave={async (planned) => {
            await savePlanned(trip.id, planned);
            await refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {settings && (
        <TripSettings bundle={bundle} onChanged={() => void refresh()} onClose={() => setSettings(false)} />
      )}
    </>
  );
}
