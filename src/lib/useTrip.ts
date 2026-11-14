import { useCallback, useEffect, useRef, useState } from "react";
import { loadTrip } from "./api";
import { readCache, writeCache } from "./cache";
import { friendlyError, isNetworkError } from "./errors";
import { supabase } from "./supabase";
import type { TripBundle } from "./types";

export type TripStatus = "loading" | "live" | "offline" | "missing" | "error";

const TABLES_BY_TRIP = ["stops", "bookings", "expenses", "budget_lines", "packing_items", "trip_members"];
const TABLES_WITH_IDS = ["stops", "bookings", "expenses", "packing_items"];

// Copies saved on the phone before bookings, budget and packing existed.
function normalise(saved: TripBundle | null | undefined): TripBundle | null {
  if (!saved) return null;
  return {
    ...saved,
    bookings: saved.bookings ?? [],
    expenses: saved.expenses ?? [],
    budget: saved.budget ?? [],
    packing: saved.packing ?? [],
  };
}

function idsOf(bundle: TripBundle): Set<string> {
  return new Set(
    [...bundle.stops, ...bundle.bookings, ...bundle.expenses, ...bundle.packing].map((row) => row.id),
  );
}

export function useTrip(tripId: string) {
  const cacheKey = `trip:${tripId}`;
  const [bundle, setBundle] = useState<TripBundle | null>(() =>
    normalise(readCache<TripBundle>(cacheKey)?.data),
  );
  const [savedAt, setSavedAt] = useState<string | null>(
    () => readCache<TripBundle>(cacheKey)?.savedAt ?? null,
  );
  const [status, setStatus] = useState<TripStatus>("loading");
  const [error, setError] = useState("");
  const knownIds = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const fresh = await loadTrip(tripId);
      knownIds.current = idsOf(fresh);
      setBundle(fresh);
      setSavedAt(writeCache(cacheKey, fresh));
      setStatus("live");
      setError("");
    } catch (err) {
      if (isNetworkError(err)) {
        setStatus("offline");
      } else if ((err as { code?: string })?.code === "PGRST116") {
        setStatus("missing");
      } else {
        setStatus("error");
        setError(friendlyError(err));
      }
    }
  }, [tripId, cacheKey]);

  useEffect(() => {
    void refresh();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 300);
    };

    // Changes made on the other phone arrive here within a second or two.
    // Deletions only carry the row's id, so they're matched against known ids.
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `id=eq.${tripId}` }, soon);
    for (const table of TABLES_BY_TRIP) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `trip_id=eq.${tripId}` }, soon);
    }
    for (const table of TABLES_WITH_IDS) {
      channel.on("postgres_changes", { event: "DELETE", schema: "public", table }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id && knownIds.current.has(id)) soon();
      });
    }
    channel.subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") soon();
    };
    window.addEventListener("online", soon);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", soon);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [tripId, refresh]);

  useEffect(() => {
    if (bundle) knownIds.current = idsOf(bundle);
  }, [bundle]);

  return { bundle, setBundle, status, error, savedAt, refresh };
}
