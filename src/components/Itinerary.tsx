import { useEffect, useMemo, type MouseEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { bookingsOnDay, type DayBooking } from "../lib/bookings";
import { formatDay, formatTime, todayIso } from "../lib/dates";
import { bookingKindLabel, categoryLabel, type Booking, type Stop } from "../lib/types";
import { Icon } from "./Icon";

const IDEAS = "ideas";

type Group = { key: string; day: string | null; heading: string; detail: string; stops: Stop[] };

export type Placement = { id: string; day: string | null; position: number };

// Puts a day's timed stops in time order. Stops without a time keep their
// place in the list. Returns null when the day is already in order.
function sortedByTime(stops: Stop[]): Stop[] | null {
  const timed = stops.filter((s) => s.start_time);
  const sorted = [...timed].sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  if (sorted.every((s, i) => s.id === timed[i].id)) return null;
  let next = 0;
  return stops.map((s) => (s.start_time ? sorted[next++] : s));
}

function keyOf(day: string | null) {
  return day ?? IDEAS;
}

// Prefer dropping onto a stop; fall back to a day's empty space.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const onStops = hits.filter((hit) => !String(hit.id).startsWith("day:"));
  if (onStops.length) return onStops;
  if (hits.length) return hits;
  return closestCenter(args);
};

