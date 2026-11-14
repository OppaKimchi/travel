function field(error: unknown, key: string): string {
  if (error && typeof error === "object" && key in error) {
    return String((error as Record<string, unknown>)[key] ?? "");
  }
  return "";
}

export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (field(error, "name") === "AuthRetryableFetchError") return true;
  const message = field(error, "message") || String(error);
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(message);
}

export function friendlyError(error: unknown): string {
  if (isNetworkError(error)) {
    return "You're offline. Try again when you have a connection.";
  }
  const message = field(error, "message");
  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match an account.";
  }
  return message || "Something went wrong. Please try again.";
}
