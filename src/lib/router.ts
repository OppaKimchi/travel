import { useSyncExternalStore } from "react";

// Pages live in the URL hash (#/trip/<id>/map) because GitHub Pages can't
// send every path to the app.

export const TABS = ["plan", "map", "bookings", "budget", "packing"] as const;
export type Tab = (typeof TABS)[number];

export type Route = { name: "trips" } | { name: "trip"; tripId: string; tab: Tab };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "trip" && parts[1]) {
    const tab = (TABS as readonly string[]).includes(parts[2] ?? "") ? (parts[2] as Tab) : "plan";
    return { name: "trip", tripId: parts[1], tab };
  }
  return { name: "trips" };
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function snapshot() {
  return window.location.hash;
}

export function useRoute(): Route {
  return parseHash(useSyncExternalStore(subscribe, snapshot));
}

export function tripPath(tripId: string, tab: Tab = "plan"): string {
  return `#/trip/${tripId}/${tab}`;
}

export function go(path: string): void {
  window.location.hash = path;
}