export function Itinerary({
  days,
  stops,
  bookings,
  canEdit,
  onAdd,
  onOpen,
  onOpenBooking,
  onPlace,
}: {
  days: string[];
  stops: Stop[];
  bookings: Booking[];
  canEdit: boolean;
  onAdd: (day: string | null) => void;
  onOpen: (stop: Stop) => void;
  onOpenBooking: (booking: Booking) => void;
  onPlace: (changes: Placement[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groups = useMemo<Group[]>(() => {
    const byDay = new Map<string, Stop[]>();
    for (const stop of [...stops].sort((a, b) => a.position - b.position)) {
      const key = keyOf(stop.day);
      byDay.set(key, [...(byDay.get(key) ?? []), stop]);
    }
    const result: Group[] = days.map((day, i) => ({
      key: day,
      day,
      heading: `Day ${i + 1}`,
      detail: formatDay(day),
      stops: byDay.get(day) ?? [],
    }));
    // Stops on dates that are no longer part of the trip.
    const stray = [...byDay.keys()].filter((k) => k !== IDEAS && !days.includes(k)).sort();
    for (const day of stray) {
      result.push({ key: day, day, heading: "Outside trip dates", detail: formatDay(day), stops: byDay.get(day) ?? [] });
    }
    result.push({ key: IDEAS, day: null, heading: "Ideas", detail: "Not on a day yet", stops: byDay.get(IDEAS) ?? [] });
    return result;
  }, [days, stops]);

  const today = todayIso();
  const todayInTrip = days.includes(today);

  // While travelling, open the plan at today. Only runs when the plan first opens.
  useEffect(() => {
    if (todayInTrip) document.getElementById(`day-${today}`)?.scrollIntoView({ block: "start" });
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || overId === activeId) return;
    const moving = stops.find((s) => s.id === activeId);
    if (!moving) return;

    let target: Group | undefined;
    let index: number;
    if (overId.startsWith("day:")) {
      target = groups.find((g) => g.key === overId.slice(4));
      if (!target) return;
      index = target.stops.filter((s) => s.id !== activeId).length;
    } else {
      target = groups.find((g) => g.stops.some((s) => s.id === overId));
      if (!target) return;
      const from = target.stops.findIndex((s) => s.id === activeId);
      const to = target.stops.findIndex((s) => s.id === overId);
      const others = target.stops.filter((s) => s.id !== activeId);
      index = others.findIndex((s) => s.id === overId);
      // Dragging down within the same day lands after the stop you drop on.
      if (from !== -1 && from < to) index += 1;
    }

    const others = target.stops.filter((s) => s.id !== activeId);
    const before = others[index - 1];
    const after = others[index];
    const position =
      before && after
        ? (before.position + after.position) / 2
        : before
          ? before.position + 1000
          : after
            ? after.position - 1000
            : 1000;

    if (moving.day === target.day && moving.position === position) return;
    onPlace([{ id: activeId, day: target.day, position }]);
  }

  function sortDay(group: Group) {
    const sorted = sortedByTime(group.stops);
    if (!sorted) return;
    onPlace(
      sorted
        .map((s, i) => ({ id: s.id, day: group.day, position: (i + 1) * 1000, old: s.position }))
        .filter((c) => c.position !== c.old)
        .map(({ id, day, position }) => ({ id, day, position })),
    );
  }

  return (
    <div className="itinerary">
      <nav className="day-chips" aria-label="Jump to a day">
        {todayInTrip && (
          <a className="chip chip-today" href={`#day-${today}`} onClick={(e) => jump(e, `day-${today}`)}>
            Today
          </a>
        )}
        {groups.map((g) => (
          <a key={g.key} className="chip" href={`#day-${g.key}`} onClick={(e) => jump(e, `day-${g.key}`)}>
            {g.key === IDEAS ? "Ideas" : g.heading === "Outside trip dates" ? g.detail : g.heading.replace("Day ", "D")}
          </a>
        ))}
      </nav>

      <DndContext sensors={sensors} collisionDetection={collision} onDragEnd={handleDragEnd}>
        {groups.map((group) => (
          <DaySection
            key={group.key}
            group={group}
            isToday={group.day === today}
            booked={group.day ? bookingsOnDay(bookings, group.day) : []}
            canEdit={canEdit}
            onAdd={() => onAdd(group.day)}
            onOpen={onOpen}
            onOpenBooking={onOpenBooking}
            onSort={group.day && sortedByTime(group.stops) ? () => sortDay(group) : undefined}
          />
        ))}
      </DndContext>
    </div>
  );
}

function jump(event: MouseEvent, id: string) {
  event.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function DaySection({
  group,
  isToday,
  booked,
  canEdit,
  onAdd,
  onOpen,
  onOpenBooking,
  onSort,
}: {
  group: Group;
  isToday: boolean;
  booked: DayBooking[];
  canEdit: boolean;
  onAdd: () => void;
  onOpen: (stop: Stop) => void;
  onOpenBooking: (booking: Booking) => void;
  onSort?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${group.key}` });

  return (
    <section className={`day${isToday ? " day-today" : ""}`} id={`day-${group.key}`}>
      <header className="day-header">
        <h2>
          {group.heading}
          <span className="day-detail">{group.detail}</span>
        </h2>
        <span className="day-header-actions">
          {canEdit && onSort && (
            <button type="button" className="link-button small" onClick={onSort}>
              Sort by time
            </button>
          )}
          {isToday && <span className="tag">Today</span>}
        </span>
      </header>
      {booked.length > 0 && (
        <ul className="booked" aria-label="Bookings this day">
          {booked.map((item) => (
            <li key={`${item.booking.id}-${item.label}`}>
              <button
                type="button"
                className={`booked-row booking-${item.booking.kind}`}
                onClick={() => onOpenBooking(item.booking)}
              >
                <Icon name="ticket" size={16} />
                <span className="booked-text">
                  <span className="booked-label">
                    {item.label}
                    {item.time && ` ${formatTime(item.time)}`}
                    {item.endTime && ` to ${formatTime(item.endTime)}`}
                    {item.label !== "Staying at" && ` · ${bookingKindLabel(item.booking.kind)}`}
                  </span>
                  <span className="booked-title">{item.booking.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <SortableContext items={group.stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className={`stops${isOver ? " stops-over" : ""}`}>
          {group.stops.map((stop) => (
            <StopRow key={stop.id} stop={stop} canEdit={canEdit} onOpen={() => onOpen(stop)} />
          ))}
          {group.stops.length === 0 && booked.length === 0 && <li className="stops-empty">Nothing planned yet.</li>}
        </ol>
      </SortableContext>
      {canEdit && (
        <button type="button" className="add-stop" onClick={onAdd}>
          <Icon name="plus" size={18} /> Add to {group.key === IDEAS ? "ideas" : group.heading.toLowerCase()}
        </button>
      )}
    </section>
  );
}

function StopRow({ stop, canEdit, onOpen }: { stop: Stop; canEdit: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id, disabled: !canEdit });

  return (
    <li
      ref={setNodeRef}
      className={`stop stop-${stop.category}${isDragging ? " stop-dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {canEdit && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="drag-handle"
          aria-label={`Move ${stop.title}`}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" size={18} />
        </button>
      )}
      <button type="button" className="stop-main" onClick={onOpen}>
        <span className="stop-top">
          {stop.start_time && <span className="stop-time">{formatTime(stop.start_time)}</span>}
          <span className="stop-title">{stop.title}</span>
        </span>
        <span className="stop-meta">
          <span className="stop-category">{categoryLabel(stop.category)}</span>
          {stop.lat !== null && (
            <span className="stop-located" title="Has a location">
              <Icon name="pin" size={14} />
              {stop.address?.split(",")[0]}
            </span>
          )}
        </span>
        {stop.notes && <span className="stop-notes">{stop.notes.split("\n\n")[0]}</span>}
      </button>
    </li>
  );
}
