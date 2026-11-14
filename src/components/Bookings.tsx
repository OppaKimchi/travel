import { useState } from "react";
import { phaseLabels, sortBookings } from "../lib/bookings";
import { formatDay, formatTime, todayIso } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { bookingKindLabel, type Booking } from "../lib/types";
import { Icon } from "./Icon";

export function Bookings({
  bookings,
  days,
  home,
  canEdit,
  onAdd,
  onOpen,
}: {
  bookings: Booking[];
  days: string[];
  home: string;
  canEdit: boolean;
  onAdd: () => void;
  onOpen: (booking: Booking) => void;
}) {
  const today = todayIso();
  const sorted = sortBookings(bookings);
  const groups = new Map<string, Booking[]>();
  for (const booking of sorted) {
    groups.set(booking.starts_on, [...(groups.get(booking.starts_on) ?? []), booking]);
  }

  return (
    <div className="bookings">
      <div className="page-actions">
        <h2 className="page-heading">Bookings</h2>
        {canEdit && (
          <button type="button" className="button primary" onClick={onAdd}>
            <Icon name="plus" size={18} /> Add
          </button>
        )}
      </div>

      {bookings.length === 0 && (
        <div className="empty">
          <p>Add flights, stays, trains and tours here. They also show on the right days in your plan.</p>
        </div>
      )}

      {[...groups.entries()].map(([day, list]) => {
        const index = days.indexOf(day);
        return (
          <section key={day} className="booking-day">
            <h3 className="booking-day-heading">
              {index >= 0 ? `Day ${index + 1} · ` : ""}
              {formatDay(day)}
            </h3>
            <ul className="booking-cards">
              {list.map((booking) => (
                <li key={booking.id}>
                  <BookingCard
                    booking={booking}
                    home={home}
                    past={(booking.ends_on ?? booking.starts_on) < today}
                    onOpen={() => onOpen(booking)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function BookingCard({
  booking,
  home,
  past,
  onOpen,
}: {
  booking: Booking;
  home: string;
  past: boolean;
  onOpen: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const labels = phaseLabels(booking.kind);

  const start = [labels.start, formatTime(booking.start_time)].filter(Boolean).join(" ");
  const endDate = booking.ends_on && booking.ends_on !== booking.starts_on ? formatDay(booking.ends_on) : "";
  const end =
    booking.ends_on || booking.end_time
      ? [labels.end, endDate, formatTime(booking.end_time)].filter(Boolean).join(" ")
      : "";

  async function copy() {
    if (!booking.reference) return;
    try {
      await navigator.clipboard.writeText(booking.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Copying isn't allowed here. The number is still on screen.
    }
  }

  return (
    <article className={`booking-card booking-${booking.kind}${past ? " booking-past" : ""}`}>
      <button type="button" className="booking-main" onClick={onOpen}>
        <span className="booking-kind">{bookingKindLabel(booking.kind)}</span>
        <span className="booking-title">{booking.title}</span>
        <span className="booking-times">
          {start}
          {end && ` · ${end}`}
        </span>
        {(booking.start_place || booking.end_place) && (
          <span className="booking-places">
            {[booking.start_place, booking.end_place].filter(Boolean).join(" → ")}
          </span>
        )}
        {(booking.provider || booking.cost !== null) && (
          <span className="booking-meta">
            {[booking.provider, booking.cost !== null && booking.currency ? formatMoney(booking.cost, booking.currency, home) : ""]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </button>
      {booking.reference && (
        <button type="button" className="booking-ref" onClick={() => void copy()} aria-label={`Copy confirmation number ${booking.reference}`}>
          <span className="booking-ref-label">{copied ? "Copied" : "Confirmation"}</span>
          <span className="booking-ref-code">{booking.reference}</span>
          <Icon name="copy" size={14} />
        </button>
      )}
    </article>
  );
}
