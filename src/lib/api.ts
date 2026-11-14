import { supabase } from "./supabase";
import type { Member, Stop, StopDraft, Trip, TripBundle } from "./types";

type Result<T> = { data: T; error: unknown };

function check<T>(result: Result<T>): T {
  if (result.error) throw result.error;
  return result.data;
}

type MemberRow = { user_id: string; profiles: { display_name: string } | null };

export async function listTrips(): Promise<Trip[]> {
  const data = check(await supabase.from("trips").select("*").order("start_date"));
  return (data ?? []) as Trip[];
}

export async function loadTrip(tripId: string): Promise<TripBundle> {
  const [trip, stops, members] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("stops").select("*").eq("trip_id", tripId).order("position"),
    supabase.from("trip_members").select("user_id, profiles(display_name)").eq("trip_id", tripId),
  ]);
  return {
    trip: check(trip) as Trip,
    stops: (check(stops) ?? []) as Stop[],
    members: ((check(members) ?? []) as unknown as MemberRow[]).map(
      (row): Member => ({
        user_id: row.user_id,
        display_name: row.profiles?.display_name ?? "Traveller",
      }),
    ),
  };
}

export type TripInput = Pick<Trip, "name" | "start_date" | "end_date" | "home_currency">;

export async function createTrip(input: TripInput): Promise<Trip> {
  return check(await supabase.from("trips").insert(input).select().single()) as Trip;
}

export async function updateTrip(tripId: string, input: TripInput): Promise<void> {
  check(await supabase.from("trips").update(input).eq("id", tripId));
}

export async function deleteTrip(tripId: string): Promise<void> {
  check(await supabase.from("trips").delete().eq("id", tripId));
}

export async function addMember(tripId: string, email: string): Promise<void> {
  check(await supabase.rpc("add_trip_member", { p_trip: tripId, p_email: email }));
}

export async function saveStop(tripId: string, draft: StopDraft, position: number): Promise<void> {
  const row = {
    trip_id: tripId,
    title: draft.title.trim(),
    day: draft.day,
    start_time: draft.start_time || null,
    category: draft.category,
    notes: draft.notes.trim(),
    address: draft.address,
    lat: draft.lat,
    lng: draft.lng,
    position,
  };
  if (draft.id) {
    check(await supabase.from("stops").update(row).eq("id", draft.id));
  } else {
    check(await supabase.from("stops").insert(row));
  }
}

export async function moveStop(stopId: string, day: string | null, position: number): Promise<void> {
  check(await supabase.from("stops").update({ day, position }).eq("id", stopId));
}

export async function deleteStop(stopId: string): Promise<void> {
  check(await supabase.from("stops").delete().eq("id", stopId));
}

export async function loadDisplayName(userId: string): Promise<string> {
  const data = check(
    await supabase.from("profiles").select("display_name").eq("id", userId).single(),
  ) as { display_name: string };
  return data.display_name;
}

export async function saveDisplayName(userId: string, name: string): Promise<void> {
  check(await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", userId));
}

export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// The position that puts a stop at the end of a day's list.
export function endPosition(stops: Stop[], day: string | null, excludeId?: string): number {
  const positions = stops
    .filter((s) => s.day === day && s.id !== excludeId)
    .map((s) => s.position);
  return positions.length ? Math.max(...positions) + 1000 : 1000;
}
