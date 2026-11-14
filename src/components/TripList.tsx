import { useCallback, useEffect, useState } from "react";
import { createTrip, listTrips } from "../lib/api";
import { readCache, writeCache } from "../lib/cache";
import { daysBetween, formatRange, todayIso } from "../lib/dates";
import { friendlyError, isNetworkError } from "../lib/errors";
import { go, tripPath } from "../lib/router";
import type { CurrentUser } from "../lib/session";
import type { Trip } from "../lib/types";
import { AccountSheet } from "./AccountSheet";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { TripForm } from "./TripForm";

function countdown(trip: Trip): string {
  const today = todayIso();
  const untilStart = daysBetween(today, trip.start_date);
  if (untilStart > 1) return `In ${untilStart} days`;
  if (untilStart === 1) return "Tomorrow";
  if (today <= trip.end_date) {
    const day = daysBetween(trip.start_date, today) + 1;
    const total = daysBetween(trip.start_date, trip.end_date) + 1;
    return `Day ${day} of ${total}`;
  }
  return "Finished";
}

export function TripList({ user }: { user: CurrentUser }) {
  const [trips, setTrips] = useState<Trip[] | null>(() => readCache<Trip[]>("trips")?.data ?? null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [account, setAccount] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const fresh = await listTrips();
      setTrips(fresh);
      writeCache("trips", fresh);
      setOffline(false);
      setError("");
    } catch (err) {
      if (isNetworkError(err)) setOffline(true);
      else setError(friendlyError(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [refresh]);

  const upcoming = (trips ?? []).filter((t) => t.end_date >= todayIso());
  const past = (trips ?? []).filter((t) => t.end_date < todayIso()).reverse();

  return (
    <>
      <header className="app-bar">
        <h1 className="app-title">Our Trips</h1>
        <button type="button" className="icon-button" onClick={() => setAccount(true)} aria-label="Your account">
          <Icon name="user" />
        </button>
      </header>

      <main className="page">
        {offline && <p className="banner">You're offline, so this is the list saved on this phone.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {trips === null && !error && <p className="muted">Loading your trips…</p>}

        {trips !== null && trips.length === 0 && (
          <div className="empty">
            <p>No trips yet. Create your first one to start planning.</p>
          </div>
        )}

        {upcoming.length > 0 && <TripCards trips={upcoming} />}

        <button type="button" className="button primary wide" onClick={() => setCreating(true)} disabled={offline}>
          <Icon name="plus" /> New trip
        </button>

        {past.length > 0 && (
          <>
            <h2 className="section-title">Past trips</h2>
            <TripCards trips={past} />
          </>
        )}
      </main>

      {creating && (
        <Sheet title="New trip" onClose={() => setCreating(false)}>
          <TripForm
            submitLabel="Create trip"
            onSubmit={async (input) => {
              const trip = await createTrip(input);
              setCreating(false);
              go(tripPath(trip.id));
            }}
          />
        </Sheet>
      )}

      {account && <AccountSheet user={user} onClose={() => setAccount(false)} />}
    </>
  );
}

function TripCards({ trips }: { trips: Trip[] }) {
  return (
    <ul className="trip-cards">
      {trips.map((trip) => (
        <li key={trip.id}>
          <a className="trip-card" href={tripPath(trip.id)}>
            <span className="trip-card-name">{trip.name}</span>
            <span className="muted">{formatRange(trip.start_date, trip.end_date)}</span>
            <span className="tag">{countdown(trip)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
