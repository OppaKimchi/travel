import { readCache, writeCache } from "./cache";

// Exchange rates come from Frankfurter (European Central Bank reference rates,
// updated each working day). It covers about 30 major currencies.
const RATES_URL = "https://api.frankfurter.dev/v1/latest";

export const COMMON_CURRENCIES = [
  "AUD", "TWD", "JPY", "KRW", "HKD", "SGD", "THB", "MYR", "IDR", "PHP", "VND", "CNY",
  "NZD", "USD", "CAD", "GBP", "EUR", "CHF", "INR",
];

export function formatMoney(amount: number, currency: string, home?: string): string {
  try {
    const text = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
    // Several currencies use "$". Spell out the ones that aren't home.
    return currency !== home && text.includes("$") ? text.replace("$", `${currency} `) : text;
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export type Rate = { rate: number; date: string };

// How many units of `to` one unit of `from` is worth. Rates are saved on the
// phone so the last one known still works offline. Returns null for
// currencies the service doesn't cover.
export async function getRate(from: string, to: string): Promise<Rate | null> {
  if (from === to) return { rate: 1, date: "" };
  const key = `rate:${from}:${to}`;
  const saved = readCache<Rate>(key);
  const fresh = saved && Date.now() - Date.parse(saved.savedAt) < 12 * 60 * 60 * 1000;
  if (fresh) return saved.data;
  try {
    const response = await fetch(`${RATES_URL}?base=${from}&symbols=${to}`);
    if (!response.ok) return saved?.data ?? null;
    const body = (await response.json()) as { date: string; rates: Record<string, number> };
    const rate = body.rates[to];
    if (!rate) return saved?.data ?? null;
    const result = { rate, date: body.date };
    writeCache(key, result);
    return result;
  } catch {
    return saved?.data ?? null;
  }
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseAmount(text: string): number | null {
  const value = Number(text.replace(/[,\s]/g, ""));
  return Number.isFinite(value) && value >= 0 ? value : null;
}
