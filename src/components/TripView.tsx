import { useMemo, useState } from "react";
import { deleteStop, endPosition, moveStop, saveStop } from "../lib/api";
import { formatClock, formatRange, tripDays } from "../lib/dates";
import { friendlyError } from "../lib/errors";
import { tripPath, type Tab } from "../lib/router";
import type { Stop, StopDraft } from "../lib/types";
import { useTrip } from "../lib/useTrip";
import { Icon } from "./Icon";
import { Itinerary, type Placement } from "./Itinerary";
import { MapView } from "./MapView";
import { StopEditor } from "./StopEditor";
import { TripSettings } from "./TripSettings";

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

export function TripView({ tripId, tab, sessionOffline }: { tripId: string; tab: Tab; sessionOffline: boolean }) {
  const { bundle, setBundle, status, error, savedAt, refresh } = useTrip(tripId);
  const [editing, setEditing] = useState<{ draft: StopDraft; stop?: Stop } | null>(null);
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

  async function handleSave(draft: StopDraft) {
    const original = editing?.stop;
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
        {tab === "plan" ? (
          <Itinerary
            days={days}
            stops={stops}
            canEdit={!offline}
            onAdd={(day) => setEditing({ draft: emptyDraft(day) })}
            onOpen={(stop) => setEditing({ draft: draftFrom(stop), stop })}
            onPlace={handlePlace}
          />
        ) : (
          <MapView days={days} stops={stops} onOpen={(stop) => setEditing({ draft: draftFrom(stop), stop })} />
        )}
      </main>

      <nav className="tab-bar" aria-label="Trip sections">
        <a className={tab === "plan" ? "tab tab-active" : "tab"} href={tripPath(trip.id, "plan")} aria-current={tab === "plan" ? "page" : undefined}>
          <Icon name="list" />
          Plan
        </a>
        <a className={tab === "map" ? "tab tab-active" : "tab"} href={tripPath(trip.id, "map")} aria-current={tab === "map" ? "page" : undefined}>
          <Icon name="map" />
          Map
        </a>
      </nav>

      {editing && (
        <StopEditor
          key={editing.stop?.id ?? "new"}
          initial={editing.draft}
          days={days}
          onSave={handleSave}
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

      {settings && (
        <TripSettings bundle={bundle} onChanged={() => void refresh()} onClose={() => setSettings(false)} />
      )}
    </>
  );
}
