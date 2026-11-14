import { supabase } from "./supabase";
import type {
  Booking,
  BudgetLine,
  Expense,
  Member,
  PackingItem,
  SpendCategory,
  Stop,
  StopDraft,
  Trip,
  TripBundle,
} from "./types";

type Result<T> = { data: T; error: unknown };

function check<T>(result: Result<T>): T {
  if (result.error) throw result.error;
  return result.data;
}

// The extras' tables come from a second setup script. Until it has run, treat
// them as empty instead of failing to open the trip.
function optional<T>(result: Result<T[] | null>): T[] {
  const code = (result.error as { code?: string } | null)?.code;
  if (code === "PGRST205" || code === "42P01") return [];
  return (check(result) ?? []) as T[];
}

// Supabase can return money as text; make sure it's a number.
function money<T extends object>(row: T, keys: (keyof T)[]): T {
  const copy = { ...row };
  for (const key of keys) {
    const value = copy[key];
    if (value !== null && value !== undefined) copy[key] = Number(value) as T[keyof T];
  }
  return copy;
}

type MemberRow = { user_id: string; profiles: { display_name: string } | null };

export async function listTrips(): Promise<Trip[]> {
  const data = check(await supabase.from("trips").select("*").order("start_date"));
  return (data ?? []) as Trip[];
}

export async function loadTrip(tripId: string): Promise<TripBundle> {
  const [trip, stops, members, bookings, expenses, budget, packing] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("stops").select("*").eq("trip_id", tripId).order("position"),
    supabase.from("trip_members").select("user_id, profiles(display_name)").eq("trip_id", tripId),
    supabase.from("bookings").select("*").eq("trip_id", tripId).order("starts_on").order("start_time"),
    supabase.from("expenses").select("*").eq("trip_id", tripId).order("spent_on", { ascending: false }),
    supabase.from("budget_lines").select("*").eq("trip_id", tripId),
    supabase.from("packing_items").select("*").eq("trip_id", tripId).order("position"),
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
    bookings: optional<Booking>(bookings).map((b) => money(b, ["cost", "home_cost"])),
    expenses: optional<Expense>(expenses).map((e) => money(e, ["amount", "home_amount"])),
    budget: optional<BudgetLine>(budget).map((l) => money(l, ["planned"])),
    packing: optional<PackingItem>(packing),
  };
}

// Bookings

export type BookingInput = Omit<Booking, "id" | "trip_id" | "updated_at">;

export async function saveBooking(tripId: string, input: BookingInput, id?: string): Promise<void> {
  const row = { ...input, trip_id: tripId };
  if (id) check(await supabase.from("bookings").update(row).eq("id", id));
  else check(await supabase.from("bookings").insert(row));
}

export async function deleteBooking(id: string): Promise<void> {
  check(await supabase.from("bookings").delete().eq("id", id));
}

// Budget

export type ExpenseInput = Omit<Expense, "id" | "trip_id" | "updated_at">;

export async function saveExpense(tripId: string, input: ExpenseInput, id?: string): Promise<void> {
  const row = { ...input, trip_id: tripId };
  if (id) check(await supabase.from("expenses").update(row).eq("id", id));
  else check(await supabase.from("expenses").insert(row));
}

export async function deleteExpense(id: string): Promise<void> {
  check(await supabase.from("expenses").delete().eq("id", id));
}

export async function savePlanned(tripId: string, planned: Record<SpendCategory, number>): Promise<void> {
  const rows = Object.entries(planned).map(([category, value]) => ({ trip_id: tripId, category, planned: value }));
  check(await supabase.from("budget_lines").upsert(rows, { onConflict: "trip_id,category" }));
}

// Packing

export async function addPackingItems(
  tripId: string,
  items: { label: string; owner: string | null; position: number }[],
): Promise<void> {
  check(await supabase.from("packing_items").insert(items.map((i) => ({ ...i, trip_id: tripId }))));
}

export async function setPacked(id: string, packed: boolean): Promise<void> {
  check(await supabase.from("packing_items").update({ packed }).eq("id", id));
}

export async function unpackAll(tripId: string): Promise<void> {
  check(await supabase.from("packing_items").update({ packed: false }).eq("trip_id", tripId).eq("packed", true));
}

export async function deletePackingItem(id: string): Promise<void> {
  check(await supabase.from("packing_items").delete().eq("id", id));
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
