import { useCallback, useEffect, useRef, useState } from "react";
import { loadTrip } from "./api";
import { readCache, writeCache } from "./cache";
import { friendlyError, isNetworkError } from "./errors";
import { supabase } from "./supabase";
import type { TripBundle } from "./types";

export type TripStatus = "loading" | "live" | "offline" | "missing" | "error";

export function useTrip(tripId: string) {
  const cacheKey = `trip:${tripId}`;
  const [bundle, setBundle] = useState<TripBundle | null>(
    () => readCache<TripBundle>(cacheKey)?.data ?? null,
  );
  const [savedAt, setSavedAt] = useState<string | null>(
    () => readCache<TripBundle>(cacheKey)?.savedAt ?? null,
  );
  const [status, setStatus] = useState<TripStatus>("loading");
  const [error, setError] = useState("");
  const stopIds = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const fresh = await loadTrip(tripId);
      stopIds.current = new Set(fresh.stops.map((s) => s.id));
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
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stops", filter: `trip_id=eq.${tripId}` }, soon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "stops" }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id && stopIds.current.has(id)) soon();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `id=eq.${tripId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_members", filter: `trip_id=eq.${tripId}` }, soon)
      .subscribe();

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
    if (bundle) stopIds.current = new Set(bundle.stops.map((s) => s.id));
  }, [bundle]);

  return { bundle, setBundle, status, error, savedAt, refresh };
}
