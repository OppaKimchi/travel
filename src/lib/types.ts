export type Trip = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  home_currency: string;
  created_by: string;
  created_at: string;
};

export const CATEGORIES = [
  { value: "sight", label: "Sight" },
  { value: "food", label: "Food and drink" },
  { value: "stay", label: "Stay" },
  { value: "transport", label: "Transport" },
  { value: "activity", label: "Activity" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

export type Stop = {
  id: string;
  trip_id: string;
  day: string | null;
  position: number;
  title: string;
  start_time: string | null;
  category: Category;
  notes: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export type Member = {
  user_id: string;
  display_name: string;
};

export const BOOKING_KINDS = [
  { value: "flight", label: "Flight" },
  { value: "stay", label: "Stay" },
  { value: "train", label: "Train" },
  { value: "bus", label: "Bus" },
  { value: "ferry", label: "Ferry" },
  { value: "car", label: "Car hire" },
  { value: "tour", label: "Tour or ticket" },
  { value: "restaurant", label: "Restaurant" },
  { value: "other", label: "Other" },
] as const;

export type BookingKind = (typeof BOOKING_KINDS)[number]["value"];

export type Booking = {
  id: string;
  trip_id: string;
  kind: BookingKind;
  title: string;
  provider: string | null;
  reference: string | null;
  starts_on: string;
  start_time: string | null;
  ends_on: string | null;
  end_time: string | null;
  start_place: string | null;
  end_place: string | null;
  notes: string;
  cost: number | null;
  currency: string | null;
  home_cost: number | null;
  paid_by: string | null;
  updated_at: string;
};

export const SPEND_CATEGORIES = [
  { value: "food", label: "Food and drink" },
  { value: "transport", label: "Transport" },
  { value: "stay", label: "Accommodation" },
  { value: "activities", label: "Activities" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
] as const;

export type SpendCategory = (typeof SPEND_CATEGORIES)[number]["value"];

export type Expense = {
  id: string;
  trip_id: string;
  spent_on: string;
  description: string;
  category: SpendCategory;
  amount: number;
  currency: string;
  home_amount: number;
  paid_by: string | null;
  split: "shared" | "personal";
  updated_at: string;
};

export type BudgetLine = {
  trip_id: string;
  category: SpendCategory;
  planned: number;
};

export type PackingItem = {
  id: string;
  trip_id: string;
  label: string;
  owner: string | null;
  packed: boolean;
  position: number;
};

export type TripBundle = {
  trip: Trip;
  stops: Stop[];
  members: Member[];
  bookings: Booking[];
  expenses: Expense[];
  budget: BudgetLine[];
  packing: PackingItem[];
};

export function bookingKindLabel(value: BookingKind): string {
  return BOOKING_KINDS.find((k) => k.value === value)?.label ?? "Other";
}

export function spendCategoryLabel(value: SpendCategory): string {
  return SPEND_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

// Which budget category a booking's cost counts towards.
export function bookingSpendCategory(kind: BookingKind): SpendCategory {
  if (kind === "stay") return "stay";
  if (kind === "tour") return "activities";
  if (kind === "restaurant") return "food";
  if (kind === "other") return "other";
  return "transport";
}

export type StopDraft = {
  id?: string;
  title: string;
  day: string | null;
  start_time: string;
  category: Category;
  notes: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export function categoryLabel(value: Category): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}
