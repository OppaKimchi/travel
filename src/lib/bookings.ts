import type { Booking, BookingKind } from "./types";

export type PhaseLabels = {
  start: string;
  end: string;
  from: string;
  to: string | null;
  example: string;
};

export function phaseLabels(kind: BookingKind): PhaseLabels {
  switch (kind) {
    case "flight":
      return { start: "Departs", end: "Arrives", from: "From", to: "To", example: "CI 52 Sydney to Taipei" };
    case "train":
    case "bus":
    case "ferry":
      return { start: "Departs", end: "Arrives", from: "From", to: "To", example: "Taipei to Hualien" };
    case "stay":
      return { start: "Check in", end: "Check out", from: "Address", to: null, example: "Hotel name" };
    case "car":
      return { start: "Pick up", end: "Drop off", from: "Pick-up location", to: "Drop-off location", example: "Car hire company" };
    default:
      return { start: "Starts", end: "Ends", from: "Where", to: null, example: "What it's for" };
  }
}

export type DayBooking = {
  booking: Booking;
  label: string;
  time: string | null;
  endTime: string | null;
};

// What each booking means for a given day: departing, arriving, checking in,
// checking out, or staying somewhere overnight.
export function bookingsOnDay(bookings: Booking[], day: string): DayBooking[] {
  const result: DayBooking[] = [];
  for (const booking of bookings) {
    const labels = phaseLabels(booking.kind);
    const sameDay = !booking.ends_on || booking.ends_on === booking.starts_on;
    if (booking.starts_on === day) {
      result.push({
        booking,
        label: labels.start,
        time: booking.start_time,
        endTime: sameDay ? booking.end_time : null,
      });
    } else if (booking.ends_on === day) {
      result.push({ booking, label: labels.end, time: booking.end_time, endTime: null });
    } else if (booking.kind === "stay" && booking.ends_on && day > booking.starts_on && day < booking.ends_on) {
      result.push({ booking, label: "Staying at", time: null, endTime: null });
    }
  }
  return result.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
}

export function sortBookings(bookings: Booking[]): Booking[] {
  return [...bookings].sort(
    (a, b) =>
      a.starts_on.localeCompare(b.starts_on) || (a.start_time ?? "").localeCompare(b.start_time ?? ""),
  );
}
