// Trip dates are plain calendar dates ("2026-12-08"). They're handled in UTC
// so a day never shifts because of the phone's time zone.

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function tripDays(start: string, end: string): string[] {
  const days: string[] = [];
  const last = toUtc(end);
  for (let ms = toUtc(start); ms <= last && days.length < 400; ms += DAY_MS) {
    days.push(fromUtc(ms));
  }
  return days;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

// Today's date where the phone is, which is what matters while travelling.
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const dayFormat = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const shortFormat = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const longFormat = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const timeFormat = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDay(iso: string): string {
  return dayFormat.format(toUtc(iso));
}

export function formatRange(start: string, end: string): string {
  if (start === end) return longFormat.format(toUtc(start));
  return `${shortFormat.format(toUtc(start))} to ${longFormat.format(toUtc(end))}`;
}

// "09:30:00" from the database becomes "9:30 am".
export function formatTime(time: string | null): string {
  if (!time) return "";
  return timeFormat.format(Date.parse(`1970-01-01T${time.slice(0, 5)}:00Z`));
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}
