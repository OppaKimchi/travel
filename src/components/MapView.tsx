import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { formatDay, formatTime, todayIso } from "../lib/dates";
import { directionsUrl } from "../lib/geocode";
import type { Stop } from "../lib/types";

const ALL = "all";
const IDEAS = "ideas";
const PALETTE_SIZE = 8;

type Located = Stop & { lat: number; lng: number };

function isLocated(stop: Stop): stop is Located {
  return stop.lat !== null && stop.lng !== null;
}

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(label: string, colour: string): L.DivIcon {
  const key = `${label}|${colour}`;
  let icon = iconCache.get(key);
  if (!icon) {
    // The label is only ever a number or a star, never text you typed.
    icon = L.divIcon({
      className: `pin ${colour}`,
      html: `<span class="pin-drop"><span class="pin-label">${label}</span></span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function FitToStops({ points, focusKey }: { points: [number, number][]; focusKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16 });
    // Re-fit only when the chosen day changes or stops are added or moved.
  }, [map, focusKey]);
  return null;
}

export function MapView({
  days,
  stops,
  onOpen,
}: {
  days: string[];
  stops: Stop[];
  onOpen: (stop: Stop) => void;
}) {
  const today = todayIso();
  const [filter, setFilter] = useState(days.includes(today) ? today : ALL);

  const located = useMemo(
    () => stops.filter(isLocated).sort((a, b) => a.position - b.position),
    [stops],
  );

  const colourFor = (stop: Stop) => {
    if (!stop.day) return "pin-idea";
    const index = days.indexOf(stop.day);
    return index === -1 ? "pin-idea" : `pin-c${index % PALETTE_SIZE}`;
  };

  const visible = located.filter((s) =>
    filter === ALL ? true : filter === IDEAS ? s.day === null : s.day === filter,
  );

  // Number stops in visiting order within each day.
  const labelFor = (stop: Located) => {
    if (!stop.day) return "★";
    return String(located.filter((s) => s.day === stop.day).indexOf(stop) + 1);
  };

  const route = filter !== ALL && filter !== IDEAS ? visible.map((s) => [s.lat, s.lng] as [number, number]) : [];
  const points = visible.map((s) => [s.lat, s.lng] as [number, number]);
  const focusKey = `${filter}|${points.map((p) => p.join(",")).join(";")}`;
  const daysWithPlaces = days.filter((day) => located.some((s) => s.day === day));

  return (
    <div className="map-page">
      <nav className="day-chips map-chips" aria-label="Show on the map">
        <button type="button" className={`chip${filter === ALL ? " chip-active" : ""}`} onClick={() => setFilter(ALL)}>
          All
        </button>
        {daysWithPlaces.map((day) => (
          <button
            key={day}
            type="button"
            className={`chip${filter === day ? " chip-active" : ""}`}
            onClick={() => setFilter(day)}
          >
            {day === today ? "Today" : `D${days.indexOf(day) + 1}`}
          </button>
        ))}
        {located.some((s) => s.day === null) && (
          <button type="button" className={`chip${filter === IDEAS ? " chip-active" : ""}`} onClick={() => setFilter(IDEAS)}>
            Ideas
          </button>
        )}
      </nav>

      {located.length === 0 && (
        <p className="map-empty">Add a location to a stop and it will appear here.</p>
      )}

      <MapContainer className="map" center={[20, 0]} zoom={2} worldCopyJump>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          crossOrigin=""
          maxZoom={19}
        />
        <FitToStops points={points} focusKey={focusKey} />
        {route.length > 1 && <Polyline positions={route} pathOptions={{ className: "route-line" }} />}
        {visible.map((stop) => (
          <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={pinIcon(labelFor(stop), colourFor(stop))}>
            <Popup>
              <div className="popup">
                <strong>{stop.title}</strong>
                <span>
                  {stop.day ? formatDay(stop.day) : "Idea"}
                  {stop.start_time ? ` · ${formatTime(stop.start_time)}` : ""}
                </span>
                {stop.address && <span className="popup-address">{stop.address}</span>}
                <span className="popup-actions">
                  <a href={directionsUrl(stop.lat, stop.lng)} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                  <button type="button" className="link-button" onClick={() => onOpen(stop)}>
                    Edit
                  </button>
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
