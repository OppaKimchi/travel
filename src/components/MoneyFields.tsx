import { useEffect, useState } from "react";
import { COMMON_CURRENCIES, getRate, parseAmount, roundMoney, type Rate } from "../lib/money";

export type MoneyValue = {
  amount: string;
  currency: string;
  homeAmount: string;
  // True once the home amount has been typed by hand, so it isn't overwritten.
  homeEdited: boolean;
};

export function moneyValue(amount: number | null, currency: string, home: number | null): MoneyValue {
  return {
    amount: amount === null ? "" : String(amount),
    currency,
    homeAmount: home === null ? "" : String(home),
    homeEdited: home !== null,
  };
}

export function MoneyFields({
  value,
  onChange,
  home,
  label,
  required,
}: {
  value: MoneyValue;
  onChange: (update: (current: MoneyValue) => MoneyValue) => void;
  home: string;
  label: string;
  required?: boolean;
}) {
  const [rate, setRate] = useState<Rate | null | "loading">(null);
  const foreign = value.currency.length === 3 && value.currency !== home;

  useEffect(() => {
    if (!foreign) {
      setRate(null);
      return;
    }
    let active = true;
    setRate("loading");
    getRate(value.currency, home).then((found) => {
      if (active) setRate(found);
    });
    return () => {
      active = false;
    };
  }, [value.currency, home, foreign]);

  // Fill in the home amount from the rate, unless it was typed by hand.
  useEffect(() => {
    if (!foreign || !rate || rate === "loading") return;
    const amount = parseAmount(value.amount);
    onChange((current) =>
      current.homeEdited
        ? current
        : { ...current, homeAmount: amount === null ? "" : String(roundMoney(amount * rate.rate)) },
    );
  }, [value.amount, rate, foreign, onChange]);

  return (
    <div className="stack tight">
      <div className="row-money">
        <label className="field">
          <span>{label}</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            required={required}
            placeholder="0.00"
            value={value.amount}
            onChange={(e) => {
              const amount = e.target.value;
              onChange((current) => ({ ...current, amount }));
            }}
          />
        </label>
        <label className="field">
          <span>Currency</span>
          <input
            list="currency-codes"
            required={required || value.amount.trim() !== ""}
            pattern="[A-Za-z]{3}"
            maxLength={3}
            title="A three-letter currency code, such as TWD"
            value={value.currency}
            onChange={(e) => {
              const currency = e.target.value.toUpperCase();
              onChange((current) => ({ ...current, currency, homeEdited: false }));
            }}
          />
          <datalist id="currency-codes">
            {COMMON_CURRENCIES.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
        </label>
      </div>

      {foreign && (
        <label className="field">
          <span>In {home}</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            required={required || value.amount.trim() !== ""}
            value={value.homeAmount}
            onChange={(e) => {
              const homeAmount = e.target.value;
              onChange((current) => ({ ...current, homeAmount, homeEdited: true }));
            }}
          />
          <span className="hint">
            {rate === "loading" && "Getting today's exchange rate…"}
            {rate && rate !== "loading" &&
              `1 ${value.currency} = ${Number(rate.rate.toPrecision(4))} ${home}${rate.date ? `, rate from ${rate.date}` : ""}. You can change it.`}
            {rate === null && `No exchange rate for ${value.currency} is available here, so enter the ${home} amount yourself.`}
          </span>
        </label>
      )}
    </div>
  );
}

// Reads the fields back into numbers. Returns null for a blank, optional amount.
export function readMoney(value: MoneyValue, home: string): { amount: number; currency: string; home: number } | null {
  const amount = parseAmount(value.amount);
  if (amount === null || value.amount.trim() === "") return null;
  const currency = value.currency.toUpperCase();
  const homeAmount = currency === home ? amount : parseAmount(value.homeAmount);
  if (homeAmount === null) throw new Error(`Enter the amount in ${home} as well.`);
  return { amount: roundMoney(amount), currency, home: roundMoney(homeAmount) };
}
