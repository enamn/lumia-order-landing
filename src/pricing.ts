// The plan prices shown on the landing page: the visitor's own country (when it is in the Gulf and has approved prices), otherwise the UAE prices in AED.
// The country is looked up by the admin app from the visitor's IP; nothing is stored. While it loads, or if it fails, the UAE prices show.
import { useEffect, useState } from 'react';

const env = (import.meta as unknown as { env?: { VITE_ADMIN_URL?: string; DEV?: boolean } }).env;
const ADMIN = (env?.VITE_ADMIN_URL ?? (env?.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');

export interface TerminalPrices { currency: string; decimals: number; yearly: Record<'starter' | 'plus' | 'pro', number>; monthly: number; extra: number; regular?: number }
export interface PriceInfo { detected: string; country: string; countryName: string; currency: string; decimals: number; local: boolean; paidOpen: boolean; plans: Record<'starter' | 'plus' | 'pro', { monthly: number; yearly: number }>; terminal: TerminalPrices | null }
// Until the visitor's prices arrive (or when they are outside the Gulf) the UAE terminal prices show.
export const UAE_TERMINAL: TerminalPrices = { currency: 'AED', decimals: 2, yearly: { starter: 549, plus: 499, pro: 399 }, monthly: 599, extra: 599, regular: 699 };
export const terminalOf = (info: PriceInfo | null): TerminalPrices | null => (info ? info.terminal : UAE_TERMINAL);
export const AED: Pick<PriceInfo, 'currency' | 'decimals' | 'local'> = { currency: 'AED', decimals: 2, local: false };

// One shared request for the whole page: every price, demo amount and FAQ answer reads the same result.
let shared: PriceInfo | null = (() => { try { const v = sessionStorage.getItem('lumia-prices'); return v ? (JSON.parse(v) as PriceInfo) : null; } catch { return null; } })();
let started = false;
const listeners = new Set<() => void>();
function load() {
  if (started || shared || !ADMIN) return;
  started = true;
  const asked = new URLSearchParams(location.search).get('country');
  fetch(`${ADMIN}/api/public/pricing${asked ? `?country=${encodeURIComponent(asked)}` : ''}`, { credentials: 'omit' })
    .then(r => (r.ok ? r.json() : null))
    .then(j => { const d = j?.data as PriceInfo | undefined; if (d) { shared = d; try { sessionStorage.setItem('lumia-prices', JSON.stringify(d)); } catch { /* optional */ } listeners.forEach(f => f()); } })
    .catch(() => undefined);
}

export function usePriceInfo(): PriceInfo | null {
  const [info, setInfo] = useState<PriceInfo | null>(shared);
  useEffect(() => {
    const f = () => setInfo(shared);
    listeners.add(f); load(); f();
    return () => { listeners.delete(f); };
  }, []);
  return info;
}

// "AED 1,490", "SAR 299", "OMR 24.900": whole amounts without decimals, others with the currency's own.
export function money(n: number, currency: string, decimals: number) {
  return `${currency} ${Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
