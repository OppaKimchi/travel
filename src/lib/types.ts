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

export type TripBundle = {
  trip: Trip;
  stops: Stop[];
  members: Member[];
};

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
