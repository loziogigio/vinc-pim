"use client";

import { useEffect, useState } from "react";

/**
 * Tenant-configured number of decimal places for prices, set in
 * B2B Settings → Product cards → "Price decimal places"
 * (persisted as `cardStyle.priceDecimals` on the home settings document).
 *
 * Admin price displays should use this instead of a hardcoded `.toFixed(2)`
 * so the back office matches the storefront, which reads the same value.
 *
 * The settings document is shared and rarely changes, so the fetch is cached
 * at module scope: every component that calls this hook shares a single
 * in-flight request and the resolved value.
 */
const DEFAULT_PRICE_DECIMALS = 2;

let cachedValue: number | null = null;
let inFlight: Promise<number> | null = null;

async function fetchPriceDecimals(): Promise<number> {
  if (cachedValue !== null) return cachedValue;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/b2b/home-settings", { cache: "no-store" });
      if (!res.ok) return DEFAULT_PRICE_DECIMALS;
      const data = await res.json();
      const decimals = data?.cardStyle?.priceDecimals;
      cachedValue =
        typeof decimals === "number" && decimals >= 0 ? decimals : DEFAULT_PRICE_DECIMALS;
      return cachedValue;
    } catch {
      return DEFAULT_PRICE_DECIMALS;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function usePriceDecimals(): number {
  const [decimals, setDecimals] = useState<number>(cachedValue ?? DEFAULT_PRICE_DECIMALS);

  useEffect(() => {
    let active = true;
    fetchPriceDecimals().then((value) => {
      if (active) setDecimals(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return decimals;
}
