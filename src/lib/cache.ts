// A copy of the latest trip data on this phone, so plans still open with no
// signal. Storage can be unavailable (private browsing), so every call is
// allowed to fail quietly.

const PREFIX = "our-trips:v1:";

export type Cached<T> = { savedAt: string; data: T };

export function readCache<T>(key: string): Cached<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): string {
  const savedAt = new Date().toISOString();
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt, data }));
  } catch {
    // Storage is full or blocked. The app still works online.
  }
  return savedAt;
}

export function clearCache(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Nothing to clear.
  }
}
